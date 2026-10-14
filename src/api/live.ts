import type {
  Announcement,
  Attendance,
  AuditLogEntry,
  Coach,
  Registration,
  RegistrationStatus,
  Role,
  Session,
  SyncState,
  Transaction,
  User,
} from '@/types'
import type {
  AdminPayments,
  AttendanceRow,
  AuthSession,
  CheckoutInput,
  CheckoutResult,
  CreateUserInput,
  MyPayments,
  PaymentAdminFilter,
  PaymentConfig,
  PaymentStatusView,
  SessionInput,
  TreasurySummary,
  UpdateUserAccountInput,
  UploadResult,
} from './types'
import type { LandingContent } from '@/types.landing'

/**
 * Klien API asli. Memanggil backend Express + PostgreSQL yang ada di folder
 * `server/` (lihat README). Bentuk setiap fungsi sengaja dibuat identik dengan
 * `mock.ts`, sehingga halaman tidak perlu diubah saat berpindah mode.
 *
 * Aktifkan dengan `VITE_API_MODE=live`. URL dasar diambil dari `VITE_API_URL`
 * (default `/api`, diteruskan oleh proxy Vite ke http://localhost:4000).
 */

const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')

interface ApiFailure extends Error {
  status?: number
  details?: unknown
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      // Cookie sesi (HttpOnly) ikut terkirim.
      credentials: 'include',
      ...init,
      headers: {
        // Jangan set Content-Type untuk FormData — peramban yang menetapkan boundary.
        ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    })
  } catch {
    throw Object.assign(
      new Error('Tidak dapat menghubungi server API. Pastikan backend berjalan (folder server/).'),
      { status: 0 },
    )
  }

  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : null

  if (!res.ok) {
    const body = data as { message?: string; details?: unknown } | null
    const error: ApiFailure = Object.assign(
      new Error(body?.message ?? 'Terjadi kesalahan pada server.'),
      { status: res.status, details: body?.details },
    )
    throw error
  }

  return data as T
}

/** Seperti `request`, tetapi mengembalikan null bila responsnya 404. */
async function requestOrNull<T>(path: string): Promise<T | null> {
  try {
    return await request<T>(path)
  } catch (error) {
    if ((error as ApiFailure).status === 404) return null
    throw error
  }
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value)
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/* ------------------------------------------------------------------ */
/* Autentikasi                                                         */
/* ------------------------------------------------------------------ */

export const DEMO_PASSWORD = 'wcc12345'

export const authApi = {
  async login(email: string, password: string): Promise<AuthSession> {
    const res = await request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    // Token disimpan di cookie HttpOnly oleh server, bukan di JavaScript.
    return { token: '', user: res.user }
  },

  async me(): Promise<User | null> {
    const res = await request<{ user: User | null }>('/auth/me')
    return res.user
  },

  async logout(): Promise<void> {
    await request('/auth/logout', { method: 'POST' })
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  async verifyOtp(email: string, purpose: 'password_reset' | 'email_verify', otp: string): Promise<{ verified: boolean }> {
    return request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, purpose, otp }),
    })
  },

  async resetPassword(email: string, otp: string, password: string): Promise<void> {
    await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, password }),
    })
  },
}

/* ------------------------------------------------------------------ */
/* Unggah berkas                                                       */
/* ------------------------------------------------------------------ */

export const uploadApi = {
  async upload(file: File): Promise<UploadResult> {
    const form = new FormData()
    form.append('file', file)
    return request('/uploads', { method: 'POST', body: form })
  },
}

/* ------------------------------------------------------------------ */
/* Pengguna & profil                                                   */
/* ------------------------------------------------------------------ */

