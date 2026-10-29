import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { mapUser, mapUserPublic, type UserRow } from '../lib/mappers'
import { hashPassword, verifyPassword } from '../lib/password'
import { newId } from '../lib/ids'
import { randomUUID } from 'node:crypto'
import { requireAuth, requireRole } from '../middleware/auth'
import type { Role } from '../types'

export const userRouter = Router()
userRouter.use(requireAuth)

const ROLES: Role[] = ['anggota', 'coach', 'pengurus']

/** Memetakan galat PostgreSQL yang kita kenali ke galat API yang ramah. */
function fromPgError(err: unknown): never {
  const code = (err as { code?: string } | null)?.code
  if (code === '23505') throw ApiError.conflict('Email sudah digunakan oleh pengguna lain.')
  if (code === '23503') throw ApiError.badRequest('Data terkait (coach) tidak ditemukan.')
  throw err
}

/* ------------------------------------------------------------------ */
/* Daftar pengguna                                                     */
/* ------------------------------------------------------------------ */

userRouter.get(
  '/',
  requireRole('pengurus', 'coach'),
  wrap(async (req, res) => {
    const requestedRole = typeof req.query.role === 'string' && ROLES.includes(req.query.role as Role)
      ? (req.query.role as Role)
      : 'anggota'
    const actor = req.auth!.role

    // Coach hanya akan melihat anggota yang diampu, dan tidak boleh melihat
    // daftar 'pengurus'. Semua respon daftar memakai serializer non-PII
    // (M-03): tanpa NIK/alamat/riwayat penyakit/kontak orang tua/attendanceToken.
    if (actor === 'coach') {
      if (requestedRole === 'pengurus') return res.json({ users: [] })
      const { rows } = await query<UserRow>(
        `select u.* from users u where u.role = $1 and u.coach_id = $2 order by u.name asc`,
        [requestedRole, req.auth!.userId],
      )
      return res.json(rows.map(mapUserPublic))
    }

    const { rows } = await query<UserRow>(
      `select * from users where role = $1 order by name asc`,
      [requestedRole],
    )
    res.json(rows.map(mapUserPublic))
  }),
)

/* ------------------------------------------------------------------ */
/* Buat akun baru (anggota / coach / pengurus)                        */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.'),
  email: z.string().trim().email('Format email tidak valid.'),
  password: z.string().min(8, 'Password minimal 8 karakter.'),
  role: z.enum(['anggota', 'coach', 'pengurus']),
  phone: z.string().trim().max(40, 'Nomor kontak terlalu panjang.').optional(),
  photoUrl: z.string().optional(),
  membershipStatus: z.enum(['aktif', 'nonaktif', 'pending']).optional(),
  coachId: z.string().trim().optional(),
})

userRouter.post(
  '/',
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const input = createSchema.parse(req.body ?? {})

    // Coach wajib ditautkan ke profil coach agar bisa mengampu jadwal.
    if (input.role === 'coach' && !input.coachId) {
      throw ApiError.badRequest('Pilih profil coach untuk akun ini.')
    }

    const { rows: dup } = await query<{ id: string }>(
      'select id from users where lower(email) = lower($1) limit 1',
      [input.email],
    )
    if (dup[0]) throw ApiError.conflict('Email sudah terdaftar.')

    try {
      const { rows } = await query<UserRow>(
        `insert into users
           (id, name, email, role, phone, photo_url, membership_status, coach_id,
            password_hash, joined_at, created_at, updated_at, attendance_token)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9, current_date, now(), now(), $10)
         returning *`,
        [
          newId('u'),
          input.name,
          input.email,
          input.role,
          input.phone ?? null,
          input.photoUrl ?? null,
          input.membershipStatus ?? 'aktif',
          input.role === 'pengurus' ? null : input.coachId || null,
          await hashPassword(input.password),
          randomUUID(),
        ],
      )
      res.status(201).json(mapUser(rows[0]))
    } catch (err) {
      fromPgError(err)
    }
  }),
)

/* ------------------------------------------------------------------ */
/* Ubah profil / peran pengguna                                        */
/* ------------------------------------------------------------------ */

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.').optional(),
  phone: z.string().trim().max(40, 'Nomor kontak terlalu panjang.').optional(),
  email: z.string().trim().email('Format email tidak valid.').optional(),
  photoUrl: z.string().optional(),
  // Data identitas anggota — boleh diisi/diperbarui sendiri oleh pemilik akun.
  gender: z.enum(['L', 'P', '']).optional(),
  nik: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{16}$/.test(v), 'NIK KTP harus tepat 16 digit angka.')
    .optional(),
  address: z.string().trim().max(500, 'Alamat terlalu panjang.').optional(),
  medicalHistory: z.string().trim().max(1000, 'Riwayat penyakit terlalu panjang.').optional(),
  parentName: z.string().trim().max(120, 'Nama orang tua/wali terlalu panjang.').optional(),
  parentPhone: z.string().trim().max(40, 'Kontak orang tua/wali terlalu panjang.').optional(),
  // Hanya pengurus yang boleh mengubah tiga bidang di bawah ini.
  role: z.enum(['anggota', 'coach', 'pengurus']).optional(),
  membershipStatus: z.enum(['aktif', 'nonaktif', 'pending']).optional(),
  coachId: z.string().trim().optional(),
})

