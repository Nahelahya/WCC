const CACHE = 'wcc-v3'
const ASSETS = ['/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (req.url.includes('/api/') || req.url.includes('/uploads/')) return

  // Navigasi (HTML): network-first agar selalu memuat bundle terbaru.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => undefined)
          return res
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('/'))),
    )
    return
  }

  // Aset statis: cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => undefined)
          return res
        })
        .catch(() => Response.error())
    }),
  )
})
