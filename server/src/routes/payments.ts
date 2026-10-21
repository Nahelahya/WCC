/**
 * Pembayaran biaya administrasi pendaftaran & iuran kas anggota.
 *
 *   POST /api/payments/checkout          buat sesi bayar -> URL halaman bayar
 *   POST /api/payments/doku/notification webhook penyedia pembayaran
 *   GET  /api/payments/mine              riwayat + status iuran milik sendiri
 *   GET  /api/payments/status/:invoice   status publik (dipakai halaman hasil)
 *   GET  /api/payments/config            nominal publik (biaya pendaftaran,
 *                                        iuran bulanan, periode berjalan)
 *   GET  /api/payments                   daftar semua (pengurus)
 *   GET  /api/payments/member/:userId    ringkasan iuran satu anggota (pengurus)
 *   PUT  /api/payments/manual            catat/ubah iuran tunai (pengurus)
 *
 * Alur:
 *  1. Klien memanggil /checkout -> baris `payments` (pending) + sesi pembayaran.
 *  2. Pembeli diarahkan ke halaman pembayaran lalu membayar.
 *  3. Penyedia pembayaran memanggil webhook -> status 'paid' + efek samping:
 *       - 'pendaftaran': registrations.payment_status = 'lunas'
 *       - 'iuran'      : menambah baris transactions (pemasukan "Iuran Anggota")
 *
 * Iuran yang dibayar tunai tidak melewati gateway: pengurus mencatatnya lewat
 * PUT /api/payments/manual (kanal 'cash') agar ikut terhitung lunas dan masuk
 * ke Kas & Treasury.
 */

import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import { query, withTransaction } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { newId } from '../lib/ids'
import { requireAuth, requireRole } from '../middleware/auth'
import { writeAudit } from '../lib/audit'
import { createDokuCheckout, dokuConfigured, verifyDokuNotification } from '../lib/doku'
import { mapPayment, type PaymentRow } from '../lib/mappers'
import { todayISO } from '../lib/time'
import { env } from '../env'

export const paymentRouter = Router()

const PAYMENT_COLUMNS = `
  id, purpose, status, amount, invoice_number, user_id, registration_id, period,
  payer_name, payer_email, payer_phone, channel, doku_session_id, doku_token_id,
  doku_url, paid_at, expires_at, created_at, updated_at
`

/* ------------------------------ utilitas ------------------------------ */

/** Periode (bulan) berjalan menurut WIB, format 'YYYY-MM'. */
function currentPeriod(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).format(date)
}

/** Nomor invoice unik tanpa simbol (aman untuk KKI), maksimal 30 karakter. */
function invoiceNumberFor(purpose: 'pendaftaran' | 'iuran'): string {
  const now = new Date()
  const stamp =
    `${now.getUTCFullYear()}` +
    `${String(now.getUTCMonth() + 1).padStart(2, '0')}` +
    `${String(now.getUTCDate()).padStart(2, '0')}` +
    `${String(now.getUTCHours()).padStart(2, '0')}` +
    `${String(now.getUTCMinutes()).padStart(2, '0')}`
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `WCC${purposeCode(purpose)}${stamp}${rand}`
}

function purposeCode(purpose: 'pendaftaran' | 'iuran'): string {
  return purpose === 'pendaftaran' ? 'P' : 'I'
}

/** URL webhook yang dipakai (dulu didaftarkan ke DOKU). */
function resolvedNotificationUrl(): string {
  if (env.dokuNotificationUrl) return env.dokuNotificationUrl
  return `${env.publicAppUrl}${env.dokuNotificationPath}`
}

/** Path yang ditandatangani DOKU pada notifikasi. */
function notificationTargetPath(): string {
  try {
    return new URL(resolvedNotificationUrl()).pathname
  } catch {
    return env.dokuNotificationPath
  }
}

/**
 * Menyamakan status lokal dengan kenyataan gateway.
 *
 * Gateway hanya mengirim notifikasi untuk transaksi yang benar-benar
 * diselesaikan; invoice yang ditinggalkan pembeli tetap 'pending' selamanya di
 * basis data. Karena itu baris 'pending' yang sudah lewat `expires_at`
 * ditandai 'expired' saat daftar dibaca.
 */
