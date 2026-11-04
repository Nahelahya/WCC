import webpush from 'web-push'

import { env } from '../env'
import { query } from '../db/pool'

export type PushPayload = {
  title: string
  body?: string
  url?: string
  icon?: string
}

export function isPushConfigured(): boolean {
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey && env.vapidSubject)
}

// Inisialisasi VAPID sekali saat modul dimuat (bila configured).
if (isPushConfigured()) {
  try {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey)
  } catch (err) {
    console.warn('[push] Gagal menginisialisasi VAPID:', err instanceof Error ? err.message : err)
  }
}

interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

function toSubscription(row: PushSubscriptionRow) {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  }
}

async function sendToRows(rows: PushSubscriptionRow[], payload: PushPayload): Promise<void> {
  if (!isPushConfigured()) {
    console.warn('[push] Web Push belum dikonfigurasi (VAPID keys kosong); pengiriman dilewati.')
    return
  }

  const json = JSON.stringify(payload)

  const jobs = rows.map((row) => {
    const sub = toSubscription(row)
    return webpush
      .sendNotification(sub, json)
      .then(() => undefined)
      .catch(async (err: unknown) => {
        const status = (err as { statusCode?: number } | null)?.statusCode
        if (status === 404 || status === 410) {
          try {
            await query('delete from push_subscriptions where endpoint = $1', [row.endpoint])
          } catch (delErr) {
            console.warn('[push] gagal menghapus subscription kedaluwarsa:', delErr instanceof Error ? delErr.message : delErr)
          }
        } else {
          console.warn(
            `[push] gagal mengirim ke ${row.endpoint}:`,
            status ?? '',
            err instanceof Error ? err.message : err,
          )
        }
      })
  })

  await Promise.allSettled(jobs)
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!isPushConfigured()) {
      console.warn('[push] Web Push belum dikonfigurasi (VAPID keys kosong); pengiriman dilewati.')
      return
    }
    const { rows } = await query<PushSubscriptionRow>(
      'select id, user_id, endpoint, p256dh, auth from push_subscriptions where user_id = $1',
      [userId],
    )
    await sendToRows(rows, payload)
  } catch (err) {
    console.warn('[push] sendPushToUser gagal:', err instanceof Error ? err.message : err)
  }
}

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  try {
    if (!isPushConfigured()) {
      console.warn('[push] Web Push belum dikonfigurasi (VAPID keys kosong); pengiriman dilewati.')
      return
    }
    const { rows } = await query<PushSubscriptionRow>(
      'select id, user_id, endpoint, p256dh, auth from push_subscriptions',
    )
    await sendToRows(rows, payload)
  } catch (err) {
    console.warn('[push] sendPushToAll gagal:', err instanceof Error ? err.message : err)
  }
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  try {
    if (!isPushConfigured()) {
      console.warn('[push] Web Push belum dikonfigurasi (VAPID keys kosong); pengiriman dilewati.')
      return
    }
    if (!userIds || userIds.length === 0) return
    const { rows } = await query<PushSubscriptionRow>(
      'select id, user_id, endpoint, p256dh, auth from push_subscriptions where user_id = any($1::text[])',
      [userIds],
    )
    await sendToRows(rows, payload)
  } catch (err) {
    console.warn('[push] sendPushToUsers gagal:', err instanceof Error ? err.message : err)
  }
}
