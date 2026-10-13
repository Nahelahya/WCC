import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../env'

/**
 * Abstraksi pengiriman email. Tiga mode, dipilih otomatis:
 *
 * 1. **Hostinger Mail API** — bila `HOSTINGER_MAIL_API_TOKEN` diisi. Email
 *    dikirim lewat HTTP API (`api.mail.hostinger.com`), cocok untuk server
 *    Hostinger karena tidak butuh password kotak surat/SMTP.
 * 2. **SMTP** — bila `SMTP_HOST` diisi. Dikirim lewat nodemailer.
 * 3. **Log** — bila keduanya kosong, isi email ditulis ke log server supaya
 *    alur (mis. tautan reset password / OTP) tetap bisa diuji.
 */

export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

let transporter: Transporter | null = null
let hostingerMailboxIdCache: string | null = null

/** True bila Hostinger Mail API dikonfigurasi. */
export function isMailApiConfigured(): boolean {
  return Boolean(env.hostingerMailApiToken)
}

/** True bila SMTP dikonfigurasi. */
export function isSmtpConfigured(): boolean {
  return Boolean(env.smtpHost)
}

/** True bila email benar-benar dikirim (lewat Mail API atau SMTP). */
export function isMailerConfigured(): boolean {
  return isMailApiConfigured() || isSmtpConfigured()
}

function getTransporter(): Transporter | null {
  if (!isSmtpConfigured()) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    })
  }
  return transporter
}

/** Nama pengirim ("WISANGGENI CLIMBING CLUB") yang diambil dari `MAIL_FROM`. */
function senderDisplayName(): string {
  const match = /^\s*"?([^"<]*?)"?\s*</.exec(env.mailFrom)
  return (match?.[1] ?? '').trim() || 'WISANGGENI CLIMBING CLUB'
}

/** Alamat pada `MAIL_FROM` (mis. `pengurus@wisanggeniclub.site`), bila ada. */
function mailFromAddress(): string {
  const angled = /<([^>]+)>/.exec(env.mailFrom)
  if (angled) return angled[1].trim().toLowerCase()
  return env.mailFrom.trim().toLowerCase()
}

/**
 * Menentukan resource ID kotak surat yang dikelola token. Bila
 * `HOSTINGER_MAIL_MAILBOX_ID` kosong, diambil dari `GET /api/v1/me` dan
 * dipilih kotak surat yang cocok dengan `MAIL_FROM` (atau yang pertama).
 */
async function resolveMailboxId(): Promise<string> {
  if (env.hostingerMailMailboxId) return env.hostingerMailMailboxId
  if (hostingerMailboxIdCache) return hostingerMailboxIdCache

  const res = await fetch(`${env.hostingerMailApiUrl}/api/v1/me`, {
    headers: {
      Authorization: `Bearer ${env.hostingerMailApiToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Hostinger Mail API: gagal membaca akun (HTTP ${res.status}).`)
  }

  const body = (await res.json()) as {
    data?: { mailboxes?: Array<{ resourceId?: string; address?: string }> }
  }
  const mailboxes = (body.data?.mailboxes ?? []).filter((box) => box.resourceId)
  if (mailboxes.length === 0) {
    throw new Error('Hostinger Mail API: token tidak memiliki kotak surat.')
  }

  const wanted = mailFromAddress()
  const chosen =
    mailboxes.find((box) => (box.address ?? '').trim().toLowerCase() === wanted) ?? mailboxes[0]
  hostingerMailboxIdCache = chosen.resourceId as string
  return hostingerMailboxIdCache
}

async function sendViaMailApi(message: MailMessage): Promise<void> {
  const mailboxId = await resolveMailboxId()
  const res = await fetch(`${env.hostingerMailApiUrl}/api/v1/mailboxes/${mailboxId}/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.hostingerMailApiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      to: [message.to],
      displayName: senderDisplayName(),
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `Hostinger Mail API: gagal mengirim (HTTP ${res.status})${detail ? ` — ${detail.slice(0, 300)}` : ''}`,
    )
  }
}

/** Ringkasan konfigurasi email untuk ditampilkan saat server menyala. */
export function mailerStatus(): string {
  if (isMailApiConfigured()) return 'aktif (Hostinger Mail API)'
  return isSmtpConfigured()
    ? `aktif (SMTP ${env.smtpHost}:${env.smtpPort})`
    : 'mode log (email belum dikonfigurasi)'
}

/** Mengirim email. Bila belum dikonfigurasi, isi email ditulis ke log. */
export async function sendMail(message: MailMessage): Promise<void> {
  if (isMailApiConfigured()) {
    await sendViaMailApi(message)
    return
  }

  const tx = getTransporter()
  if (!tx) {
    console.log('\n──────── EMAIL (mode log — email belum dikonfigurasi) ────────')
    console.log(`  Kepada : ${message.to}`)
    console.log(`  Subjek : ${message.subject}`)
    console.log(
      message.text
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n'),
    )
    console.log('────────────────────────────────────────────────────────────\n')
    return
  }

  await tx.sendMail({
    from: env.mailFrom,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  })
}
