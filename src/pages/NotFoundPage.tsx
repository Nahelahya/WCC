import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { buttonClasses } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'
import { Logo } from '@/components/ui/Logo'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-16">
      <Logo size={46} className="mb-8" />
      <div className="card w-full max-w-lg">
        <EmptyState
          icon="alert"
          title="Halaman tidak ditemukan"
          description="Tautan yang Anda buka tidak tersedia atau telah dipindahkan."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/" className={buttonClasses('primary')}>
                Kembali ke Beranda
              </Link>
              <Link to="/app" className={buttonClasses('secondary')}>
                Buka Dashboard
              </Link>
            </div>
          }
        />
      </div>
    </div>
  )
}

/** Mengembalikan posisi gulir ke atas setiap kali rute berubah. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}
