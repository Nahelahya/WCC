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

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Penanda di sessionStorage bahwa sesi terakhir berakhir karena pengguna
 * tidak beraktivitas (dibaca halaman masuk untuk menampilkan pemberitahuan).
 */
export const IDLE_LOGOUT_FLAG = 'wcc_idle_logout'

/**
 * Memanggil `onIdle` setelah tidak ada aktivitas pengguna selama `timeoutMs`.
 *
 * Aktivitas yang dihitung: gerakan/klik mouse, ketikan keyboard, gulir, dan
 * sentuhan layar. Pemeriksaan dilakukan berkala sehingga tetap berjalan walau
 * tab sempat tidak aktif (browser menahan timer di latar belakang).
 */
export function useIdleLogout(timeoutMs: number, onIdle: () => void) {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    let last = Date.now()
    const markActive = () => {
      last = Date.now()
    }
    const check = () => {
      if (Date.now() - last >= timeoutMs) onIdleRef.current()
    }

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'wheel',
      'touchstart',
      'click',
    ]
    events.forEach((name) => window.addEventListener(name, markActive, { passive: true }))
    const interval = window.setInterval(check, 30_000)

    return () => {
      window.clearInterval(interval)
      events.forEach((name) => window.removeEventListener(name, markActive))
    }
  }, [timeoutMs])
}

/** Menjalankan aksi important sekali saja selama masih berjalan (cegah submit ganda). */
export function useSubmitting() {
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
