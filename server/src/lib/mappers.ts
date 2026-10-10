import type { QueryResultRow } from 'pg'
import type {
  AnnouncementPriority,
  AttendanceStatus,
  RegistrationStatus,
  Role,
  TransactionType,
} from '../types'

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export interface UserRow extends QueryResultRow {
  id: string
  name: string
  email: string
  role: Role
  phone: string | null
  photo_url: string | null
  joined_at: string
  membership_status: string | null
  coach_id: string | null
  password_hash?: string
}

export function mapUser(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    joinedAt: row.joined_at,
    membershipStatus: row.membership_status ?? undefined,
    coachId: row.coach_id ?? undefined,
  }
}

/* ------------------------------------------------------------------ */
/* Coaches                                                             */
/* ------------------------------------------------------------------ */

export interface CoachRow extends QueryResultRow {
  id: string
  name: string
  expertise: string[]
  experience: string
  photo_url: string | null
  bio: string | null
  years: number
}

export function mapCoach(row: CoachRow) {
  return {
    id: row.id,
    name: row.name,
    expertise: row.expertise ?? [],
    experience: row.experience,
    photoUrl: row.photo_url ?? undefined,
    bio: row.bio ?? undefined,
    years: row.years,
  }
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export interface SessionRow extends QueryResultRow {
  id: string
  title: string
  date: string
  start_time: string
  end_time: string
  location: string
  coach_id: string | null
  note: string | null
  cancelled: boolean
}

export function mapSession(row: SessionRow) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    coachId: row.coach_id ?? '',
    note: row.note ?? undefined,
    cancelled: row.cancelled,
  }
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

export interface AttendanceRowDB extends QueryResultRow {
  id: string
  session_id: string
  user_id: string
  check_in_at: Date | string
  status: AttendanceStatus
  // kolom hasil join (opsional)
  user_name?: string
  session_title?: string
  session_date?: string
}

function clock(iso: Date | string): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

export function mapAttendance(row: AttendanceRowDB) {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    checkInAt: row.check_in_at instanceof Date ? row.check_in_at.toISOString() : String(row.check_in_at),
    status: row.status,
  }
}

export function mapAttendanceDecorated(row: AttendanceRowDB) {
  return {
    ...mapAttendance(row),
    userName: row.user_name ?? 'Anggota',
    sessionTitle: row.session_title ?? 'Sesi latihan',
    sessionDate: row.session_date ?? '',
    checkInTime: row.status === 'hadir' ? clock(row.check_in_at) : null,
  }
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

export interface AnnouncementRow extends QueryResultRow {
  id: string
  title: string
  summary: string
  body: string
  priority: AnnouncementPriority
  published_at: Date | string
  author: string
  published: boolean
}

export function mapAnnouncement(row: AnnouncementRow) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    priority: row.priority,
    publishedAt: row.published_at instanceof Date ? row.published_at.toISOString() : String(row.published_at),
    author: row.author,
    published: row.published,
  }
}

/* ------------------------------------------------------------------ */
/* Registrations                                                       */
/* ------------------------------------------------------------------ */

export interface RegistrationRow extends QueryResultRow {
  id: string
  full_name: string
  email: string
  phone: string
  experience: string
  motivation: string | null
  consent: boolean
  status: RegistrationStatus
  submitted_at: Date | string
  internal_note: string | null
}

export function mapRegistration(row: RegistrationRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    experience: row.experience,
    motivation: row.motivation ?? undefined,
    consent: row.consent,
    status: row.status,
    submittedAt:
      row.submitted_at instanceof Date ? row.submitted_at.toISOString() : String(row.submitted_at),
    internalNote: row.internal_note ?? undefined,
  }
}

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

export interface TransactionRow extends QueryResultRow {
  id: string
  date: string
  type: TransactionType
  category: string
  amount: number
  note: string
  recorded_by: string
  receipt_name: string | null
  created_at: Date | string
}

export function mapTransaction(row: TransactionRow) {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    category: row.category,
    amount: Number(row.amount),
    note: row.note,
    recordedBy: row.recorded_by,
    receiptName: row.receipt_name ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

/* ------------------------------------------------------------------ */
/* Sync                                                                */
/* ------------------------------------------------------------------ */

export interface SyncLogRow extends QueryResultRow {
  id: string
  at: Date | string
  status: 'success' | 'failed'
  message: string
  rows: number
}

export function mapSyncLog(row: SyncLogRow) {
  return {
    id: row.id,
    at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
    status: row.status,
    message: row.message,
    rows: row.rows,
  }
}
