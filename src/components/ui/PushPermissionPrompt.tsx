import { useEffect } from 'react'
import { getPushPermission, isPushSupported, PUSH_PERMISSION_EVENT } from '@/lib/push'

const PROMPTED_KEY = 'wcc.pushPrompted'
const FALLBACK_DELAY_MS = 1500

/**
 * Meminta izin notifikasi secara native saat pengunjung pertama kali membuka
 * situs. Bila browser mewajibkan gestur (Firefox/Safari), permintaan diulang
 * sekali pada interaksi pertama — tanpa tombol khusus.
 */
export function PushPermissionPrompt() {
  useEffect(() => {
    if (!isPushSupported()) return
    try {
      if (window.localStorage.getItem(PROMPTED_KEY) === '1') return
    } catch {
      /* localStorage bisa diblokir */
    }

    let cancelled = false
    let timer: number | undefined
    let removeFallback: (() => void) | undefined
    let promptedByGesture = false

    const markPrompted = () => {
      try {
        window.localStorage.setItem(PROMPTED_KEY, '1')
      } catch {
        /* abaikan */
      }
    }

    const stopFallback = () => {
      removeFallback?.()
      removeFallback = undefined
    }

    const armFallback = () => {
      if (removeFallback) return
      const onGesture = () => {
        promptedByGesture = true
        stopFallback()
        ask()
      }
      window.addEventListener('pointerdown', onGesture, true)
      window.addEventListener('keydown', onGesture, true)
      removeFallback = () => {
        window.removeEventListener('pointerdown', onGesture, true)
        window.removeEventListener('keydown', onGesture, true)
      }
    }

    const finish = () => {
      if (cancelled) return
      const permission = getPushPermission()
      if (permission === 'granted') {
        markPrompted()
        stopFallback()
        window.dispatchEvent(new Event(PUSH_PERMISSION_EVENT))
      } else if (permission === 'denied' || promptedByGesture) {
        markPrompted()
        stopFallback()
      } else {
        armFallback()
      }
    }

    const ask = () => {
      void Notification.requestPermission().then(finish).catch(finish)
    }

    ask()
    timer = window.setTimeout(() => {
      if (!cancelled && getPushPermission() === 'default') armFallback()
    }, FALLBACK_DELAY_MS)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      stopFallback()
    }
  }, [])

  return null
}
