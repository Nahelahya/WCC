import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/session'
import { Logo } from '@/components/ui/Logo'
import { Icon } from '@/components/ui/Icon'
import { buttonClasses } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useAuth } from '@/context/AuthContext'
import { useEffect } from 'react'
import { landingApi } from '@/api/client'
import { useAsync } from '@/lib/hooks'
import { getLandingDefaults } from '@/lib/landing-defaults'
import type { LandingContent } from '@/types.landing'

const PUBLIC_LINKS = [
  { to: '/', label: 'Tentang', hash: '#tentang' },
  { to: '/', label: 'Harga', hash: '#harga' },
  { to: '/', label: 'Jadwal', hash: '#jadwal' },
  { to: '/coach', label: 'Coach', hash: '' },
  { to: '/cara-bergabung', label: 'Cara Bergabung', hash: '' },
]

export function PublicLayout() {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const location = useLocation()
  const landing = useAsync(() => landingApi.get(), [])
  const footer = (landing.data as LandingContent | null)?.footer ?? getLandingDefaults().footer

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex flex-none items-center" aria-label="Beranda WISANGGENI CLIMBING CLUB">
            <Logo size={38} wordmarkClassName="hidden sm:block" />
          </Link>

          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Navigasi publik">
            {PUBLIC_LINKS.map((l) => {
              const href = l.hash ? `/${l.hash}` : l.to
              const isAnchor = Boolean(l.hash)
              return isAnchor ? (
                <a
                  key={l.label}
                  href={href}
                  className="rounded-control px-3 py-2 text-sm font-medium text-ink/80 transition-colors hover:bg-bg hover:text-primary"
                >
                  {l.label}
                </a>
              ) : (
                <NavLink
                  key={l.label}
                  to={l.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-control px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'text-primary' : 'text-ink/80 hover:bg-bg hover:text-primary',
                    )
                  }
                >
                  {l.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link to="/app" className={buttonClasses('primary', 'md')}>
                Buka Dashboard
              </Link>
            ) : (
              <>
                <Link to="/masuk" className={buttonClasses('secondary', 'md', 'hidden sm:inline-flex')}>
                  Login
                </Link>
                <Link to="/daftar" className={buttonClasses('accent', 'md')}>
                  Gabung
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-control border border-line text-ink lg:hidden"
              aria-label={open ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={open}
            >
              <Icon name={open ? 'x' : 'menu'} size={20} />
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-line bg-surface px-4 py-3 lg:hidden" aria-label="Navigasi publik mobile">
            <ul className="space-y-1">
              {PUBLIC_LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.hash ? `/${l.hash}` : l.to}
                    className="flex min-h-[46px] items-center rounded-control px-3 text-[15px] font-medium text-ink hover:bg-bg"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  to="/masuk"
                  className="flex min-h-[46px] items-center rounded-control px-3 text-[15px] font-medium text-ink hover:bg-bg"
                >
                  Login
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-line bg-brand text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Logo size={44} variant="light" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">{footer.description}</p>
            <div className="mt-4 space-y-2 text-sm text-white/80">
              <p className="flex items-center gap-2">
                <Icon name="pin" size={16} /> {footer.contact.address}
              </p>
              <p className="flex items-center gap-2">
                <Icon name="mail" size={16} /> {footer.contact.email}
              </p>
              <p className="flex items-center gap-2">
                <Icon name="phone" size={16} /> {footer.contact.phone}
              </p>
            </div>
          </div>

          {footer.sections.slice(0, 4).map((sec) => (
            <div key={sec.title}>
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-white/60">{sec.title}</h3>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                {sec.links.map((ln) => {
                  const isExternal = /^(https?:|mailto:|tel:)/i.test(ln.href) || ln.external
                  const isHash = ln.href.includes('#')
                  return isExternal || isHash ? (
                    <li key={`${sec.title}-${ln.label}`}>
                      <a
                        href={ln.href}
                        className="hover:text-white"
                        target={ln.href.startsWith('http') ? '_blank' : undefined}
                        rel={ln.href.startsWith('http') ? 'noreferrer' : undefined}
                      >
                        {ln.label}
                      </a>
                    </li>
                  ) : (
                    <li key={`${sec.title}-${ln.label}`}>
                      <Link to={ln.href} className="hover:text-white">
                        {ln.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/15 px-4 py-5 text-center text-[12.5px] text-white/60 sm:px-6">
          {footer.copyright}
        </div>
      </footer>
    </div>
  )
}
