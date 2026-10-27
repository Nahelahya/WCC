import { useEffect, useState } from 'react'

/**
 * Banner global yang muncul saat perangkat kehilangan koneksi internet.
 * Menggantikan pesan generik "tidak dapat menghubungi server" dengan
 * pemberitahuan yang lebih jelas bahwa masalahnya ada pada jaringan.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-danger px-4 py-2 text-sm font-medium text-white shadow-md"
    >
      <span aria-hidden="true">⚠</span>
      <span>Tidak ada koneksi internet. Periksa jaringan Anda; data akan dimuat ulang setelah online.</span>
    </div>
  )
}
