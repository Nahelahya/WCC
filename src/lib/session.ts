import type { Session, SessionStatus } from '@/types'
import { minutesOf, minutesOfDayWIB, todayISO } from './date'

export function sessionStatus(s: Session, now: Date = new Date()): SessionStatus {
  if (s.cancelled) return 'dibatalkan'
  const today = todayISO()
  if (s.date > today) return 'akan-datang'
  if (s.date < today) return 'selesai'
  const cur = minutesOfDayWIB(now)
  const start = minutesOf(s.startTime)
  const end = minutesOf(s.endTime)
  if (cur < start) return 'akan-datang'
  if (cur > end) return 'selesai'
  return 'berlangsung'
}

/** Jendela check-in: dibuka 30 menit sebelum sesi dan ditutup saat sesi berakhir. */
const CHECKIN_OPEN_BEFORE_MIN = 30

function checkInWindow(s: Session) {
  const open = minutesOf(s.startTime) - CHECKIN_OPEN_BEFORE_MIN
  const close = minutesOf(s.endTime)
  return { open, close }
}

export function canCheckIn(s: Session, now: Date = new Date()): { ok: boolean; reason?: string } {
  const st = sessionStatus(s, now)
  if (st === 'dibatalkan') return { ok: false, reason: 'Sesi ini dibatalkan.' }
  if (st === 'akan-datang') {
    const cur = minutesOfDayWIB(now)
    const { open } = checkInWindow(s)
    if (s.date === todayISO() && cur < open)
      return {
        ok: false,
        reason: `Check-in dibuka 30 menit sebelum sesi dimulai (${s.startTime.replace(':', '.')}).`,
      }
    if (s.date !== todayISO()) return { ok: false, reason: 'Check-in hanya dapat dilakukan pada hari sesi berlangsung.' }
  }
  if (st === 'selesai') return { ok: false, reason: 'Sesi telah berakhir. Hubungi pengurus jika perlu koreksi.' }
  return { ok: true }
}

export function cn(...classes: unknown[]): string {
  return classes.filter((c): c is string => typeof c === 'string' && c.length > 0).join(' ')
}
