import type { Attendance, Role, User } from '@/types'

/**
 * Tipe yang dipakai bersama oleh klien mock (`mock.ts`) dan klien API asli
 * (`live.ts`), sehingga keduanya bisa dipertukarkan tanpa mengubah halaman.
 */

export interface AuthSession {
  token: string
  user: User
}

/** Muatan pembuatan akun pengguna (anggota / coach / pengurus) oleh pengurus. */
export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: Role
  phone?: string
  photoUrl?: string
  membershipStatus?: 'aktif' | 'nonaktif' | 'pending'
  /** Wajib untuk peran `coach`; opsional sebagai penautan untuk `anggota`. */
  coachId?: string
}

/** Perubahan akun oleh pengurus (termasuk peran & penautan coach). */
export interface UpdateUserAccountInput {
  name?: string
  email?: string
  phone?: string
  photoUrl?: string
  role?: Role
  membershipStatus?: 'aktif' | 'nonaktif' | 'pending'
  coachId?: string
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

/* ------------------------------------------------------------------ */
/* Pembayaran online (DOKU Checkout)                                   */
/* ------------------------------------------------------------------ */

export type PaymentPurpose = 'pendaftaran' | 'iuran'
export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'failed'

export interface PaymentConfig {
  /** True bila kredensial DOKU sudah diisi di server. */
  configured: boolean
  /** Biaya administrasi pendaftaran (sekali bayar), Rupiah. */
  registrationFee: number
  /** Iuran kas per bulan, Rupiah (boleh dicicil). */
  monthlyDues: number
  /** Periode berjalan 'YYYY-MM'. */
  period: string
}

export interface Payment {
  id: string
  purpose: PaymentPurpose
  status: PaymentStatus
  amount: number
  invoiceNumber: string
  userId?: string
  registrationId?: string
  /** Periode iuran 'YYYY-MM' (kosong untuk pembayaran pendaftaran). */
  period?: string
  payerName: string
  payerEmail: string
  payerPhone: string
  /** Kanal yang dipilih pembeli di halaman DOKU. */
  channel?: string
  paidAt?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface CheckoutInput {
  purpose: PaymentPurpose
  registrationId?: string
  email?: string
  period?: string
  amount?: number
}

/** Hasil endpoint checkout: ringkasan pembayaran + URL halaman DOKU. */
export interface CheckoutResult extends Payment {
  url?: string
  /** True bila memakai ulang tautan pembayaran yang masih berlaku. */
  reused?: boolean
}

export interface DuesState {
  period: string
  monthlyAmount: number
  paidAmount: number
  outstanding: number
  status: 'lunas' | 'sebagian' | 'belum'
}

export interface MyPayments {
  dues: DuesState
  payments: Payment[]
}

/* ------------------------------------------------------------------ */
/* Iuran anggota (dilihat & dicatat pengurus)                           */
/* ------------------------------------------------------------------ */

/** Ringkasan iuran satu anggota untuk sebuah periode, untuk halaman pengurus. */
export interface MemberDues {
  user: { id: string; name: string }
  dues: DuesState
  /** Total yang dicatat tunai oleh pengurus pada periode ini. */
  manualAmount: number
  /** Total yang dibayar lewat kanal online pada periode ini. */
  onlineAmount: number
  /** Riwayat pembayaran periode ini. */
  payments: Payment[]
}

/**
 * Mencatat/mengubah iuran tunai anggota. `amount: 0` berarti menghapus
 * catatan tunai periode tersebut (mis. salah catat).
 */
export interface ManualDuesInput {
  userId: string
  period: string
  amount: number
}

export interface AdminPayments {
  payments: Payment[]
  totals: { paid: number; pending: number }
}

/** Penyaring daftar pembayaran untuk halaman pengurus. */
export interface PaymentAdminFilter {
  purpose?: PaymentPurpose
  status?: string
}

/** Tampilan publik status satu invoice (halaman hasil pembayaran). */
export interface PaymentStatusView {
  invoiceNumber: string
  purpose: PaymentPurpose
  status: PaymentStatus
  amount: number
  period?: string
  channel?: string
  paidAt?: string
}
