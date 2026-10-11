import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../env'

/**
 * Abstraksi pengiriman email.
 *
 * - Bila `SMTP_HOST` diisi pada `server/.env`, email dikirim sungguhan lewat
 *   nodemailer (SMTP).
 * - Bila belum dikonfigurasi, email **ditulis ke log server** supaya alur
 *   (mis. tautan reset password) tetap bisa diuji tanpa penyedia email.
 */

export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

let transporter: Transporter | null = null

export function isSmtpConfigured(): boolean {
  return Boolean(env.smtpHost)
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

/** Ringkasan konfigurasi email untuk ditampilkan saat server menyala. */
export function mailerStatus(): string {
  return isSmtpConfigured() ? `aktif (SMTP ${env.smtpHost}:${env.smtpPort})` : 'mode log (SMTP belum dikonfigurasi)'
}

/** Mengirim email. Bila SMTP belum dikonfigurasi, isi email ditulis ke log. */
export async function sendMail(message: MailMessage): Promise<void> {
  const tx = getTransporter()
  if (!tx) {
    console.log('\n──────── EMAIL (mode log — SMTP belum dikonfigurasi) ────────')
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
