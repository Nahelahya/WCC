import { env } from '../env'
import type { MailMessage } from './mailer'

function greeting(name: string): string {
  return `Halo ${name},`
}

const SIGNATURE = 'Salam,\nPengurus WISANGGENI CLIMBING CLUB'

function greetingHtml(name: string): string {
  return `Halo ${escapeHtml(name)},`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function signatureHtml(): string {
  return SIGNATURE.replace('\n', '<br>')
}

export function resetPasswordEmail(to: string, name: string, token: string): MailMessage {
  const link = `${env.publicAppUrl}/reset-password?token=${encodeURIComponent(token)}`
  const text = [
    greeting(name),
    '',
    'Kami menerima permintaan untuk mengatur ulang password akun WISANGGENI CLIMBING CLUB Anda.',
    'Buka tautan berikut untuk membuat password baru:',
    '',
    link,
    '',
    'Tautan ini hanya berlaku sementara dan hanya bisa dipakai sekali. Bila Anda tidak meminta ini, abaikan email ini — password Anda tetap aman.',
    '',
    SIGNATURE,
  ].join('\n')

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#1d2b28;line-height:1.6;max-width:560px">
      <p>${greetingHtml(name)}</p>
      <p>Kami menerima permintaan untuk mengatur ulang password akun <strong>WISANGGENI CLIMBING CLUB</strong> Anda.</p>
      <p><a href="${link}" style="display:inline-block;background:#173F35;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Buat password baru</a></p>
      <p style="font-size:13px;color:#5b6b67">Atau salin tautan ini ke peramban:<br>${escapeHtml(link)}</p>
      <p style="font-size:13px;color:#5b6b67">Tautan berlaku terbatas dan hanya bisa dipakai sekali. Bila Anda tidak meminta ini, abaikan email ini — password Anda tetap aman.</p>
      <p>${signatureHtml()}</p>
    </div>`

  return { to, subject: 'Pemulihan password akun WCC', text, html }
}

export function passwordResetOtpEmail(to: string, name: string, otp: string): MailMessage {
  const text = [
    greeting(name),
    '',
    'Kode OTP untuk mengatur ulang password akun WISANGGENI CLIMBING CLUB Anda:',
    '',
    otp,
    '',
    'Kode ini berlaku 5 menit, hanya bisa dipakai sekali, dan dibatasi 5 kali percobaan salah.',
    'Jika Anda tidak meminta ini, abaikan email ini — password Anda tetap aman.',
    '',
    SIGNATURE,
  ].join('\n')

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#1d2b28;line-height:1.6;max-width:560px">
      <p>${greetingHtml(name)}</p>
      <p>Kode OTP untuk mengatur ulang password akun <strong>WISANGGENI CLIMBING CLUB</strong> Anda:</p>
      <div style="display:inline-block;background:#f5f7f6;border:1px solid #e6eeeb;border-radius:12px;padding:16px 20px;margin:8px 0 12px">
        <div style="font-size:28px;letter-spacing:8px;font-weight:700;color:#173F35;text-align:center">${escapeHtml(otp)}</div>
      </div>
      <p style="font-size:13px;color:#5b6b67">Berlaku 5 menit • Hanya bisa dipakai sekali • Maksimal 5 kali percobaan salah.<br>Jika Anda tidak meminta ini, abaikan email ini.</p>
      <p>${signatureHtml()}</p>
    </div>`

  return { to, subject: 'Kode OTP pemulihan password', text, html }
}

export function emailVerifyOtpEmail(to: string, name: string, otp: string): MailMessage {
  const text = [
    greeting(name),
    '',
    'Kode OTP untuk memverifikasi alamat email Anda pada pendaftaran WISANGGENI CLIMBING CLUB:',
    '',
    otp,
    '',
    'Kode ini berlaku 5 menit dan hanya bisa dipakai sekali.',
    '',
    SIGNATURE,
  ].join('\n')

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#1d2b28;line-height:1.6;max-width:560px">
      <p>${greetingHtml(name)}</p>
      <p>Kode OTP untuk memverifikasi alamat email Anda:</p>
      <div style="display:inline-block;background:#f5f7f6;border:1px solid #e6eeeb;border-radius:12px;padding:16px 20px;margin:8px 0 12px">
        <div style="font-size:28px;letter-spacing:8px;font-weight:700;color:#173F35;text-align:center">${escapeHtml(otp)}</div>
      </div>
      <p style="font-size:13px;color:#5b6b67">Berlaku 5 menit • Hanya bisa dipakai sekali.</p>
      <p>${signatureHtml()}</p>
    </div>`

  return { to, subject: 'Verifikasi email pendaftaran WCC', text, html }
}

export function registrationReceivedEmail(to: string, fullName: string): MailMessage {
  const text = [
    greeting(fullName),
    '',
    'Terima kasih telah mendaftar sebagai anggota WISANGGENI CLIMBING CLUB.',
    'Pendaftaran Anda sudah kami terima dan sedang ditinjau oleh pengurus.',
    'Anda dapat memeriksa status pendaftaran kapan saja di:',
    '',
    `${env.publicAppUrl}/daftar/status`,
    '',
    'Kami akan mengirim email lagi begitu status pendaftaran Anda diperbarui.',
    '',
    SIGNATURE,
  ].join('\n')

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#1d2b28;line-height:1.6;max-width:560px">
      <p>${greetingHtml(fullName)}</p>
      <p>Terima kasih telah mendaftar sebagai anggota <strong>WISANGGENI CLIMBING CLUB</strong>. Pendaftaran Anda sudah kami terima dan sedang ditinjau oleh pengurus.</p>
      <p><a href="${env.publicAppUrl}/daftar/status" style="color:#173F35;font-weight:600">Cek status pendaftaran</a></p>
      <p>Kami akan mengirim email lagi begitu status pendaftaran Anda diperbarui.</p>
      <p>${signatureHtml()}</p>
    </div>`

  return { to, subject: 'Pendaftaran Anda telah kami terima', text, html }
}

export function registrationDecisionEmail(
  to: string,
  fullName: string,
  status: 'diverifikasi' | 'ditolak',
  note?: string,
): MailMessage {
  const verified = status === 'diverifikasi'
  const subject = verified ? 'Selamat! Pendaftaran Anda diverifikasi' : 'Pembaruan status pendaftaran Anda'

  const lines = [
    greeting(fullName),
    '',
    verified
      ? 'Selamat! Pendaftaran Anda sebagai anggota WISANGGENI CLIMBING CLUB telah DIVERIFIKASI.'
      : 'Terima kasih atas minat Anda bergabung dengan WISANGGENI CLIMBING CLUB.',
    verified
      ? `Akun Anda sudah aktif. Silakan masuk di ${env.publicAppUrl}/masuk menggunakan email dan password yang Anda pilih saat mendaftar.`
      : 'Setelah ditinjau, pendaftaran Anda belum dapat kami setujui saat ini.',
  ]
  if (note) lines.push('', `Catatan dari pengurus: ${note}`)
  // Tautan grup juga disertakan di email sebagai cadangan bila WhatsApp gagal.
  if (verified && env.waGroupLink) {
    lines.push('', 'Bergabunglah ke grup WhatsApp klub lewat tautan berikut:', env.waGroupLink)
  }
  lines.push('', SIGNATURE)

  const text = lines.join('\n')
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#1d2b28;line-height:1.6;max-width:560px">
      <p>${greetingHtml(fullName)}</p>
      <p>${verified ? 'Selamat! Pendaftaran Anda sebagai anggota <strong>WISANGGENI CLIMBING CLUB</strong> telah <strong>diverifikasi</strong>.' : 'Setelah ditinjau, pendaftaran Anda belum dapat kami setujui saat ini.'}</p>
      ${verified ? `<p>Akun Anda sudah <strong>aktif</strong>. Silakan <a href="${env.publicAppUrl}/masuk" style="color:#173F35;font-weight:600">masuk di sini</a> menggunakan email dan password yang Anda pilih saat mendaftar.</p>` : ''}
      ${verified && env.waGroupLink ? `<p>Bergabunglah ke grup WhatsApp klub lewat <a href="${escapeHtml(env.waGroupLink)}" style="color:#173F35;font-weight:600">tautan berikut</a>.</p>` : ''}
      ${note ? `<p><strong>Catatan dari pengurus:</strong> ${escapeHtml(note)}</p>` : ''}
      <p>${signatureHtml()}</p>
    </div>`

  return { to, subject, text, html }
}
