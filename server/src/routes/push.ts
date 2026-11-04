import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { newId } from '../lib/ids'
import { requireAuth, requireRole } from '../middleware/auth'
import { isPushConfigured } from '../lib/push'
import { env } from '../env'

export const pushRouter = Router()

/* ------------------------------------------------------------------ */
/* VAPID public key (publik)                                          */
/* ------------------------------------------------------------------ */

pushRouter.get(
  '/vapid-public-key',
  wrap(async (_req, res) => {
    if (!isPushConfigured()) {
      throw ApiError.serviceUnavailable('Web Push belum dikonfigurasi (VAPID keys kosong).')
    }
    res.json({ publicKey: env.vapidPublicKey })
  }),
)

/* ------------------------------------------------------------------ */
/* Status subscription user login                                     */
/* ------------------------------------------------------------------ */

pushRouter.get(
  '/status',
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await query<{ count: string }>(
      'select count(*)::text as count from push_subscriptions where user_id = $1',
      [req.auth!.userId],
    )
    const count = Number(rows[0]?.count ?? 0)
    res.json({ subscribed: count > 0, count })
  }),
)

/* ------------------------------------------------------------------ */
/* Subscribe (upsert berdasarkan endpoint)                             */
/* ------------------------------------------------------------------ */

const subscribeSchema = z.object({
  endpoint: z.string().trim().min(1, 'Endpoint wajib diisi.'),
  keys: z.object({
    p256dh: z.string().trim().min(1, 'p256dh wajib diisi.'),
    auth: z.string().trim().min(1, 'auth wajib diisi.'),
  }),
  userAgent: z.string().trim().max(500).optional(),
})

pushRouter.post(
  '/subscribe',
  requireAuth,
  wrap(async (req, res) => {
    if (!isPushConfigured()) {
      throw ApiError.serviceUnavailable('Web Push belum dikonfigurasi (VAPID keys kosong).')
    }
    const input = subscribeSchema.parse(req.body ?? {})

    await query(
      `insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, now(), now())
       on conflict (endpoint) do update set
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         updated_at = now()`,
      [
        newId('ps'),
        req.auth!.userId,
        input.endpoint,
        input.keys.p256dh,
        input.keys.auth,
        input.userAgent ?? null,
      ],
    )

    res.status(204).end()
  }),
)

/* ------------------------------------------------------------------ */
/* Unsubscribe                                                         */
/* ------------------------------------------------------------------ */

const unsubscribeSchema = z.object({
  endpoint: z.string().trim().min(1, 'Endpoint wajib diisi.'),
})

pushRouter.post(
  '/unsubscribe',
  requireAuth,
  wrap(async (req, res) => {
    const input = unsubscribeSchema.parse(req.body ?? {})
    await query(
      'delete from push_subscriptions where endpoint = $1 and user_id = $2',
      [input.endpoint, req.auth!.userId],
    )
    res.status(204).end()
  }),
)

/* ------------------------------------------------------------------ */
/* Cleanup subscription by id (pengurus)                              */
/* ------------------------------------------------------------------ */

pushRouter.delete(
  '/subscriptions/:id',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const { rowCount } = await query('delete from push_subscriptions where id = $1', [req.params.id])
    if (!rowCount) throw ApiError.notFound('Subscription tidak ditemukan.')
    res.status(204).end()
  }),
)