async function expireStalePayments(invoiceNumber?: string): Promise<void> {
  await query(
    `update payments
        set status = 'expired', updated_at = now()
      where status = 'pending' and expires_at is not null and expires_at < now()
        ${invoiceNumber ? 'and invoice_number = $1' : ''}`,
    invoiceNumber ? [invoiceNumber] : [],
  )
}

/** Membuat sesi pembayaran DOKU untuk satu baris `payments`. */
async function createSessionFor(paymentId: string, invoiceNumber: string, description: string, minutes: number) {
  const { rows } = await query<{
    purpose: 'pendaftaran' | 'iuran'
    amount: number
    payer_name: string
    payer_email: string
    payer_phone: string
  }>(`select purpose, amount, payer_name, payer_email, payer_phone from payments where id = $1`, [paymentId])
  const p = rows[0]
  if (!p) throw ApiError.notFound('Pembayaran tidak ditemukan.')

  const result = await createDokuCheckout({
    amount: Math.round(Number(p.amount)),
    invoiceNumber,
    customer: { name: p.payer_name, email: p.payer_email, phone: p.payer_phone },
    callbackUrl: `${env.publicAppUrl}/pembayaran?invoice=${encodeURIComponent(invoiceNumber)}`,
    notificationUrl: resolvedNotificationUrl(),
    paymentDueMinutes: minutes,
    lineItems: [{ name: description, quantity: 1, price: Math.round(Number(p.amount)) }],
  })

  const { rows: updated } = await query<PaymentRow>(
    `update payments
        set doku_url = $2, doku_token_id = $3, doku_session_id = $4, updated_at = now()
      where id = $1
      returning ${PAYMENT_COLUMNS}`,
    [paymentId, result.url, result.tokenId ?? null, result.sessionId ?? null],
  )
  return { payment: updated[0], url: result.url }
}

/* ------------------------- Publik: konfigurasi ------------------------- */

paymentRouter.get(
  '/config',
  wrap(async (_req, res) => {
    res.json({
      configured: dokuConfigured(),
      registrationFee: env.registrationFee,
      monthlyDues: env.monthlyDues,
      period: currentPeriod(),
    })
  }),
)

paymentRouter.get(
  '/status/:invoice',
  wrap(async (req, res) => {
    await expireStalePayments(req.params.invoice)
    const { rows } = await query<PaymentRow>(
      `select ${PAYMENT_COLUMNS} from payments where invoice_number = $1`,
      [req.params.invoice],
    )
    const p = rows[0]
    if (!p) throw ApiError.notFound('Pembayaran tidak ditemukan.')
    // Data publik minimal — cukup untuk menampilkan halaman hasil pembayaran.
    res.json({
      invoiceNumber: p.invoice_number,
      purpose: p.purpose,
      status: p.status,
      amount: Number(p.amount),
      period: p.period ?? undefined,
      channel: p.channel ?? undefined,
      paidAt: p.paid_at ? (p.paid_at instanceof Date ? p.paid_at.toISOString() : String(p.paid_at)) : undefined,
    })
  }),
)

/* ------------------------------ Checkout ------------------------------ */

const checkoutSchema = z.object({
  purpose: z.enum(['pendaftaran', 'iuran']),
  registrationId: z.string().trim().min(1).optional(),
  email: z.string().trim().email('Format email tidak valid.').optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Periode tidak valid.').optional(),
  amount: z.coerce.number().positive('Nominal harus lebih dari 0.').optional(),
  // Kunci idempotensi dari klien (satu per niat bayar). Tanpa ini, pengulangan
  // permintaan tetap ditangani lewat pemakaian ulang tautan pending yang cocok.
  idempotencyKey: z
    .string()
    .trim()
    .min(8, 'Kunci idempotensi tidak valid.')
    .max(128, 'Kunci idempotensi tidak valid.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Kunci idempotensi tidak valid.')
    .optional(),
})

