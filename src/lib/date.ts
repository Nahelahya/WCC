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

/** YYYY-MM-DD dari sebuah Date, memakai waktu lokal. */
export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISO(new Date())
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

/** Dari ISO datetime ke "11 Oktober 2026, 19.05" */
export function formatDateTimeID(isoDateTime: string): string {
  const d = new Date(isoDateTime)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${formatDateID(toISO(d))}, ${hh}.${mm}`
}

/**
 * Mengubah ISO datetime menjadi YYYY-MM-DD menurut waktu lokal.
 * Jangan memakai `.slice(0, 10)` pada ISO datetime karena nilainya UTC
 * (dapat bergeser satu hari pada waktu dini hari di zona WIB/WITA/WIT).
 */
export function localDateOf(isoDateTime: string): string {
  return toISO(new Date(isoDateTime))
}

/** "19.05" dari ISO datetime, menurut waktu lokal. */
export function timeOf(isoDateTime: string): string {
  const d = new Date(isoDateTime)
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

export function clockTime(d: Date = new Date()): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}.${mm}`
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m ?? 0)
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

/** Bulan berjalan dalam format 'YYYY-MM' (cocok untuk <input type="month">). */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
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
