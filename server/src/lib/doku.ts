// Klien DOKU Checkout (REST, non-SNAP).
//   POST {base}/checkout/v1/payment  -> membuat sesi pembayaran & URL halaman.
//
// Skema tanda tangan DOKU (HMAC-SHA256, hasil base64):
//   stringToSign = "Client-Id:<cid>\n"
//                + "Request-Id:<rid>\n"
//                + "Request-Timestamp:<iso8601>\n"
//                + "Request-Target:<path>\n"
//                + "Digest:<base64(sha256(body))>"
//   header Signature = "HMACSHA256=" + base64(hmac_sha256(stringToSign, secretKey))
//
// Notifikasi (webhook) memakai skema yang sama; Request-Target adalah path
// URL notifikasi yang kita daftarkan ke DOKU.

import crypto from 'node:crypto'
import { env } from '../env'
import { ApiError } from './errors'

/** True bila kredensial DOKU (Client-Id + Secret Key) sudah diisi. */
export function dokuConfigured(): boolean {
  return Boolean(env.dokuClientId && env.dokuSecretKey)
}

export interface DokuCustomer {
  name?: string
  email?: string
  phone?: string
}

export interface DokuLineItem {
  name: string
  quantity: number
  price: number
}

export interface DokuCheckoutInput {
  amount: number
  invoiceNumber: string
  customer?: DokuCustomer
  /** URL halaman DOKU saat pembeli menekan "Kembali". */
  callbackUrl?: string
  /** URL notifikasi (webhook) untuk transaksi ini. */
  notificationUrl?: string
  /** Menit masa berlaku halaman pembayaran. Default 60. */
  paymentDueMinutes?: number
  lineItems?: DokuLineItem[]
}

export interface DokuCheckoutResult {
  url: string
  tokenId?: string
  sessionId?: string
  /** Format DOKU: YYYYMMDDHHmmss (WIB). */
  expiresAt?: string
  raw: unknown
}

const KEY_TARGET_CHECKOUT = '/checkout/v1/payment'

function sha256Base64(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('base64')
}