export const userApi = {
  async list(): Promise<User[]> {
    return request('/users?role=anggota')
  },
  async listByRole(role: Role): Promise<User[]> {
    return request(`/users?role=${encodeURIComponent(role)}`)
  },
  async create(input: CreateUserInput): Promise<User> {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async updateProfile(
    userId: string,
    patch: Partial<
      Pick<
        User,
        | 'name'
        | 'phone'
        | 'email'
        | 'photoUrl'
        | 'gender'
        | 'nik'
        | 'address'
        | 'medicalHistory'
        | 'parentName'
        | 'parentPhone'
      >
    >,
  ): Promise<User> {
    return request(`/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  },
  async updateAccount(userId: string, patch: UpdateUserAccountInput): Promise<User> {
    return request(`/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  },
  async changePassword(userId: string, current: string, next: string): Promise<void> {
    await request(`/users/${encodeURIComponent(userId)}/password`, {
      method: 'POST',
      body: JSON.stringify({ current, next }),
    })
  },
  async remove(userId: string): Promise<void> {
    await request(`/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
  },
}

/* ------------------------------------------------------------------ */
/* Sesi latihan                                                        */
/* ------------------------------------------------------------------ */

export const sessionApi = {
  async list(): Promise<Session[]> {
    return request('/sessions')
  },
  async get(id: string): Promise<Session | null> {
    return requestOrNull(`/sessions/${encodeURIComponent(id)}`)
  },
  async create(input: SessionInput): Promise<Session> {
    return request('/sessions', { method: 'POST', body: JSON.stringify(input) })
  },
  async update(id: string, patch: Partial<SessionInput>): Promise<Session> {
    return request(`/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  },
  async remove(id: string): Promise<void> {
    await request(`/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}

/* ------------------------------------------------------------------ */
/* Absensi                                                             */
/* ------------------------------------------------------------------ */

export const attendanceApi = {
  async bySession(sessionId: string): Promise<Attendance[]> {
    return request(`/sessions/${encodeURIComponent(sessionId)}/attendance`)
  },
  async byUser(userId: string, range?: { from?: string; to?: string }): Promise<AttendanceRow[]> {
    return request(`/attendance${query({ userId, from: range?.from, to: range?.to })}`)
  },
  async recap(filter?: { from?: string; to?: string; userId?: string }): Promise<AttendanceRow[]> {
    return request(`/attendance${query({ userId: filter?.userId, from: filter?.from, to: filter?.to })}`)
  },
  async checkIn(sessionId: string, userId: string): Promise<Attendance> {
    return request(`/sessions/${encodeURIComponent(sessionId)}/attendance/check-in`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  },
  async setStatus(
    sessionId: string,
    userId: string,
    status: Attendance['status'],
  ): Promise<Attendance> {
    return request(
      `/sessions/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(userId)}`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    )
  },
}

/* ------------------------------------------------------------------ */
/* Pengumuman                                                          */
/* ------------------------------------------------------------------ */

export const announcementApi = {
  async list(includeDrafts = false): Promise<Announcement[]> {
    return request(`/announcements${query({ includeDrafts: includeDrafts ? 'true' : undefined })}`)
  },
  async get(id: string): Promise<Announcement | null> {
    return requestOrNull(`/announcements/${encodeURIComponent(id)}`)
  },
  async save(input: Partial<Announcement> & { title: string; body: string }): Promise<Announcement> {
    if (input.id) {
      return request(`/announcements/${encodeURIComponent(input.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    }
    return request('/announcements', { method: 'POST', body: JSON.stringify(input) })
  },
  async remove(id: string): Promise<void> {
    await request(`/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}

/* ------------------------------------------------------------------ */
/* Coach                                                               */
/* ------------------------------------------------------------------ */

export const coachApi = {
  async list(): Promise<Coach[]> {
    return request('/coaches')
  },
  async get(id: string): Promise<Coach | null> {
    return requestOrNull(`/coaches/${encodeURIComponent(id)}`)
  },
  async save(input: Partial<Coach> & { name: string; expertise: string[] }): Promise<Coach> {
    if (input.id) {
      return request(`/coaches/${encodeURIComponent(input.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    }
    return request('/coaches', { method: 'POST', body: JSON.stringify(input) })
  },
  async remove(id: string): Promise<void> {
    await request(`/coaches/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}

/* ------------------------------------------------------------------ */
/* Pendaftaran anggota                                                 */
/* ------------------------------------------------------------------ */

export const registrationApi = {
  async list(): Promise<Registration[]> {
    return request('/registrations')
  },
  async get(id: string): Promise<Registration | null> {
    return requestOrNull(`/registrations/${encodeURIComponent(id)}`)
  },
  async getByEmail(email: string): Promise<Registration[]> {
    return request(`/registrations/status${query({ email })}`)
  },
  async verifyOtp(email: string, otp: string): Promise<{ verified: boolean }> {
    return request('/registrations/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    })
  },
  async resendOtp(email: string): Promise<{ message: string }> {
    return request('/registrations/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },
  async submit(input: {
    fullName: string
    email: string
    phone: string
    gender: 'L' | 'P'
    nik: string
    address: string
    medicalHistory: string
    parentName: string
    parentPhone: string
    experience: string
    motivation?: string
    consent: boolean
    password: string
    /** 'cash' = bayar tunai (nanti); 'gateway' = bayar online via DOKU. */
    paymentMethod?: 'cash' | 'gateway'
  }): Promise<Registration> {
    return request('/registrations', { method: 'POST', body: JSON.stringify(input) })
  },
  async setStatus(
    id: string,
    status: RegistrationStatus,
    internalNote?: string,
  ): Promise<Registration> {
    return request(`/registrations/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, internalNote }),
    })
  },

  /** Menandai biaya administrasi sudah lunas (mis. bayar tunai). */
  async setPayment(id: string, paymentStatus: 'belum' | 'lunas'): Promise<Registration> {
    return request(`/registrations/${encodeURIComponent(id)}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentStatus }),
    })
  },
}

/* ------------------------------------------------------------------ */
/* Kas & Treasury                                                      */
/* ------------------------------------------------------------------ */

export const treasuryApi = {
  async list(): Promise<Transaction[]> {
    return request('/transactions')
  },
  async summary(period?: { from?: string; to?: string }): Promise<TreasurySummary> {
    return request(`/transactions/summary${query({ from: period?.from, to: period?.to })}`)
  },
  async save(input: Partial<Transaction> & { type: Transaction['type'] }): Promise<Transaction> {
    if (input.id) {
      return request(`/transactions/${encodeURIComponent(input.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    }
    return request('/transactions', { method: 'POST', body: JSON.stringify(input) })
  },
  async remove(id: string): Promise<void> {
    await request(`/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}

/* ------------------------------------------------------------------ */
/* Pembayaran online (DOKU Checkout)                                   */
/* ------------------------------------------------------------------ */

export const paymentApi = {
  async config(): Promise<PaymentConfig> {
    return request('/payments/config')
  },

  /** Membuat sesi pembayaran DOKU; mengembalikan URL halaman checkout. */
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    return request('/payments/checkout', { method: 'POST', body: JSON.stringify(input) })
  },

  /** Status iuran + riwayat pembayaran milik pengguna yang login. */
  async mine(): Promise<MyPayments> {
    return request('/payments/mine')
  },

  async adminList(filter?: PaymentAdminFilter): Promise<AdminPayments> {
    return request(`/payments${query({ purpose: filter?.purpose, status: filter?.status })}`)
  },

  /** Status publik satu invoice (halaman hasil pembayaran). */
  async status(invoiceNumber: string): Promise<PaymentStatusView> {
    return request(`/payments/status/${encodeURIComponent(invoiceNumber)}`)
  },
}

/* ------------------------------------------------------------------ */
/* Sinkronisasi spreadsheet                                            */
/* ------------------------------------------------------------------ */

export const syncApi = {
  async get(): Promise<SyncState> {
    return request('/sync/status')
  },
  async run(): Promise<{ status: 'success'; rows: number }> {
    const res = await request<{ status: 'success'; rows: number; message?: string }>('/sync/run', {
      method: 'POST',
      body: JSON.stringify({ trigger: 'manual' }),
    })
    return { status: 'success', rows: res.rows }
  },
  async reset(): Promise<void> {
    throw Object.assign(
      new Error(
        'Reset data demo hanya tersedia pada mode mock. Untuk mengembalikan data, jalankan `npm run db:seed` di folder server.',
      ),
      { status: 400 },
    )
  },
}

/* ------------------------------------------------------------------ */
/* Jejak audit transaksi kas                                           */
/* ------------------------------------------------------------------ */

export const auditApi = {
  async list(filter?: { action?: string; entity?: string }): Promise<AuditLogEntry[]> {
    return request(`/audit-logs${query({ action: filter?.action, entity: filter?.entity })}`)
  },
}

/* ------------------------------------------------------------------ */
/* Ringkasan dashboard                                                 */
/* ------------------------------------------------------------------ */

type MemberDashboard = {
  hadir: number
  totalSessions: number
  percentage: number
  from: string | null
  to: string | null
  upcoming: Session[]
}

type AdminDashboard = {
  upcoming: Session[]
  recentSessions: Session[]
  recentAttendanceCount: number
  pendingRegistrations: number
  activeMembers: number
  balance: number
  recentTransactions: Transaction[]
  sync: SyncState
}

export const statsApi = {
  async memberDashboard(
    _userId: string,
    range?: { from?: string; to?: string },
  ): Promise<MemberDashboard> {
    return request(`/dashboard/member${query({ from: range?.from, to: range?.to })}`)
  },
  async adminDashboard(): Promise<AdminDashboard> {
    return request('/dashboard/admin')
  },
  async coachDashboard(coachId: string): Promise<{ upcoming: Session[]; past: Session[] }> {
    return request(`/dashboard/coach${query({ coachId })}`)
  },
  async sessionAttendanceSummary(
    sessionId: string,
  ): Promise<{ hadir: number; izin: number; totalMembers: number }> {
    return request(`/sessions/${encodeURIComponent(sessionId)}/summary`)
  },
}

export const landingApi = {
  async get(): Promise<any> {
    return request('/landing')
  },
  async update(data: any): Promise<any> {
    return request('/landing', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
}

