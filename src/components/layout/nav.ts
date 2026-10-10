import type { Role } from '@/types'
import type { IconName } from '@/components/ui/Icon'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Ditampilkan pada bottom navigation mobile (maks. 5 termasuk "Lainnya"). */
  mobile?: boolean
  end?: boolean
}

export const ROLE_LABEL: Record<Role, string> = {
  anggota: 'Anggota',
  coach: 'Coach',
  pengurus: 'Pengurus',
}

export const NAV: Record<Role, NavItem[]> = {
  anggota: [
    { to: '/app', label: 'Dashboard', icon: 'home', mobile: true, end: true },
    { to: '/app/jadwal', label: 'Jadwal Latihan', icon: 'calendar', mobile: true },
    { to: '/app/absensi', label: 'Absensi Saya', icon: 'check-circle', mobile: true },
    { to: '/app/pengumuman', label: 'Pengumuman', icon: 'megaphone', mobile: true },
    { to: '/app/kas', label: 'Kas Klub', icon: 'wallet' },
    { to: '/app/profil', label: 'Profil Akun', icon: 'user' },
  ],
  coach: [
    { to: '/app', label: 'Dashboard Coach', icon: 'home', mobile: true, end: true },
    { to: '/app/jadwal', label: 'Jadwal yang Diampu', icon: 'calendar', mobile: true },
    { to: '/app/absensi', label: 'Daftar Hadir', icon: 'list', mobile: true },
    { to: '/app/pengumuman', label: 'Pengumuman', icon: 'megaphone', mobile: true },
    { to: '/app/profil', label: 'Profil Akun', icon: 'user' },
  ],
  pengurus: [
    { to: '/app', label: 'Dashboard Pengurus', icon: 'home', mobile: true, end: true },
    { to: '/app/jadwal', label: 'Jadwal Latihan', icon: 'calendar', mobile: true },
    { to: '/app/absensi', label: 'Rekap Absensi', icon: 'check-circle', mobile: true },
    { to: '/app/pengumuman', label: 'Pengumuman', icon: 'megaphone', mobile: true },
    { to: '/app/coach', label: 'Data Coach', icon: 'users' },
    { to: '/app/pendaftaran', label: 'Pendaftaran Anggota', icon: 'inbox' },
    { to: '/app/kas', label: 'Kas & Treasury', icon: 'wallet' },
    { to: '/app/laporan', label: 'Laporan', icon: 'chart' },
    { to: '/app/sinkronisasi', label: 'Sinkronisasi', icon: 'refresh' },
    { to: '/app/profil', label: 'Pengaturan/Profil', icon: 'settings' },
  ],
}

export function navFor(role: Role): NavItem[] {
  return NAV[role]
}

export function mobileNavFor(role: Role): NavItem[] {
  const items = NAV[role].filter((i) => i.mobile).slice(0, 4)
  return items
}

export function overflowNavFor(role: Role): NavItem[] {
  const mobile = new Set(NAV[role].filter((i) => i.mobile).slice(0, 4).map((i) => i.to))
  return NAV[role].filter((i) => !mobile.has(i.to))
}

/** Halaman apa saja yang boleh diakses tiap peran (otorisasi sisi klien). */
export const ALLOWED: Record<Role, string[]> = {
  anggota: ['/app', '/app/jadwal', '/app/absensi', '/app/pengumuman', '/app/kas', '/app/profil'],
  coach: ['/app', '/app/jadwal', '/app/absensi', '/app/pengumuman', '/app/profil'],
  pengurus: [
    '/app',
    '/app/jadwal',
    '/app/absensi',
    '/app/pengumuman',
    '/app/coach',
    '/app/pendaftaran',
    '/app/kas',
    '/app/laporan',
    '/app/sinkronisasi',
    '/app/profil',
  ],
}

export function canAccess(role: Role, pathname: string): boolean {
  return ALLOWED[role].some((base) =>
    // "/app" hanya cocok untuk tepat "/app", sedangkan rute lain boleh cocok
    // untuk sub-halaman seperti "/app/jadwal/:id".
    base === '/app'
      ? pathname === '/app'
      : pathname === base || pathname.startsWith(`${base}/`),
  )
}