function sign(
  clientId: string,
  requestId: string,
  timestamp: string,
  target: string,
  body: string,
  secretKey: string,
): string {
  const stringToSign = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${target}`,
    `Digest:${sha256Base64(body)}`,
  ].join('\n')
  return crypto.createHmac('sha256', secretKey).update(stringToSign, 'utf8').digest('base64')
}

/** ISO-8601 UTC tanpa milidetik, mis. 2026-10-14T05:51:45Z. */
function isoUtc(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

interface DokuErrorBody {
  error?: { message?: string; code?: string }
  error_messages?: string[]
  message?: string | string[]
}

function describeError(json: DokuErrorBody | null, status: number): string {
  const fromError = json?.error?.message
  if (fromError) return fromError
  if (Array.isArray(json?.error_messages) && json.error_messages.length) {
    return json.error_messages.join('; ')
  }
  if (Array.isArray(json?.message) && json.message.length) return json.message.join('; ')
  if (typeof json?.message === 'string') return json.message
  return `DOKU menolak permintaan (HTTP ${status}).`
}

/**
 * Membuat sesi pembayaran DOKU Checkout dan mengembalikan URL halaman
 * (hosted redirect) yang harus dibuka pembeli.
 */
export async function createDokuCheckout(input: DokuCheckoutInput): Promise<DokuCheckoutResult> {
  if (!dokuConfigured()) {
    throw ApiError.serviceUnavailable(
      'Pembayaran online belum dikonfigurasi. Hubungi pengurus.',
    )
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw ApiError.badRequest('Nominal pembayaran tidak valid.')
  }

  const requestId = crypto.randomUUID()
  const timestamp = isoUtc()

  const payload: Record<string, unknown> = {
    order: {
      amount: Math.round(input.amount),
      invoice_number: input.invoiceNumber,
      currency: 'IDR',
      ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
      ...(input.lineItems?.length
        ? {
            line_items: input.lineItems.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
            })),
          }
        : {}),
    },
    payment: { payment_due_date: input.paymentDueMinutes ?? 60 },
  }

  if (input.customer && (input.customer.name || input.customer.email || input.customer.phone)) {
    payload.customer = {
      ...(input.customer.name ? { name: input.customer.name } : {}),
      ...(input.customer.email ? { email: input.customer.email } : {}),
      ...(input.customer.phone ? { phone: input.customer.phone } : {}),
    }
  }

  if (input.notificationUrl) {
    payload.additional_info = { override_notification_url: input.notificationUrl }
  }

  const body = JSON.stringify(payload)
  const signature = sign(
    env.dokuClientId,
    requestId,
    timestamp,
    KEY_TARGET_CHECKOUT,
    body,
    env.dokuSecretKey,
  )

  let response: Response
  try {
    response = await fetch(`${env.dokuBaseUrl}${KEY_TARGET_CHECKOUT}`, {
      method: 'POST',
      headers: {
        'Client-Id': env.dokuClientId,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        Signature: `HMACSHA256=${signature}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    throw ApiError.badGateway(`Gagal menghubungi DOKU: ${(error as Error).message}`)
  }

  const text = await response.text()
  let json: Record<string, unknown> | null = null
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null
  } catch {
    /* biarkan null */
  }

  if (!response.ok) {
    throw ApiError.badGateway(describeError(json as DokuErrorBody | null, response.status))
  }

  const res = (json?.response ?? {}) as {
    order?: { session_id?: string }
    payment?: { url?: string; token_id?: string; expired_date?: string }
  }
  const url = res.payment?.url
  if (!url) throw ApiError.badGateway('DOKU tidak mengembalikan URL pembayaran.')

  return {
    url,
    tokenId: res.payment?.token_id,
    sessionId: res.order?.session_id,
    expiresAt: res.payment?.expired_date,
    raw: json,
  }
}

export interface DokuNotificationHeaders {
  clientId?: string
  requestId?: string
  requestTimestamp?: string
  signature?: string
}

/**
 * Memverifikasi tanda tangan notifikasi (webhook) DOKU.
 *
 * `requestTarget` harus sama persis dengan path URL notifikasi yang kita
 * daftarkan (contoh: `/api/payments/doku/notification`).
 */
const REQUEST_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000 // ±5 menit

function isoToUnixMs(value: string | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

function isTimestampWithinTolerance(requestTimestamp: string | undefined): boolean {
  const ms = isoToUnixMs(requestTimestamp)
  if (ms === null) return false
  const now = Date.now()
  return Math.abs(now - ms) <= REQUEST_TIMESTAMP_TOLERANCE_MS
}

export function verifyDokuNotification(
  rawBody: string,
  headers: DokuNotificationHeaders,
  requestTarget: string,
): boolean {
  const { clientId, requestId, requestTimestamp, signature } = headers
  if (!clientId || !requestId || !requestTimestamp || !signature) return false
  // Hanya terima notifikasi yang mengatasnamakan akun DOKU kita.
  if (env.dokuClientId && clientId !== env.dokuClientId) return false
  if (!env.dokuSecretKey) return false
  // Bandingkan waktu server dengan Request-Timestamp yang dikirim DOKU.
  // Buffer ±5 menit dari jam server guna mencegah replay.
  if (!isTimestampWithinTolerance(requestTimestamp)) return false

  const expected = `HMACSHA256=${sign(
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    rawBody,
    env.dokuSecretKey,
  )}`

  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Menghasilkan `Signature` header yang valid (dipakai juga oleh skrip uji). */
export function dokuSignature(
  clientId: string,
  requestId: string,
  timestamp: string,
  target: string,
  body: string,
  secretKey: string,
): string {
  return sign(clientId, requestId, timestamp, target, body, secretKey)
}