paymentRouter.post(
  '/checkout',
  wrap(async (req, res) => {
    if (!dokuConfigured()) {
      throw ApiError.serviceUnavailable('Pembayaran online belum diaktifkan pengurus.')
    }
    const input = checkoutSchema.parse(req.body ?? {})
    // Idempotensi: kunci yang sama dikembalikan invoice yang sama.
    if (input.idempotencyKey) {
      const prev = await findByIdempotencyKey(input.idempotencyKey)
      if (prev) {
        if (prev.status === 'paid' || isPendingReusable(prev)) {
          res.json({ ...mapPayment(prev), url: prev.doku_url ?? undefined, reused: true })
          return
        }
        throw ApiError.conflict('Sesi pembayaran sebelumnya sudah tidak berlaku. Silakan ulangi pembayaran.')
      }
    }
    if (input.purpose === 'pendaftaran') {
      res.json(await startRegistrationPayment(input))
      return
    }
    res.json(await startDuesPayment(req, input))
  }),
)

interface CheckoutInput {
  purpose: 'pendaftaran' | 'iuran'
  registrationId?: string
  email?: string
  period?: string
  amount?: number
  idempotencyKey?: string
}

/** Mencari pembayaran berdasarkan kunci idempotensi (bila klien mengirimnya). */
async function findByIdempotencyKey(key: string): Promise<PaymentRow | undefined> {
  const { rows } = await query<PaymentRow>(
    `select ${PAYMENT_COLUMNS} from payments where idempotency_key = $1`,
    [key],
  )
  return rows[0]
}

/** True bila tautan pending masih berlaku untuk dipakai ulang. */
function isPendingReusable(p: PaymentRow): boolean {
  if (p.status !== 'pending' || !p.doku_url) return false
  if (!p.expires_at) return false
  return new Date(p.expires_at).getTime() > Date.now()
}

/** Pembayaran biaya administrasi pendaftaran (boleh diakses tanpa login). */
async function startRegistrationPayment(input: CheckoutInput) {
  if (input.registrationId === undefined || input.email === undefined) {
    throw ApiError.badRequest('Data pendaftaran tidak lengkap.')
  }
  const amount = Math.round(env.registrationFee)
  if (amount <= 0) throw ApiError.badRequest('Biaya pendaftaran belum diatur.')

  const { rows } = await query<{
    id: string
    full_name: string
    email: string
    phone: string
    payment_status: string | null
  }>(
    `select id, full_name, email, phone, payment_status
       from registrations where id = $1 and lower(email) = lower($2)`,
    [input.registrationId, input.email],
  )
  const reg = rows[0]
  if (!reg) throw ApiError.notFound('Pendaftaran tidak ditemukan atau email tidak cocok.')
  if (reg.payment_status === 'lunas') {
    throw ApiError.conflict('Biaya administrasi pendaftaran sudah lunas.')
  }

  // Pakai ulang tautan yang masih berlaku agar tidak membuat sesi berulang.
  const { rows: existing } = await query<PaymentRow>(
    `select ${PAYMENT_COLUMNS} from payments
      where registration_id = $1 and purpose = 'pendaftaran' and status = 'pending'
        and expires_at > now()
      order by created_at desc limit 1`,
    [reg.id],
  )
  if (existing[0]?.doku_url) {
    return { ...mapPayment(existing[0]), url: existing[0].doku_url, reused: true }
  }

  const id = newId('pay')
  const invoiceNumber = invoiceNumberFor('pendaftaran')
  let inserted
  try {
    inserted = await query<PaymentRow>(
      `insert into payments
         (id, purpose, status, amount, invoice_number, registration_id, payer_name, payer_email, payer_phone, expires_at, idempotency_key)
       values ($1, 'pendaftaran', 'pending', $2, $3, $4, $5, $6, $7, now() + make_interval(mins => $8), $9)
       returning ${PAYMENT_COLUMNS}`,
      [id, amount, invoiceNumber, reg.id, reg.full_name, reg.email, reg.phone, 60, input.idempotencyKey ?? null],
    )
  } catch (error) {
    // Balapan dua permintaan berkunci sama: yang kalah memakai baris pemenang.
    if (input.idempotencyKey && (error as { code?: string })?.code === '23505') {
      const prev = await findByIdempotencyKey(input.idempotencyKey)
      if (prev) return { ...mapPayment(prev), url: prev.doku_url ?? undefined, reused: true }
    }
    throw error
  }
  try {
    const started = await createSessionFor(id, invoiceNumber, 'Biaya administrasi pendaftaran WCC', 60)
    // Selaraskan metode bayar: niat bayar online tercatat sebagai 'gateway'
    // agar tampilan pengurus tetap benar walau pendaftar awalnya memilih tunai.
    await query(
      `update registrations set payment_method = 'gateway' where id = $1 and payment_method is distinct from 'gateway'`,
      [reg.id],
    ).catch(() => {})
    return { ...mapPayment(started.payment ?? inserted.rows[0]), url: started.url }
  } catch (error) {
    await query(`update payments set status = 'failed', updated_at = now() where id = $1`, [id]).catch(() => {})
    throw error
  }
}

