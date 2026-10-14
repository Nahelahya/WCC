/**
 * Utilitas tanggal/waktu server.
 *
 * Klub berada di Indonesia, jadi semua perhitungan "hari ini" dan "jam
 * sekarang" memakai zona WIB (UTC+7) — bukan zona waktu server (Hostinger
 * berjalan pada UTC) dan bukan zona peramban pengguna.
 */

/** Zona waktu klub: WIB (UTC+7, tanpa DST). */
export const CLUB_TIME_ZONE = 'Asia/Jakarta'

const WIB_OFFSET_MINUTES = 7 * 60

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLUB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLUB_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Jam & menit menurut WIB. */
function wibClock(d: Date): { hours: number; minutes: number } {
  const parts = clockFormatter.formatToParts(d)
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return { hours: pick('hour') % 24, minutes: pick('minute') }
}

/** YYYY-MM-DD dari komponen lokal `Date` (dipakai aritmetika tanggal). */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  return `${y}-${m}-${day}`
}

/** Tanggal "hari ini" menurut WIB. */
export function todayISO(): string {
  return isoDateFormatter.format(new Date())
}

/** Menit sejak tengah malam menurut WIB (mis. 19.05 -> 1145). */
export function wibMinutesOfDay(d: Date = new Date()): number {
  const { hours, minutes } = wibClock(d)
  return hours * 60 + minutes
}

/** Jam WIB dalam format "HH.mm". */
export function wibTime(d: Date): string {
  const { hours, minutes } = wibClock(d)
  return `${pad(hours)}.${pad(minutes)}`
}

/** Instant (UTC) dari tanggal + jam WIB, mis. ('2026-10-14', '19:00'). */
export function wibInstant(dateISO: string, hhmm: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, h, min) - WIB_OFFSET_MINUTES * 60_000)
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function isoMinutesAgo(minutes: number): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - minutes)
  return d.toISOString()
}

/** "HH:mm" WIB sekarang, digeser sejumlah menit. */
export function nowHHMM(offsetMinutes: number): string {
  const { hours, minutes } = wibClock(new Date(Date.now() + offsetMinutes * 60_000))
  return `${pad(hours)}:${pad(minutes)}`
}
