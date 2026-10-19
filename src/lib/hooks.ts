import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
  setData: (updater: T | ((prev: T | null) => T | null)) => void
}

/**
 * Menjalankan fungsi async dengan dukungan state loading/error,
 * agar setiap halaman dapat menampilkan ketiga keadaan tersebut.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const mounted = useRef(true)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fnRef
      .current()
      .then((res) => {
        if (active) setData(res)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { data, loading, error, reload, setData: setData as AsyncState<T>['setData'] }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Terjadi kesalahan. Silakan coba lagi.'
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Penanda di sessionStorage bahwa sesi terakhir berakhir karena pengguna
 * tidak beraktivitas (dibaca halaman masuk untuk menampilkan pemberitahuan).
 */
export const IDLE_LOGOUT_FLAG = 'wcc_idle_logout'

/**
 * Waktu aktivitas terakhir pengguna (epoch ms) yang disimpan di localStorage.
 * Disimpan agar hitungan "tidak ada kegiatan" tetap benar setelah halaman
 * di-reload atau tab dibuang peramban — sebelumnya timer selalu direset saat
 * halaman dimuat ulang sehingga sesi menganggur seakan tidak pernah berakhir.
 */
const LAST_ACTIVITY_KEY = 'wcc_last_activity'

/** Menandai aktivitas pengguna saat ini (dipanggil saat login dan saat ada interaksi). */
export function markActivityNow(): void {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
  } catch {
    // localStorage bisa diblokir; hitungan idle tetap berjalan di memori.
  }
}

/** Menghapus tanda aktivitas agar sesi berikutnya menghitung dari awal. */
export function clearActivityMark(): void {
  try {
    window.localStorage.removeItem(LAST_ACTIVITY_KEY)
  } catch {
    /* abaikan */
  }
}

function readLastActivity(): number {
  try {
    return Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

/**
 * Memanggil `onIdle` setelah tidak ada aktivitas pengguna selama `timeoutMs`.
 *
 * Aktivitas yang dihitung: gerakan/klik/sentuh, ketikan keyboard, dan gulir.
 * Waktu aktivitas terakhir disimpan di localStorage sehingga hitungan tidak
 * tereset saat halaman di-reload, tab dibuang, atau dipulihkan dari cache.
 *
 * Peramban ponsel sering membekukan timer saat aplikasi/tab tidak aktif dan
 * tidak selalu memicu `visibilitychange`; karena itu pemeriksaan juga dilakukan
 * pada semua event siklus hidup (visible/focus/pageshow/resume) dan setiap kali
 * keluar halaman waktu aktivitas dicatat agar hitungan idle tetap akurat.
 */
export function useIdleLogout(timeoutMs: number, onIdle: () => void) {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    let last = readLastActivity()
    if (!last) {
      last = Date.now()
      markActivityNow()
    }

    let fired = false
    const fire = () => {
      if (fired) return
      fired = true
      onIdleRef.current()
    }

    // Aktivitas terbaru diambil dari nilai terbesar antara memori dan
    // localStorage, agar tetap benar setelah halaman dibekukan/dipulihkan.
    const effectiveLast = () => Math.max(last, readLastActivity())

    let persistedAt = last
    const markActive = () => {
      last = Date.now()
      // `mousemove`/`touchmove` terlalu sering untuk ditulis ke localStorage
      // tiap kali; cukup simpan berkala agar hitungan tetap akurat setelah reload.
      if (last - persistedAt >= 5_000) {
        persistedAt = last
        markActivityNow()
      }
    }
    // Dipakai saat halaman ditinggalkan: catat waktunya segera (tanpa throttle).
    const recordNow = () => {
      last = Date.now()
      persistedAt = last
      markActivityNow()
    }
    const check = () => {
      if (Date.now() - effectiveLast() >= timeoutMs) fire()
    }

    // Periksa segera saat mount: menangkap halaman yang dibuka kembali setelah
    // lama menganggur (reload / tab dibuang peramban) sebelum pengguna berinteraksi.
    check()

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'pointerdown',
      'keydown',
      'scroll',
      'wheel',
      'touchstart',
      'touchmove',
      'click',
    ]
    events.forEach((name) => window.addEventListener(name, markActive, { passive: true }))
    const interval = window.setInterval(check, 30_000)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
      else recordNow()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Jalur pemulihan yang lazim di ponsel: fokus kembali, pulih dari cache
    // (bfcache) via `pageshow`, atau dilanjutkan dari kondisi beku (`resume`).
    const onResume = () => check()
    window.addEventListener('focus', onResume)
    window.addEventListener('pageshow', onResume)
    document.addEventListener('resume', onResume)

    // Saat meninggalkan halaman, simpan waktu aktivitas terakhir segera.
    window.addEventListener('pagehide', recordNow)
    document.addEventListener('freeze', recordNow)

    // Sinkronkan aktivitas antar-tab yang terbuka bersamaan.
    const onStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY && event.newValue) last = Number(event.newValue) || last
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.clearInterval(interval)
      events.forEach((name) => window.removeEventListener(name, markActive))
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('pageshow', onResume)
      document.removeEventListener('resume', onResume)
      window.removeEventListener('pagehide', recordNow)
      document.removeEventListener('freeze', recordNow)
      window.removeEventListener('storage', onStorage)
    }
  }, [timeoutMs])
}

/** Menjalankan aksi important sekali saja selama masih berjalan (cegah submit ganda). */
function useSubmitting() {
  const [submitting, setSubmitting] = useState(false)
  const run = useCallback(async (fn: () => Promise<void>) => {
    setSubmitting((prev) => {
      if (prev) return prev
      return true
    })
    try {
      await fn()
    } finally {
      setSubmitting(false)
    }
  }, [])
  return { submitting, run, setSubmitting }
}