userRouter.patch(
  '/:id',
  wrap(async (req, res) => {
    const { id } = req.params
    const isSelf = req.auth!.userId === id
    const isAdmin = req.auth!.role === 'pengurus'
    if (!isSelf && !isAdmin) throw ApiError.forbidden()

    const patch = profileSchema.parse(req.body ?? {})

    const { rows: existing } = await query<UserRow>('select * from users where id = $1', [id])
    const current = existing[0]
    if (!current) throw ApiError.notFound('Pengguna tidak ditemukan.')

    const role = isAdmin ? patch.role ?? current.role : current.role
    const membership = isAdmin ? patch.membershipStatus ?? current.membership_status : current.membership_status
    let coachId = current.coach_id
    if (isAdmin && patch.coachId !== undefined) coachId = patch.coachId || null
    // Pengurus tidak ditautkan ke profil coach.
    if (role === 'pengurus') coachId = null

    try {
      const { rows } = await query<UserRow>(
        `update users set
           name              = $2,
           phone             = $3,
           email             = $4,
           photo_url         = $5,
           role              = $6,
           membership_status = $7,
           coach_id          = $8,
           gender            = $9,
           nik               = $10,
           address           = $11,
           medical_history   = $12,
           parent_name       = $13,
           parent_phone      = $14,
           updated_at        = now()
         where id = $1
         returning *`,
        [
          id,
          patch.name ?? current.name,
          patch.phone ?? current.phone,
          patch.email ?? current.email,
          patch.photoUrl ?? current.photo_url,
          role,
          membership,
          coachId,
          patch.gender === undefined ? current.gender : patch.gender || null,
          patch.nik === undefined ? current.nik : patch.nik || null,
          patch.address === undefined ? current.address : patch.address || null,
          patch.medicalHistory === undefined ? current.medical_history : patch.medicalHistory || null,
          patch.parentName === undefined ? current.parent_name : patch.parentName || null,
          patch.parentPhone === undefined ? current.parent_phone : patch.parentPhone || null,
        ],
      )
      res.json(mapUser(rows[0]))
    } catch (err) {
      fromPgError(err)
    }
  }),
)

/* ------------------------------------------------------------------ */
/* Ubah / setel ulang password                                         */
/* ------------------------------------------------------------------ */

const passwordSchema = z
  .object({
    current: z.string().optional(),
    next: z.string().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
  })
  .transform((v) => ({ current: v.current ?? v.currentPassword ?? '', next: v.next ?? v.newPassword ?? '' }))
  .refine((v) => v.next.length >= 8, { message: 'Password baru minimal 8 karakter.' })

userRouter.post(
  '/:id/password',
  wrap(async (req, res) => {
    const { id } = req.params
    const isSelf = req.auth!.userId === id
    const isAdmin = req.auth!.role === 'pengurus'
    if (!isSelf && !isAdmin) throw ApiError.forbidden()

    const { current, next } = passwordSchema.parse(req.body ?? {})
    const { rows } = await query<UserRow>('select * from users where id = $1', [id])
    const row = rows[0]
    if (!row) throw ApiError.notFound('Pengguna tidak ditemukan.')

    // Pengurus boleh menyetel ulang password siapa pun tanpa tahu password lama.
    // Selain itu (mengubah password sendiri) password lama wajib benar.
    if (!isAdmin || isSelf) {
      const ok = await verifyPassword(current, row.password_hash ?? '')
      if (!ok) throw ApiError.badRequest('Password saat ini tidak sesuai.')
    }

    await query('update users set password_hash = $2, updated_at = now() where id = $1', [
      id,
      await hashPassword(next),
    ])
    // Paksa login ulang di semua perangkat setelah password berubah.
    await query('update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null', [id])
    res.json({ ok: true })
  }),
)

/* ------------------------------------------------------------------ */
/* Token QR absensi (ID card)                                          */
/* ------------------------------------------------------------------ */

// Petugas mencari anggota berdasarkan token yang dipindai dari QR ID card.
userRouter.get(
  '/attendance-token/:token',
  requireRole('pengurus', 'coach'),
  wrap(async (req, res) => {
    const { rows } = await query<UserRow>(
      'select * from users where attendance_token = $1 limit 1',
      [req.params.token],
    )
    const row = rows[0]
    if (!row) throw ApiError.notFound('Anggota tidak ditemukan.')
    res.json(mapUser(row))
  }),
)

// Anggota (atau pengurus) melihat token QR-nya sendiri untuk dicetak di ID card.
userRouter.get(
  '/:id/attendance-token',
  wrap(async (req, res) => {
    const { id } = req.params
    const isSelf = req.auth!.userId === id
    const isAdmin = req.auth!.role === 'pengurus'
    if (!isSelf && !isAdmin) throw ApiError.forbidden()
    const { rows } = await query<UserRow>('select * from users where id = $1', [id])
    const row = rows[0]
    if (!row) throw ApiError.notFound('Pengguna tidak ditemukan.')
    // Pastikan token ada (backfill bila null).
    let token = row.attendance_token
    if (!token) {
      token = randomUUID()
      await query('update users set attendance_token = $2, updated_at = now() where id = $1', [id, token])
    }
    res.json({ token })
  }),
)

/* ------------------------------------------------------------------ */
/* Hapus pengguna                                                      */
/* ------------------------------------------------------------------ */

userRouter.delete(
  '/:id',
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const { id } = req.params
    if (req.auth!.userId === id) {
      throw ApiError.badRequest('Anda tidak dapat menghapus akun Anda sendiri.')
    }
    const { rowCount } = await query('delete from users where id = $1', [id])
    if (!rowCount) throw ApiError.notFound('Pengguna tidak ditemukan.')
    res.json({ ok: true })
  }),
)
