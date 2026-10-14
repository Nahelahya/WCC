const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** Zona waktu klub: WIB (UTC+7, tanpa DST). Semua jam ditampilkan menurut zona ini. */
export const CLUB_TIME_ZONE = 'Asia/Jakarta'

const isoDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLUB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const clockFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLUB_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Jam & menit menurut WIB. */
function wibClock(d: Date): { h: number; m: number } {
  const parts = clockFmt.formatToParts(d)
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return { h: pick('hour') % 24, m: pick('minute') }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD dari sebuah Date, memakai komponen lokal (aritmetika tanggal). */
export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Tanggal "hari ini" menurut WIB. */
export function todayISO(): string {
  return isoDateFmt.format(new Date())
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export function diffDays(a: string, b: string): number {
  const ms = parseISO(a).getTime() - parseISO(b).getTime()
  return Math.round(ms / 86400000)
}

/** 11 Oktober 2026 */
export function formatDateID(iso: string): string {
  if (!iso) return '-'
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Senin, 11 Oktober 2026 */
export function formatDateLongID(iso: string): string {
  if (!iso) return '-'
  const d = parseISO(iso)
  return `${DAYS[d.getDay()]}, ${formatDateID(iso)}`
}

/** 19.00 */
export function formatTime(hhmm: string): string {
  return hhmm.replace(':', '.')
}

/** 19.00–21.00 */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)}–${formatTime(end)}`
}

/** Dari ISO datetime ke "11 Oktober 2026, 19.05" (WIB) */
export function formatDateTimeID(isoDateTime: string): string {
  return `${formatDateID(localDateOf(isoDateTime))}, ${timeOf(isoDateTime)}`
}

/**
 * Mengubah ISO datetime menjadi YYYY-MM-DD menurut WIB (UTC+7).
 * Jangan memakai `.slice(0, 10)` pada ISO datetime karena nilainya UTC
 * (dapat bergeser satu hari pada waktu dini hari).
 */
export function localDateOf(isoDateTime: string): string {
  return isoDateFmt.format(new Date(isoDateTime))
}

/** "19.05" dari ISO datetime, menurut WIB. */
export function timeOf(isoDateTime: string): string {
  const { h, m } = wibClock(new Date(isoDateTime))
  return `${pad2(h)}.${pad2(m)}`
}

/** Jam sekarang "HH.mm" menurut WIB. */
export function clockTime(d: Date = new Date()): string {
  const { h, m } = wibClock(d)
  return `${pad2(h)}.${pad2(m)}`
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

/** Menit sejak tengah malam menurut WIB (mis. 19.05 -> 1145). */
export function minutesOfDayWIB(d: Date = new Date()): number {
  const { h, m } = wibClock(d)
  return h * 60 + m
}

/** Tanggal relatif ramah pengguna: "Hari ini", "Besok", "3 hari lalu". */
export function relativeDayID(iso: string, base = todayISO()): string {
  const d = diffDays(iso, base)
  if (d === 0) return 'Hari ini'
  if (d === 1) return 'Besok'
  if (d === -1) return 'Kemarin'
  if (d > 1) return `${d} hari lagi`
  return `${Math.abs(d)} hari lalu`
}

export function formatRupiah(amount: number): string {
  return `Rp${new Intl.NumberFormat('id-ID').format(Math.round(amount))}`
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n)
}

export function monthLabelID(iso: string): string {
  const d = parseISO(iso)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Bulan berjalan "'YYYY-MM'" menurut WIB (cocok untuk <input type="month">). */
export function currentMonth(now: Date = new Date()): string {
  return isoDateFmt.format(now).slice(0, 7)
}

/** Rentang tanggal (from, to) untuk bulan 'YYYY-MM'. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  return { from: toISO(new Date(y, m - 1, 1)), to: toISO(new Date(y, m, 0)) }
}

/** 'YYYY-MM' -> "Oktober 2026". */
export function formatMonthID(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS[m - 1] ?? ''} ${y}`.trim()
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob(['\ufeff' + content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