/** Total iuran yang sudah dibayar lunas untuk satu periode. */
async function duesPaid(userId: string, period: string): Promise<number> {
  const { rows } = await query<{ total: number }>(
    `select coalesce(sum(amount), 0)::numeric as total
       from payments
      where purpose = 'iuran' and status = 'paid' and user_id = $1 and period = $2`,
    [userId, period],
  )
  return Number(rows[0]?.total ?? 0)
}

/** Iuran kas anggota (boleh dicicil sampai lunas). */
async function startDuesPayment(req: { auth?: { userId: string; role: string } }, input: CheckoutInput) {
  const userId = req.auth?.userId
  if (!userId) throw ApiError.unauthorized('Silakan masuk untuk membayar iuran.')

  const monthly = Math.round(env.monthlyDues)
  if (monthly <= 0) throw ApiError.badRequest('Iuran bulanan belum diatur.')

  const period = input.period ?? currentPeriod()
  const paid = await duesPaid(userId, period)
  const outstanding = Math.max(0, monthly - paid)
  if (outstanding <= 0) throw ApiError.conflict('Iuran periode ini sudah lunas.')

  const amount = Math.round(input.amount ?? outstanding)
  if (amount <= 0) throw ApiError.badRequest('Nominal pembayaran harus lebih dari 0.')
  if (amount > outstanding) {
    throw ApiError.badRequest(`Sisa iuran periode ini hanya Rp ${outstanding.toLocaleString('id-ID')}.`)
  }

  const { rows: users } = await query<{ name: string; email: string; phone: string | null }>(
    `select name, email, phone from users where id = $1`,
    [userId],
  )
  const user = users[0]
  if (!user) throw ApiError.unauthorized('Akun tidak ditemukan.')

  // Idempotensi alami: tautan pending yang cocok dipakai ulang agar klik ganda
  // / retry tidak menciptakan invoice baru untuk cicilan yang sama.
  const { rows: reusable } = await query<PaymentRow>(
    `select ${PAYMENT_COLUMNS} from payments
      where purpose = 'iuran' and status = 'pending' and user_id = $1 and period = $2
        and amount = $3 and expires_at > now() and doku_url is not null
      order by created_at desc limit 1`,
    [userId, period, amount],
  )
  if (reusable[0]?.doku_url) {
    return { ...mapPayment(reusable[0]), url: reusable[0].doku_url, reused: true }
  }

  const id = newId('pay')
  const invoiceNumber = invoiceNumberFor('iuran')
  let inserted
  try {
    inserted = await query<PaymentRow>(
      `insert into payments
         (id, purpose, status, amount, invoice_number, user_id, period, payer_name, payer_email, payer_phone, expires_at, idempotency_key)
       values ($1, 'iuran', 'pending', $2, $3, $4, $5, $6, $7, $8, now() + make_interval(mins => $9), $10)
       returning ${PAYMENT_COLUMNS}`,
      [id, amount, invoiceNumber, userId, period, user.name, user.email, user.phone, 60, input.idempotencyKey ?? null],
    )
  } catch (error) {
    // Balapan dua permintaan berkunci sama: yang kalah memakai baris pemenang.
    if (input.idempotencyKey && (error as { code?: string })?.code === '23505') {
      const prev = await findByIdempotencyKey(input.idempotencyKey)
      if (prev) return { ...mapPayment(prev), url: prev.doku_url ?? undefined, reused: true }
    }
    throw error
  }
  try {
    const started = await createSessionFor(
      id,
      invoiceNumber,
      `Iuran kas anggota WCC periode ${period}`,
      60,
    )
    return { ...mapPayment(started.payment ?? inserted.rows[0]), url: started.url }
  } catch (error) {
    await query(`update payments set status = 'failed', updated_at = now() where id = $1`, [id]).catch(() => {})
    throw error
  }
}

