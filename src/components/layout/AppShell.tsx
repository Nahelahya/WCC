import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useIdleLogout, IDLE_LOGOUT_FLAG } from '@/lib/hooks'
import { PageLoading, EmptyState } from '@/components/ui/Feedback'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { MobileBottomNav, SidebarNavigation, Avatar } from './SidebarNavigation'
import { ROLE_LABEL, canAccess } from './nav'
import { Icon } from '@/components/ui/Icon'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

/** Batas tidak ada aktivitas sebelum sesi diakhiri otomatis (30 menit). */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

export function AppShell({ children }: { children?: ReactNode }) {
  const { user, loading, logout } = useAuth()
  const location = useLocation()

  // Akhiri sesi otomatis bila pengguna tidak beraktivitas.
  useIdleLogout(IDLE_TIMEOUT_MS, () => {
    try {
      window.sessionStorage.setItem(IDLE_LOGOUT_FLAG, '1')
    } catch {
      // sessionStorage bisa diblokir; pengalihan ke halaman masuk tetap terjadi.
    }
    void logout()
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <PageLoading label="Memeriksa sesi…" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/masuk" replace state={{ from: location.pathname }} />
  }

  if (!canAccess(user.role, location.pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-4">
        <div className="card w-full max-w-lg">
          <EmptyState
            icon="shield"
            title="Akses ditolak"
            description={`Peran ${ROLE_LABEL[user.role]} tidak memiliki kewenangan untuk membuka halaman ini. Halaman ini hanya tersedia untuk pengurus.`}
            action={
              <Link to="/app" className={buttonClasses('primary')}>
                Kembali ke Dashboard
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Lompat ke konten utama
      </a>

      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] border-r border-line bg-surface lg:block">
        <SidebarNavigation user={user} />
      </aside>

      {/* Header mobile */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center gap-3 px-4">
          <Link to="/app" className="flex min-w-0 items-center">
            <Logo size={34} withWordmark={false} />
            <span className="ml-2.5 min-w-0 leading-tight">
              <span className="block truncate text-[12.5px] font-bold tracking-[0.12em] text-primary">
                WISANGGENI
              </span>
              <span className="block truncate text-[10px] font-semibold tracking-[0.18em] text-muted">
                CLIMBING CLUB
              </span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/app/profil"
              className="flex items-center gap-2 rounded-full border border-line py-1 pl-2.5 pr-1"
              aria-label="Buka profil akun"
            >
              <span className="text-[11.5px] font-semibold text-muted">{ROLE_LABEL[user.role]}</span>
              <Avatar user={user} size={28} />
            </Link>
          </div>
        </div>
      </header>

      <div className="lg:pl-[272px]">
        <main id="konten-utama" className="mx-auto w-full max-w-[1180px] px-4 pb-[104px] pt-5 lg:px-8 lg:pb-12 lg:pt-8">
          {children ?? <Outlet />}
        </main>
      </div>

      <MobileBottomNav user={user} />
    </div>
  )
}

export function AppPageHeaderActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-primary">
      <Icon name="chevron-left" size={15} />
      {label}
    </Link>
  )
}

export { Button }
