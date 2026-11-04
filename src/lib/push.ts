import { API_MODE } from '@/api/client'

/**
 * Modul klien Web Push (frontend). Sengaja ringan: hanya meminta izin,
 * berlangganan lewat `PushManager`, dan menyimpan subscription ke backend.
 *
 * Pada mode mock (`VITE_API_MODE=mock`) semua fungsi menjadi no-op agar toggle
 * notifikasi tidak muncul / tidak crash.
 */

const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')

/** Dipancarkan setelah prompt izin notifikasi dijawab (granted/denied). */
export const PUSH_PERMISSION_EVENT = 'wcc:push-permission'

export function isPushSupported(): boolean {
  if (API_MODE !== 'live') return false
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return (
    'serviceWorker' in navigator &&
    typeof window.PushManager !== 'undefined' &&
    typeof window.Notification !== 'undefined'
  )
}

export function getPushPermission(): NotificationPermission {
  if (API_MODE !== 'live' || !isPushSupported()) return 'default'
  try {
    return Notification.permission
  } catch {
    return 'default'
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribePush(): Promise<{ ok: boolean; reason?: string }> {
  if (API_MODE !== 'live') {
    return { ok: false, reason: 'Notifikasi push tidak tersedia pada mode demo.' }
  }
  if (!isPushSupported()) {
    return { ok: false, reason: 'Peramban ini tidak mendukung notifikasi push.' }
  }

  try {
    // 1. Minta izin bila belum ditentukan.
    let permission = Notification.permission
    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }
    if (permission !== 'granted') {
      return { ok: false, reason: 'Izin notifikasi ditolak atau belum diberikan.' }
    }

    // 2. Ambil VAPID public key dari backend.
    const keyRes = await fetch(`${BASE}/push/vapid-public-key`, {
      credentials: 'include',
    })
    if (!keyRes.ok) {
      let message = 'Gagal mengambil kunci VAPID dari server.'
      try {
        const body = (await keyRes.json()) as { message?: string }
        if (body?.message) message = body.message
      } catch {
        /* ignore */
      }
      return { ok: false, reason: message }
    }
    const { publicKey } = (await keyRes.json()) as { publicKey: string }
    if (!publicKey) {
      return { ok: false, reason: 'Kunci VAPID kosong.' }
    }
    const applicationServerKey = urlBase64ToUint8Array(publicKey)

    // 3. Subscribe lewat PushManager.
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
    }

    // 4. Kirim subscription ke backend.
    const json = subscription.toJSON()
    const endpoint = json.endpoint ?? subscription.endpoint
    const p256dh = json.keys?.p256dh
    const auth = json.keys?.auth
    if (!endpoint || !p256dh || !auth) {
      return { ok: false, reason: 'Subscription tidak lengkap.' }
    }

    const saveRes = await fetch(`${BASE}/push/subscribe`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        keys: { p256dh, auth },
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }),
    })
    if (!saveRes.ok) {
      let message = 'Gagal menyimpan subscription ke server.'
      try {
        const body = (await saveRes.json()) as { message?: string }
        if (body?.message) message = body.message
      } catch {
        /* ignore */
      }
      return { ok: false, reason: message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Terjadi kesalahan saat berlangganan.',
    }
  }
}

export async function unsubscribePush(): Promise<void> {
  if (API_MODE !== 'live' || !isPushSupported()) return

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return
    const subscription = await registration.pushManager.getSubscription()

    const endpoint = subscription?.endpoint
    if (subscription) {
      await subscription.unsubscribe()
    }

    if (endpoint) {
      await fetch(`${BASE}/push/unsubscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => undefined)
    }
  } catch {
    /* no-op */
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (API_MODE !== 'live' || !isPushSupported()) return false
  try {
    if (Notification.permission !== 'granted') return false
    const registration = await navigator.serviceWorker.getRegistration()
    const reg = registration ?? (await navigator.serviceWorker.ready)
    const subscription = await reg.pushManager.getSubscription()
    return !!subscription
  } catch {
    return false
  }
}
