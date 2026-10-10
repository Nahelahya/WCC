import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/session'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { ROLE_LABEL, mobileNavFor, navFor, overflowNavFor } from './nav'
import type { User } from '@/types'
import { useAuth } from '@/context/AuthContext'

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export function Avatar({ user, size = 38 }: { user: User; size?: number }) {
  if (user.photoUrl) {
    return (
      <img
        src={user.photoUrl}
        alt=""
        style={{ height: size, width: size }}
        className="flex-none rounded-full object-cover ring-2 ring-line"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ height: size, width: size, fontSize: size * 0.38 }}
      className="flex flex-none items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white ring-2 ring-primary/20"
    >
      {initials(user.name)}
    </span>
  )
}

export function SidebarNavigation({ user }: { user: User }) {
  const { logout } = useAuth()
  const items = navFor(user.role)

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5">
        <NavLink to="/app" className="block rounded-control focus-visible:outline-none">
          <Logo size={40} variant="dark" />
        </NavLink>
      </div>

      <div className="mx-4 mt-5 rounded-card border border-line bg-bg/70 px-3.5 py-3">
        <div className="flex items-center gap-3">
          <Avatar user={user} size={38} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[12px] text-muted">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigasi utama">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[44px] items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors duration-ui',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-ink/80 hover:bg-primary/10 hover:text-primary',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon name={item.icon} size={19} className={isActive ? 'text-white' : 'text-primary/70'} />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <Button
          variant="secondary"
          icon="logout"
          block
          onClick={() => void logout()}
          className="justify-start"
        >
          Keluar
        </Button>
        <p className="mt-2.5 px-1 text-[11px] leading-snug text-muted">
          WISANGGENI CLIMBING CLUB · v1.0 prototype
        </p>
      </div>
    </div>
  )
}

export function MobileBottomNav({ user }: { user: User }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const bottom = mobileNavFor(user.role)
  const overflow = overflowNavFor(user.role)
  const { logout } = useAuth()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  return (
    <>
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
        aria-label="Navigasi bawah"
      >
        <ul className="mx-auto flex max-w-2xl items-stretch">
          {bottom.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon name={item.icon} size={21} className={isActive ? 'text-primary' : 'text-muted'} />
                    <span className="max-w-full truncate">{item.label.split(' ')[0]}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          {overflow.length > 0 && (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex min-h-[60px] w-full flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 text-[11px] font-medium text-muted"
                aria-haspopup="dialog"
                aria-expanded={drawerOpen}
              >
                <Icon name="menu" size={21} />
                <span>Lainnya</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      {drawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-label="Menu lainnya"
            className="safe-bottom absolute inset-x-0 bottom-0 max-h-[80vh] animate-slide-up overflow-y-auto rounded-t-card border-t border-line bg-surface"
          >
            <div className="mx-auto max-w-2xl px-4 pb-4 pt-3">
              <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-line" aria-hidden="true" />
              <div className="mb-3 flex items-center gap-3">
                <Avatar user={user} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                  <p className="truncate text-[12px] text-muted">
                    {ROLE_LABEL[user.role]} · {user.email}
                  </p>
                </div>
              </div>
              <ul className="space-y-1">
                {overflow.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-[48px] items-center gap-3 rounded-control px-3 text-sm font-medium',
                          isActive ? 'bg-primary/10 text-primary' : 'text-ink hover:bg-bg',
                        )
                      }
                    >
                      <Icon name={item.icon} size={19} className="text-primary/70" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" icon="logout" block className="mt-3" onClick={() => void logout()}>
                Keluar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
