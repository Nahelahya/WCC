import { env } from '../env'

/**
 * Pengiriman WhatsApp lewat gateway Fonnte (https://fonnte.com).
 *
 * Dipakai untuk mengirim tautan grup WhatsApp klub secara otomatis begitu
 * pendaftaran anggota diverifikasi. Bila token/link belum diatur, pengiriman
 * dilewati (`skipped`) dan pengurus masih bisa mengirim manual dari UI.
 */

export interface WhatsAppResult {
  /** True bila Fonnte menerima pesan untuk dikirim. */
  sent: boolean
  /** Keterangan singkat untuk ditampilkan ke pengurus. */
  detail: string
  /** True bila pengiriman dilewati karena konfigurasi belum lengkap. */
  skipped?: boolean
  /** Tautan klik-ke-chat (wa.me) sebagai cadangan bila Fonnte tidak terkirim. */
  waUrl?: string
}

/** True bila pengiriman otomatis WhatsApp sudah dikonfigurasi. */
export function whatsappConfigured(): boolean {
  return Boolean(env.fonnteToken && env.waGroupLink)
}

/**
 * Menormalkan nomor telepon Indonesia ke format internasional tanpa "+".
 * Contoh: "0812-3456-7890" → "6281234567890".
 */
export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

/** Isi pesan WhatsApp saat pendaftaran disetujui. */
export function approvalWhatsAppMessage(fullName: string, email: string): string {
  return [
    `Halo ${fullName},`,
    '',
    'Pendaftaran kamu di WISANGGENI CLIMBING CLUB sudah disetujui dan akunmu aktif.',
    '',
    `Silakan bergabung ke ${env.waGroupName} lewat tautan berikut:`,
    env.waGroupLink,
    '',
    `Gunakan email ${email} untuk masuk ke aplikasi.`,
    '',
    'Salam,',
    'Pengurus WISANGGENI CLIMBING CLUB',
  ].join('\n')
}

/** Mengirim pesan WhatsApp ke satu nomor. Tidak pernah melempar error. */
export async function sendWhatsApp(target: string, message: string): Promise<WhatsAppResult> {
  if (!env.fonnteToken) {
    return {
      sent: false,
      skipped: true,
      detail: 'Token Fonnte (FONNTE_TOKEN) belum diatur di server.',
    }
  }

  const phone = normalizePhone(target)
  if (!phone) {
    return { sent: false, detail: 'Nomor WhatsApp tujuan tidak valid.' }
  }

  try {
    const res = await fetch(`${env.fonnteApiUrl}/send`, {
      method: 'POST',
      headers: {
        Authorization: env.fonnteToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ target: phone, message, countryCode: '62' }),
      signal: AbortSignal.timeout(15_000),
    })

    const raw = await res.text().catch(() => '')
    let body: { status?: boolean; detail?: string; reason?: string } = {}
    try {
      body = JSON.parse(raw) as typeof body
    } catch {
      // Fonnte sesekali membalas teks biasa; detail di bawah tetap dipakai.
    }

    if (!res.ok || body.status === false) {
      return {
        sent: false,
        detail:
          body.reason ||
          body.detail ||
          `Fonnte menolak permintaan (HTTP ${res.status})${raw ? ` — ${raw.slice(0, 200)}` : ''}.`,
      }
    }

    return { sent: true, detail: body.detail || 'Pesan WhatsApp masuk antrean pengiriman.' }
  } catch (err) {
    return {
      sent: false,
      detail: err instanceof Error ? err.message : 'Gagal menghubungi Fonnte.',
    }
  }
}

/** Kirim pesan persetujuan beserta tautan grup WhatsApp klub. */
export async function sendApprovalWhatsApp(
  target: string,
  fullName: string,
  email: string,
): Promise<WhatsAppResult> {
  const message = approvalWhatsAppMessage(fullName, email)
  const phone = normalizePhone(target)
  const waUrl =
    phone && env.waGroupLink
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : undefined

  if (!env.waGroupLink) {
    return {
      sent: false,
      skipped: true,
      detail: 'Tautan grup WhatsApp (WA_GROUP_LINK) belum diatur di server.',
      waUrl,
    }
  }
  if (!env.fonnteToken) {
    return {
      sent: false,
      skipped: true,
      detail: 'Token Fonnte (FONNTE_TOKEN) belum diatur di server. Kirim manual lewat tautan wa.me.',
      waUrl,
    }
  }
  if (!phone) {
    return { sent: false, detail: 'Nomor WhatsApp tujuan tidak valid.', waUrl }
  }

  const result = await sendWhatsApp(target, message)
  return { ...result, waUrl: result.sent ? undefined : waUrl }
}
