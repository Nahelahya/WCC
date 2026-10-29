import type { QueryResultRow } from 'pg'
import type {
  AnnouncementPriority,
  AttendanceStatus,
  RegistrationStatus,
  Role,
  TransactionType,
} from '../types'
import { wibTime } from './time'

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
  /** Data profil yang disalin dari pendaftaran saat akun anggota dibuat. */
  gender: string | null
  nik: string | null
  address: string | null
  medical_history: string | null
  parent_name: string | null
  parent_phone: string | null
  password_hash?: string
  /** Token acak untuk QR ID card absensi. */
  attendance_token?: string | null
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
    gender: (row.gender as 'L' | 'P' | null) ?? undefined,
    nik: row.nik ?? undefined,
    address: row.address ?? undefined,
    medicalHistory: row.medical_history ?? undefined,
    parentName: row.parent_name ?? undefined,
    parentPhone: row.parent_phone ?? undefined,
    attendanceToken: row.attendance_token ?? undefined,
  }
}

/** Serializer non-PII untuk daftar pengguna (M-03): tanpa NIK, alamat,
 *  riwayat penyakit, kontak orang tua, maupun attendanceToken. */
export function mapUserPublic(row: UserRow) {
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
  // Jam check-in selalu ditampilkan menurut WIB, bukan zona waktu server.
  return wibTime(iso instanceof Date ? iso : new Date(iso))
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
    checkInTime: row.status === 'hadir' || row.status === 'menunggu' ? clock(row.check_in_at) : null,
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
  image_url: string | null
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
    imageUrl: row.image_url ?? undefined,
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
  gender: string | null
  nik: string | null
  address: string | null
  medical_history: string | null
  parent_name: string | null
  parent_phone: string | null
  experience: string
  motivation: string | null
  consent: boolean
  status: RegistrationStatus
  submitted_at: Date | string
  internal_note: string | null
  /** Waktu email pendaftar diverifikasi lewat OTP (null bila belum). */
  email_verified_at?: Date | string | null
  /** Hash bcrypt password pilihan calon anggota (dipakai saat akun dibuat otomatis). */
  password_hash?: string | null
  /** Metode bayar biaya administrasi: 'cash' | 'gateway'. */
  payment_method?: string | null
  /** Status bayar biaya administrasi: 'belum' | 'lunas'. */
  payment_status?: string | null
}

export function mapRegistration(row: RegistrationRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    gender: (row.gender as 'L' | 'P' | null) ?? undefined,
    nik: row.nik ?? '',
    address: row.address ?? '',
    medicalHistory: row.medical_history ?? '',
    parentName: row.parent_name ?? '',
    parentPhone: row.parent_phone ?? '',
    experience: row.experience,
    motivation: row.motivation ?? undefined,
    consent: row.consent,
    status: row.status,
    submittedAt:
      row.submitted_at instanceof Date ? row.submitted_at.toISOString() : String(row.submitted_at),
    internalNote: row.internal_note ?? undefined,
    emailVerifiedAt: row.email_verified_at
      ? row.email_verified_at instanceof Date
        ? row.email_verified_at.toISOString()
        : String(row.email_verified_at)
      : undefined,
    paymentMethod: (row.payment_method as 'cash' | 'gateway' | null) ?? undefined,
    paymentStatus: row.payment_status === 'lunas' ? 'lunas' : 'belum',
  };
}

/** Ringkuman publik minimal untuk `GET /api/registrations/status` (H-01).
 *  Hanya `id`, `fullName`, `email`, `status`, `submittedAt`, `paymentStatus`.
 *  NIK, alamat, riwayat penyakit, dan data orang tua TIDAK pernah dibuang dari
 *  endpoint ini, sehingga tidak mengandung data pribadi yang tidak perlu. */
export function mapRegistrationPublic(row: RegistrationRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    submittedAt:
      row.submitted_at instanceof Date
        ? row.submitted_at.toISOString()
        : String(row.submitted_at),
    paymentStatus: row.payment_status === 'lunas' ? 'lunas' : 'belum',
  };
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
  receipt_url: string | null
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
    receiptUrl: row.receipt_url ?? undefined,
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

/* ------------------------------------------------------------------ */
/* Payments (DOKU Checkout)                                            */
/* ------------------------------------------------------------------ */

export type PaymentPurpose = 'pendaftaran' | 'iuran'
export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'failed'

export interface PaymentRow extends QueryResultRow {
  id: string
  purpose: PaymentPurpose
  status: PaymentStatus
  amount: number
  invoice_number: string
  user_id: string | null
  registration_id: string | null
  period: string | null
  payer_name: string
  payer_email: string
  payer_phone: string
  channel: string | null
  doku_session_id: string | null
  doku_token_id: string | null
  doku_url: string | null
  paid_at: Date | string | null
  expires_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

function isoOrUndefined(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined
  return value instanceof Date ? value.toISOString() : String(value)
}

export function mapPayment(row: PaymentRow) {
  return {
    id: row.id,
    purpose: row.purpose,
    status: row.status,
    amount: Number(row.amount),
    invoiceNumber: row.invoice_number,
    userId: row.user_id ?? undefined,
    registrationId: row.registration_id ?? undefined,
    period: row.period ?? undefined,
    payerName: row.payer_name,
    payerEmail: row.payer_email,
    payerPhone: row.payer_phone,
    channel: row.channel ?? undefined,
    paidAt: isoOrUndefined(row.paid_at),
    expiresAt: isoOrUndefined(row.expires_at),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }
}