/* ------------------------- Webhook DOKU ------------------------------- */

interface DokuNotificationBody {
  order?: { invoice_number?: string; amount?: number }
  transaction?: { status?: string; date?: string }
  channel?: { id?: string; name?: string }
}

async function applyPaid(paymentId: string, payload: DokuNotificationBody): Promise<PaymentRow | null> {
  const applied = await withTransaction(async (client) => {
    // Simpan kanal aktual dari gateway (mis. "VIRTUAL_ACCOUNT / BCA ...")
    // agar daftar pengurus menampilkan metode yang benar-benar dipakai.
    const channel = [payload.channel?.id, payload.channel?.name].filter(Boolean).join(' / ') || null
    const { rows } = await client.query<PaymentRow>(
      `update payments
          set status = 'paid', paid_at = now(), channel = coalesce($3, channel),
              notification = $2, updated_at = now()
        where id = $1 and status <> 'paid'
        returning ${PAYMENT_COLUMNS}`,
      [paymentId, JSON.stringify(payload), channel],
    )
    const p = rows[0]
    if (!p) return null

    if (p.purpose === 'pendaftaran' && p.registration_id) {
      await client.query(`update registrations set payment_status = 'lunas' where id = $1`, [
        p.registration_id,
      ])
      // Catat biaya pendaftaran ke kas & treasury.
      const note = `Biaya pendaftaran — ${p.payer_name || 'calon anggota'} (online)`.trim()
      await client.query(
        `insert into transactions (id, date, type, category, amount, note, recorded_by, created_at)
         values ($1, $2, 'pemasukan', 'Biaya Pendaftaran', $3, $4, $5, now())`,
        [newId('t'), todayISO(), p.amount, note, 'Pembayaran Online'],
      )
    }

    if (p.purpose === 'iuran' && p.user_id) {
      const note = `Iuran ${p.period ?? ''} — ${p.payer_name || 'anggota'} (online)`.trim()
      await client.query(
        `insert into transactions (id, date, type, category, amount, note, recorded_by, created_at)
         values ($1, $2, 'pemasukan', 'Iuran Anggota', $3, $4, $5, now())`,
        [newId('t'), todayISO(), p.amount, note, 'Pembayaran Online'],
      )
    }
    return p
  })

  if (applied) {
    await writeAudit({
      userId: applied.user_id ?? null,
      action: 'create',
      entity: 'payment',
      entityId: applied.id,
      detail: {
        status: applied.status,
        purpose: applied.purpose,
        invoiceNumber: applied.invoice_number,
        amount: Number(applied.amount),
      },
    }).catch(() => {})
  }
  return applied
}

/**
 * Rekonsiliasi: pastikan setiap pembayaran iuran yang 'paid' memiliki baris
 * transaksi kas yang sesuai. Idempoten - aman dipanggil berulang.
 */
