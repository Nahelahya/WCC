import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { wrap } from '../lib/async'
import {
  mapSession,
  mapSyncLog,
  mapTransaction,
  type SessionRow,
  type SyncLogRow,
  type TransactionRow,
} from '../lib/mappers'
import { requireAuth, requireRole } from '../middleware/auth'
import { todayISO } from '../lib/time'

export const dashboardRouter = Router()
dashboardRouter.use(requireAuth)

const upcomingQuery = (date: string, limit?: number) =>
  query<SessionRow>(
    `select * from sessions
     where cancelled = false and date >= $1
     order by date asc, start_time asc
     ${limit ? `limit ${limit}` : ''}`,
    [date],
  )

dashboardRouter.get(
  '/dashboard/member',
  wrap(async (req, res) => {
    // from/to membatasi perhitungan ke satu bulan (rekap bulanan). Bila kosong,
    // dihitung sejak awal (perilaku lama: seluruh waktu).
    const q = z
      .object({ from: z.string().optional(), to: z.string().optional() })
      .parse(req.query ?? {})
    const today = todayISO()
    const userId = req.auth!.userId
    const from = q.from ?? '0001-01-01'
    const to = q.to ?? '9999-12-31'

    const { rows: hadirRows } = await query<{ hadir: number }>(
      `select (count(*) filter (where a.status = 'hadir'))::int as hadir
       from attendance a
       join sessions s on s.id = a.session_id
       where a.user_id = $1 and s.date >= $2 and s.date <= $3 and s.date <= $4`,
      [userId, from, to, today],
    )
    const { rows: totalRows } = await query<{ total: number }>(
      `select count(*)::int as total from sessions
       where cancelled = false and date >= $1 and date <= $2 and date <= $3`,
      [from, to, today],
    )
    const { rows: upcoming } = await upcomingQuery(today)

    const hadir = hadirRows[0]?.hadir ?? 0
    const total = totalRows[0]?.total ?? 0
    res.json({
      hadir,
      totalSessions: total,
      percentage: total ? Math.round((hadir / total) * 100) : 0,
      from: q.from ?? null,
      to: q.to ?? null,
      upcoming: upcoming.map(mapSession),
    })
  }),
)

dashboardRouter.get(
  '/dashboard/admin',
  requireRole('pengurus'),
  wrap(async (_req, res) => {
    const today = todayISO()

    const { rows: upcoming } = await upcomingQuery(today)
    const { rows: recentSessions } = await query<SessionRow>(
      'select * from sessions where date < $1 order by date desc limit 3',
      [today],
    )
    const recentIds = recentSessions.map((s) => s.id)

    const { rows: attCount } = await query<{ total: number }>(
      'select count(*)::int as total from attendance where session_id = any($1::text[])',
      [recentIds],
    )
    const { rows: pending } = await query<{ total: number }>(
      "select count(*)::int as total from registrations where status = 'baru'",
    )
    const { rows: members } = await query<{ total: number }>(
      "select count(*)::int as total from users where role = 'anggota'",
    )
    const { rows: tx } = await query<TransactionRow>(
      'select * from transactions order by date desc, created_at desc limit 5',
    )
    const { rows: balanceRows } = await query<{ balance: number }>(
      `select coalesce(sum(case when type = 'pemasukan' then amount else -amount end), 0)::numeric as balance
       from transactions`,
    )
    const { rows: state } = await query<{ status: string; last_sync_at: Date | null }>(
      'select status, last_sync_at from sync_state where id = 1',
    )
    const { rows: log } = await query<SyncLogRow>('select * from sync_logs order by at desc limit 20')
    const s = state[0]

    res.json({
      upcoming: upcoming.map(mapSession),
      recentSessions: recentSessions.map(mapSession),
      recentAttendanceCount: attCount[0]?.total ?? 0,
      pendingRegistrations: pending[0]?.total ?? 0,
      activeMembers: members[0]?.total ?? 0,
      balance: Number(balanceRows[0]?.balance ?? 0),
      recentTransactions: tx.map(mapTransaction),
      sync: {
        status: s?.status ?? 'idle',
        lastSyncAt: s?.last_sync_at ? new Date(s.last_sync_at).toISOString() : null,
        log: log.map(mapSyncLog),
      },
    })
  }),
)

dashboardRouter.get(
  '/dashboard/coach',
  wrap(async (req, res) => {
    const q = z.object({ coachId: z.string().optional() }).parse(req.query ?? {})
    let coachId = q.coachId
    if (!coachId) {
      const { rows } = await query<{ coach_id: string | null }>(
        'select coach_id from users where id = $1',
        [req.auth!.userId],
      )
      coachId = rows[0]?.coach_id ?? ''
    }
    if (!coachId) return res.json({ upcoming: [], past: [] })

    const today = todayISO()
    const { rows: upcoming } = await query<SessionRow>(
      `select * from sessions
       where coach_id = $1 and cancelled = false and date >= $2
       order by date asc, start_time asc`,
      [coachId, today],
    )
    const { rows: past } = await query<SessionRow>(
      `select * from sessions
       where coach_id = $1 and cancelled = false and date < $2
       order by date desc, start_time asc`,
      [coachId, today],
    )
    res.json({ upcoming: upcoming.map(mapSession), past: past.map(mapSession) })
  }),
)
