export type Role = 'anggota' | 'coach' | 'pengurus'
export type AttendanceStatus = 'hadir' | 'izin' | 'alpha'
export type RegistrationStatus = 'baru' | 'diverifikasi' | 'ditolak'
export type TransactionType = 'pemasukan' | 'pengeluaran'
export type AnnouncementPriority = 'tinggi' | 'normal' | 'rendah'

declare global {
  // Menempelkan data pengguna hasil verifikasi token ke objek Request.
  // Dipakai oleh middleware auth dan route handler.
  namespace Express {
    interface Request {
      auth?: { userId: string; role: Role }
    }
  }
}