async function reconcilePaidPayments(): Promise<number> {
  const { rows: paid } = await query<PaymentRow>(
    `select ${PAYMENT_COLUMNS} from payments where status = 'paid'`,
  )
  let created = 0
  for (const p of paid) {
    const { rows: existing } = await query<{ id: string }>(
      `select id from transactions where payment_id = $1 limit 1`,
      [p.id],
    )
    if (existing[0]) continue
    const dateStr = p.paid_at
      ? (p.paid_at instanceof Date ? p.paid_at : new Date(p.paid_at)).toISOString().slice(0, 10)
      : todayISO()

    if (p.purpose === 'iuran') {
      const note = `Iuran ${p.period ?? ''} — ${p.payer_name || 'anggota'} (online)`.trim()
      const { rows: byNote } = await query<{ id: string }>(
        `select id from transactions where category = 'Iuran Anggota' and amount = $1 and note = $2 limit 1`,
        [p.amount, note],
      )
      if (byNote[0]) {
        await query(`update transactions set payment_id = $1 where id = $2`, [p.id, byNote[0].id])
        created++
        continue
      }
      await query(
        `insert into transactions (id, date, type, category, amount, note, recorded_by, payment_id, created_at)
         values ($1, $2, 'pemasukan', 'Iuran Anggota', $3, $4, $5, $6, now())`,
        [newId('t'), dateStr, p.amount, note, 'Pembayaran Online', p.id],
      )
      created++
    } else if (p.purpose === 'pendaftaran') {
      const note = `Biaya pendaftaran — ${p.payer_name || 'calon anggota'} (online)`.trim()
      const { rows: byNote } = await query<{ id: string }>(
        `select id from transactions where category = 'Biaya Pendaftaran' and amount = $1 and note = $2 limit 1`,
        [p.amount, note],
      )
      if (byNote[0]) {
        created++
        continue
      }
      await query(
        `insert into transactions (id, date, type, category, amount, note, recorded_by, created_at)
         values ($1, $2, 'pemasukan', 'Biaya Pendaftaran', $3, $4, $5, now())`,
        [newId('t'), dateStr, p.amount, note, 'Pembayaran Online'],
      )
      created++
    }
  }
  return created
}

// Endpoint rekonsiliasi manual (khusus pengurus).
paymentRouter.post(
  '/reconcile',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (_req, res) => {
    const created = await reconcilePaidPayments()
    res.json({ ok: true, created })
  }),
)

/**
 * Webhook DOKU. Tidak boleh pakai express.json() global — body mentah dipakai
 * untuk memverifikasi tanda tangan HMAC (lihat app.ts).
 */
paymentRouter.post(
  '/doku/notification',
  wrap(async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : ''
    const headers = {
      clientId: req.header('client-id'),
      requestId: req.header('request-id'),
      requestTimestamp: req.header('request-timestamp'),
      signature: req.header('signature'),
    }

    if (!rawBody || !verifyDokuNotification(rawBody, headers, notificationTargetPath())) {
      console.warn('Notifikasi DOKU ditolak: tanda tangan tidak valid / body kosong.')
      res.status(401).json({ message: 'Tanda tangan tidak valid.' })
      return
    }

    let payload: DokuNotificationBody
    try {
      payload = JSON.parse(rawBody) as DokuNotificationBody
    } catch {
      res.status(400).json({ message: 'Body notifikasi tidak valid.' })
      return
    }

    const invoiceNumber = payload.order?.invoice_number
    if (!invoiceNumber) {
      res.json({ ok: true })
      return
    }

    const { rows } = await query<PaymentRow>(
      `select ${PAYMENT_COLUMNS} from payments where invoice_number = $1`,
      [invoiceNumber],
    )
    const payment = rows[0]
    if (!payment) {
      // Balas 200 agar DOKU tidak mengulang terus untuk invoice yang tak dikenal.
      console.warn(`Notifikasi DOKU untuk invoice tak dikenal: ${invoiceNumber}`)
      res.json({ ok: true })
      return
    }

    const status = String(payload.transaction?.status ?? '').toUpperCase()
    if (status === 'SUCCESS') {
      await applyPaid(payment.id, payload)
    } else if (status === 'FAILED' || status === 'EXPIRED') {
      await query(
        `update payments set status = $2, notification = $3, updated_at = now()
          where id = $1 and status = 'pending'`,
        [payment.id, status === 'FAILED' ? 'failed' : 'expired', JSON.stringify(payload)],
      )
    }

    res.json({ ok: true })
  }),
)

/* ------------------------------ Anggota ------------------------------- */

