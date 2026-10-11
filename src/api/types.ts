import type { Attendance, User } from '@/types'

/**
 * Tipe yang dipakai bersama oleh klien mock (`mock.ts`) dan klien API asli
 * (`live.ts`), sehingga keduanya bisa dipertukarkan tanpa mengubah halaman.
 */

export interface AuthSession {
  token: string
  user: User
}

export interface SessionInput {
  title: string
  date: string
  startTime: string
  endTime: string
  location: string
  coachId: string
  note?: string
  cancelled?: boolean
}

export interface AttendanceRow extends Attendance {
  userName: string
  sessionTitle: string
  sessionDate: string
  checkInTime: string | null
}

export interface TreasurySummary {
  balance: number
  income: number
  expense: number
}

export interface UploadResult {
  /** URL publik berkas (mis. `/uploads/abc.png` atau data URL pada mode mock). */
  url: string
  name: string
  size: number
  mime: string
}
