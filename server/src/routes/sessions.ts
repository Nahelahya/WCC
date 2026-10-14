import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import {
  mapAttendance,
  mapAttendanceDecorated,
  mapSession,
  type AttendanceRowDB,
  type SessionRow,
} from '../lib/mappers'
import { newId } from '../lib/ids'
import { wibInstant } from '../lib/time'
import { requireAuth, requireRole } from '../middleware/auth'
import type { AttendanceStatus } from '../types'

export const sessionRouter = Router()

const time = /^\d{2}:\d{2}$/
const dateISO = /^\d{4}-\d{2}-\d{2}$/

const sessionFields = z.object({
  title: z.string().trim().min(1, 'Nama/jenis latihan wajib diisi.'),
  date: z.string().regex(dateISO, 'Tanggal wajib diisi.'),
  startTime: z.string().regex(time, 'Waktu mulai tidak valid.'),
  endTime: z.string().regex(time, 'Waktu selesai tidak valid.'),
  location: z.string().trim().min(1, 'Lokasi wajib diisi.'),
  coachId: z.string().trim().min(1, 'Coach wajib dipilih.'),
  note: z.string().optional(),
  cancelled: z.boolean().optional(),
})

/* ---------------------- Daftar & detail jadwal ---------------------- */

sessionRouter.get(
  '/',
  wrap(async (_req, res) => {
    const { rows } = await query<SessionRow>(
      'select * from sessions order by date asc, start_time asc',
    )
    res.json(rows.map(mapSession))
  }),
)

sessionRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const { rows } = await query<SessionRow>('select * from sessions where id = $1', [req.params.id])
    if (!rows[0]) throw ApiError.notFound('Sesi tidak ditemukan.')
    res.json(mapSession(rows[0]))
  }),
)

/* ---------------------------- CRUD (pengurus) ----------------------- */

sessionRouter.post(
  '/',
  requireAuth,
  requireRole('pengurus', 'coach'),
  wrap(async (req, res) => {
    const input = sessionFields.parse(req.body ?? {})
    if (input.endTime <= input.startTime) {
      throw ApiError.badRequest('Waktu selesai harus setelah waktu mulai.')
    }
    const id = newId('s')
    const { rows } = await query<SessionRow>(
      `insert into sessions (id, title, date, start_time, end_time, location, coach_id, note, cancelled)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning *`,
      [
        id,
        input.title,
        input.date,
        input.startTime,
        input.endTime,
        input.location,
        input.coachId,
        input.note ?? null,
        input.cancelled ?? false,
      ],
    )
    res.status(201).json(mapSession(rows[0]))
  }),
)

sessionRouter.patch(
  '/:id',
  requireAuth,
  requireRole('pengurus', 'coach'),
  wrap(async (req, res) => {
    const patch = sessionFields.partial().parse(req.body ?? {})
    const { rows: existing } = await query<SessionRow>('select * from sessions where id = $1', [
      req.params.id,
    ])
    const current = existing[0]
    if (!current) throw ApiError.notFound('Sesi tidak ditemukan.')

    const merged = {
      title: patch.title ?? current.title,
      date: patch.date ?? current.date,
      startTime: patch.startTime ?? current.start_time,
      endTime: patch.endTime ?? current.end_time,
      location: patch.location ?? current.location,
      coachId: patch.coachId ?? current.coach_id ?? '',
      note: patch.note ?? current.note,
      cancelled: patch.cancelled ?? current.cancelled,
    }
    if (!merged.coachId) throw ApiError.badRequest('Coach wajib dipilih.')
    if (merged.endTime <= merged.startTime) {
      throw ApiError.badRequest('Waktu selesai harus setelah waktu mulai.')
    }

    const { rows } = await query<SessionRow>(
      `update sessions set
         title = $2, date = $3, start_time = $4, end_time = $5,
         location = $6, coach_id = $7, note = $8, cancelled = $9
       where id = $1
       returning *`,
      [
        req.params.id,
        merged.title,
        merged.date,
        merged.startTime,
        merged.endTime,
        merged.location,
        merged.coachId,
        merged.note,
        merged.cancelled,
      ],
    )
    res.json(mapSession(rows[0]))
  }),
)

sessionRouter.delete(
  '/:id',
  requireAuth,
  requireRole('pengurus', 'coach'),
  wrap(async (req, res) => {
    const { rowCount } = await query('delete from sessions where id = $1', [req.params.id])
    if (!rowCount) throw ApiError.notFound('Sesi tidak ditemukan.')
    res.json({ ok: true })
  }),
)

/* ------------------------------- Absensi ---------------------------- */

const SELECT_ATTENDANCE = `
  select a.*, u.name as user_name, s.title as session_title, s.date as session_date
  from attendance a
  join users u on u.id = a.user_id
  left join sessions s on s.id = a.session_id
`

function sessionWindow(session: SessionRow) {
  // Jam sesi adalah jam WIB, jadi jendela check-in dihitung dari instant WIB
  // (server produksi berjalan pada UTC).
  const start = wibInstant(session.date, session.start_time)
  const end = wibInstant(session.date, session.end_time)
  // Check-in dibuka 30 menit sebelum sesi dimulai.
  return { opensAt: new Date(start.getTime() - 30 * 60_000), end }
}