paymentRouter.get(
  '/mine',
  requireAuth,
  wrap(async (req, res) => {
    const userId = req.auth!.userId
    const period = currentPeriod()
    await expireStalePayments()
    const monthly = Math.max(0, Math.round(env.monthlyDues))
    const paid = await duesPaid(userId, period)
    const outstanding = Math.max(0, monthly - paid)

    const { rows } = await query<PaymentRow>(
      `select ${PAYMENT_COLUMNS} from payments
        where user_id = $1
        order by created_at desc limit 100`,
      [userId],
    )

    res.json({
      dues: {
        period,
        monthlyAmount: monthly,
        paidAmount: paid,
        outstanding,
        status: outstanding <= 0 && monthly > 0 ? 'lunas' : paid > 0 ? 'sebagian' : 'belum',
      },
      payments: rows.map(mapPayment),
    })
  }),
)

/* ------------------------------ Pengurus ------------------------------ */

paymentRouter.get(
  '/',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const q = z
      .object({
        purpose: z.enum(['pendaftaran', 'iuran']).optional(),
        status: z.enum(['pending', 'paid', 'expired', 'failed']).optional(),
        limit: z.coerce.number().int().min(1).max(500).optional(),
      })
      .parse(req.query ?? {})

    await expireStalePayments()

    const conditions: string[] = []
    const params: unknown[] = []
    if (q.purpose) {
      params.push(q.purpose)
      conditions.push(`purpose = $${params.length}`)
    }
    if (q.status) {
      params.push(q.status)
      conditions.push(`status = $${params.length}`)
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : ''
    params.push(q.limit ?? 200)

    const [{ rows }, totals] = await Promise.all([
      query<PaymentRow>(
        `select ${PAYMENT_COLUMNS} from payments ${where}
          order by created_at desc limit $${params.length}`,
        params,
      ),
      query<{ paid: number; pending: number }>(
        `select
           coalesce(sum(case when status = 'paid' then amount else 0 end), 0)::numeric as paid,
           coalesce(sum(case when status = 'pending' then amount else 0 end), 0)::numeric as pending
         from payments`,
      ),
    ])

    res.json({
      payments: rows.map(mapPayment),
      totals: {
        paid: Number(totals.rows[0]?.paid ?? 0),
        pending: Number(totals.rows[0]?.pending ?? 0),
      },
    })
  }),
)

/* --------------------- Iuran tunai (dicatat pengurus) ------------------ */

/** Ringkasan iuran satu anggota untuk sebuah periode (dipakai halaman pengurus). */
async function memberDuesView(userId: string, period: string) {
  const { rows: users } = await query<{ id: string; name: string }>(
    `select id, name from users where id = $1`,
    [userId],
  )
  const user = users[0]
  if (!user) throw ApiError.notFound('Anggota tidak ditemukan.')

  const monthly = Math.max(0, Math.round(env.monthlyDues))
  const paid = await duesPaid(userId, period)
  const outstanding = Math.max(0, monthly - paid)

  const { rows: breakdown } = await query<{ online: number; manual: number }>(
    `select
       coalesce(sum(case when channel is distinct from 'cash' then amount else 0 end), 0)::numeric as online,
       coalesce(sum(case when channel = 'cash' then amount else 0 end), 0)::numeric as manual
      from payments
      where purpose = 'iuran' and status = 'paid' and user_id = $1 and period = $2`,
    [userId, period],
  )

  const { rows } = await query<PaymentRow>(
    `select ${PAYMENT_COLUMNS} from payments
      where purpose = 'iuran' and user_id = $1 and period = $2
      order by created_at desc`,
    [userId, period],
  )

  return {
    user: { id: user.id, name: user.name },
    dues: {
      period,
      monthlyAmount: monthly,
      paidAmount: paid,
      outstanding,
      status: outstanding <= 0 && monthly > 0 ? 'lunas' : paid > 0 ? 'sebagian' : 'belum',
    },
    manualAmount: Number(breakdown[0]?.manual ?? 0),
    onlineAmount: Number(breakdown[0]?.online ?? 0),
    payments: rows.map(mapPayment),
  }
}

const periodSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Periode tidak valid.')

paymentRouter.get(
  '/member/:userId',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const period =
      z.object({ period: periodSchema.optional() }).parse(req.query ?? {}).period ?? currentPeriod()
    await expireStalePayments()
    res.json(await memberDuesView(req.params.userId, period))
  }),
)

