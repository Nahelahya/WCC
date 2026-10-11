export type Role = 'anggota' | 'coach' | 'pengurus'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  phone?: string
  photoUrl?: string
  joinedAt: string
  membershipStatus?: 'aktif' | 'nonaktif' | 'pending'
  coachId?: string
}

export interface Session {
  id: string
  title: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  location: string
  coachId: string
  note?: string
  cancelled?: boolean
}

export interface Attendance {
  id: string
  sessionId: string
  userId: string
  checkInAt: string // ISO datetime
  status: 'menunggu' | 'hadir' | 'izin' | 'alpha'
}

export type AnnouncementPriority = 'tinggi' | 'normal' | 'rendah'

export interface Announcement {
  id: string
  title: string
  summary: string
  body: string
  priority: AnnouncementPriority
  publishedAt: string // ISO datetime
  author: string
  published: boolean
}

export interface Coach {
  id: string
  name: string
  expertise: string[]
  experience: string
  photoUrl?: string
  bio?: string
  years: number
}

export type RegistrationStatus = 'baru' | 'diverifikasi' | 'ditolak'

export interface Registration {
  id: string
  fullName: string
  email: string
  phone: string
  experience: string
  motivation?: string
  consent: boolean
  status: RegistrationStatus
  submittedAt: string
  internalNote?: string
}

export type TransactionType = 'pemasukan' | 'pengeluaran'

export interface Transaction {
  id: string
  date: string // YYYY-MM-DD
  type: TransactionType
  category: string
  amount: number
  note: string
  recordedBy: string
  receiptName?: string
  createdAt: string
}

export type AuditAction = 'create' | 'update' | 'delete'

/** Satu baris jejak audit (PRD 10): siapa mengubah apa dan kapan. */
export interface AuditLogEntry {
  id: string
  at: string // ISO datetime
  userName: string
  action: AuditAction
  entity: string
  entityId?: string
  /** Muatan terstruktur aksi: snapshot transaksi, atau { before, after } saat ubah. */
  detail?: Record<string, unknown> | null
}

export interface SyncLogEntry {
  id: string
  at: string
  status: 'success' | 'failed'
  message: string
  rows: number
}

export interface SyncState {
  status: 'idle' | 'running' | 'success' | 'failed'
  lastSyncAt: string | null
  log: SyncLogEntry[]
  /** Info konfigurasi dari server (mode live); `false` = belum siap dipakai. */
  configured?: boolean
  reason?: string
  spreadsheetId?: string
  tab?: string
  serviceAccountEmail?: string
  columns?: string[]
}

export interface Database {
  version: number
  seededDay: string
  users: User[]
  sessions: Session[]
  attendance: Attendance[]
  announcements: Announcement[]
  coaches: Coach[]
  registrations: Registration[]
  transactions: Transaction[]
  auditLogs: AuditLogEntry[]
  sync: SyncState
}

export type SessionStatus = 'akan-datang' | 'berlangsung' | 'selesai' | 'dibatalkan'