sessionRouter.get(
  '/:id/attendance',
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await query<AttendanceRowDB>(
      `${SELECT_ATTENDANCE} where a.session_id = $1 order by u.name asc`,
      [req.params.id],
    )
    // Daftar hadir lengkap hanya untuk coach/pengurus; anggota cukup lihat miliknya.
    if (req.auth!.role === 'anggota') {
      return res.json(rows.filter((r) => r.user_id === req.auth!.userId).map(mapAttendanceDecorated))
    }
    res.json(rows.map(mapAttendanceDecorated))
  }),
)

sessionRouter.post(
  '/:id/attendance/check-in',
  requireAuth,
  wrap(async (req, res) => {
    const body = z.object({ userId: z.string().optional() }).parse(req.body ?? {})
    const userId = body.userId ?? req.auth!.userId
    if (userId !== req.auth!.userId && req.auth!.role === 'anggota') {
      throw ApiError.forbidden()
    }

    const { rows: sessions } = await query<SessionRow>('select * from sessions where id = $1', [
      req.params.id,
    ])
    const session = sessions[0]
    if (!session) throw ApiError.notFound('Sesi tidak ditemukan.')
    if (session.cancelled) throw ApiError.badRequest('Sesi ini dibatalkan.')

    const now = new Date()
    const { opensAt, end } = sessionWindow(session)
    if (now < opensAt) throw ApiError.badRequest('Check-in dibuka 30 menit sebelum sesi dimulai.')
    if (now > end) throw ApiError.badRequest('Sesi sudah berakhir, check-in ditutup.')

    const { rows: existing } = await query('select 1 from attendance where session_id = $1 and user_id = $2', [
      session.id,
      userId,
    ])
    if (existing[0]) throw ApiError.conflict('Anda sudah tercatat pada sesi ini.')

    const { rows } = await query<AttendanceRowDB>(
      `insert into attendance (id, session_id, user_id, check_in_at, status)
       values ($1, $2, $3, now(), 'menunggu')
       returning *`,
      [newId('a'), session.id, userId],
    )
    res.status(201).json(mapAttendance(rows[0]))
  }),
)

sessionRouter.patch(
  '/:id/attendance/:userId',
  requireAuth,
  requireRole('pengurus', 'coach'),
  wrap(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(['hadir', 'izin', 'alpha']) })
      .parse(req.body ?? {})

    // Coach hanya boleh mencatat kehadiran pada sesi yang menjadi tanggung jawabnya.
    if (req.auth!.role === 'coach') {
      const { rows: sessions } = await query<SessionRow>('select * from sessions where id = $1', [
        req.params.id,
      ])
      const session = sessions[0]
      if (!session) throw ApiError.notFound('Sesi tidak ditemukan.')
      const { rows: me } = await query<{ coach_id: string | null }>(
        'select coach_id from users where id = $1',
        [req.auth!.userId],
      )
      if (!me[0]?.coach_id || me[0].coach_id !== session.coach_id) {
        throw ApiError.forbidden('Anda hanya dapat mencatat kehadiran pada sesi yang Anda ampu.')
      }
    }

    const { rows } = await query<AttendanceRowDB>(
      `insert into attendance (id, session_id, user_id, check_in_at, status)
       values ($1, $2, $3, now(), $4)
       on conflict (session_id, user_id)
       do update set status = excluded.status
       returning *`,
      [newId('a'), req.params.id, req.params.userId, status as AttendanceStatus],
    )
    res.json(mapAttendance(rows[0]))
  }),
)

sessionRouter.get(
  '/:id/summary',
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await query<{ status: string; total: number }>(
      'select status, count(*)::int as total from attendance where session_id = $1 group by status',
      [req.params.id],
    )
    const { rows: members } = await query<{ total: number }>(
      "select count(*)::int as total from users where role = 'anggota'",
    )
    const byStatus = (s: string) => rows.find((r) => r.status === s)?.total ?? 0
    res.json({
      hadir: byStatus('hadir'),
      izin: byStatus('izin'),
      menunggu: byStatus('menunggu'),
      totalMembers: members[0]?.total ?? 0,
    })
  }),
)

/* ---------------------------- Ringkasan absensi --------------------- */

export const attendanceRouter = Router()
attendanceRouter.use(requireAuth)

attendanceRouter.get(
  '/',
  wrap(async (req, res) => {
    const q = z
      .object({
        userId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(req.query ?? {})

    // Anggota hanya boleh melihat absensinya sendiri.
    const userId = req.auth!.role === 'anggota' ? req.auth!.userId : q.userId

    const conditions: string[] = []
    const params: unknown[] = []
    if (userId) {
      params.push(userId)
      conditions.push(`a.user_id = $${params.length}`)
    }
    if (q.from) {
      params.push(q.from)
      conditions.push(`s.date >= $${params.length}`)
    }
    if (q.to) {
      params.push(q.to)
      conditions.push(`s.date <= $${params.length}`)
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : ''

    const { rows } = await query<AttendanceRowDB>(
      `${SELECT_ATTENDANCE} ${where} order by s.date desc, u.name asc`,
      params,
    )
    res.json(rows.map(mapAttendanceDecorated))
  }),
)