const manualSchema = z.object({
  userId: z.string().trim().min(1, 'Anggota wajib dipilih.'),
  period: periodSchema,
  amount: z.coerce.number().min(0, 'Nominal tidak boleh negatif.').max(100_000_000),
})

/**
 * Mencatat / mengubah / menghapus iuran yang dibayar tunai (kanal 'cash').
 *
 * Nominal 0 berarti menghapus catatan tunai periode tersebut (mis. salah catat).
 * Baris `transactions` yang tertaut ikut diperbarui/dihapus sehingga Kas &
 * Treasury tetap sinkron.
 */
paymentRouter.put(
  '/manual',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const input = manualSchema.parse(req.body ?? {})
    const amount = Math.round(input.amount)

    const { rows: users } = await query<{ name: string; email: string; phone: string | null }>(
      `select name, email, phone from users where id = $1`,
      [input.userId],
    )
    const user = users[0]
    if (!user) throw ApiError.notFound('Anggota tidak ditemukan.')

    const { rows: me } = await query<{ name: string }>(`select name from users where id = $1`, [
      req.auth!.userId,
    ])
    const recordedBy = me[0]?.name ?? 'Pengurus'
    const today = todayISO()

    await withTransaction(async (client) => {
      // Kunci penasihat per (anggota, periode) agar dua penyimpanan tunai yang
      // bersamaan tidak menciptakan baris ganda — PUT tetap idempoten.
      await client.query('select pg_advisory_xact_lock(hashtext($1)::bigint)', [
        `manual-dues:${input.userId}:${input.period}`,
      ])
      const { rows: existing } = await client.query<PaymentRow>(
        `select ${PAYMENT_COLUMNS} from payments
          where purpose = 'iuran' and channel = 'cash' and user_id = $1 and period = $2
          order by created_at desc limit 1`,
        [input.userId, input.period],
      )
      const payment = existing[0]

      if (amount <= 0) {
        // ON DELETE CASCADE ikut menghapus baris transaksi kas yang tertaut.
        if (payment) await client.query(`delete from payments where id = $1`, [payment.id])
        return
      }

      const note = `Iuran ${input.period} — ${user.name} (tunai)`

      if (payment) {
        await client.query(
          `update payments
              set amount = $2, payer_name = $3, paid_at = now(), updated_at = now()
            where id = $1`,
          [payment.id, amount, user.name],
        )
        const { rowCount } = await client.query(
          `update transactions set amount = $2, note = $3, recorded_by = $4 where payment_id = $1`,
          [payment.id, amount, note, recordedBy],
        )
        if (!rowCount) {
          await client.query(
            `insert into transactions (id, date, type, category, amount, note, recorded_by, payment_id, created_at)
             values ($1, $2, 'pemasukan', 'Iuran Anggota', $3, $4, $5, $6, now())`,
            [newId('t'), today, amount, note, recordedBy, payment.id],
          )
        }
        return
      }

      const id = newId('pay')
      await client.query(
        `insert into payments
           (id, purpose, status, amount, invoice_number, user_id, period,
            payer_name, payer_email, payer_phone, channel, paid_at)
         values ($1, 'iuran', 'paid', $2, $3, $4, $5, $6, $7, $8, 'cash', now())`,
        [
          id,
          amount,
          invoiceNumberFor('iuran'),
          input.userId,
          input.period,
          user.name,
          user.email,
          user.phone ?? '',
        ],
      )
      await client.query(
        `insert into transactions (id, date, type, category, amount, note, recorded_by, payment_id, created_at)
         values ($1, $2, 'pemasukan', 'Iuran Anggota', $3, $4, $5, $6, now())`,
        [newId('t'), today, amount, note, recordedBy, id],
      )
    })

    await writeAudit({
      userId: input.userId,
      action: amount > 0 ? 'update' : 'delete',
      entity: 'payment',
      entityId: `${input.userId}:${input.period}`,
      detail: { purpose: 'iuran', period: input.period, amount, channel: 'cash' },
    }).catch(() => {})

    res.json(await memberDuesView(input.userId, input.period))
  }),
)
