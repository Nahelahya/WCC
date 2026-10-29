const CACHE = 'wcc-v4'
const ASSETS = ['/manifest.json']

// Halaman cadangan saat perangkat benar-benar offline dan tidak ada halaman
// yang tersimpan. Sengaja TIDAK memakai halaman error dari server (mis. 503).
const OFFLINE_HTML =
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Tidak ada koneksi internet</title>' +
  '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
  'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f7f5;color:#1c1917;text-align:center">' +
  '<div style="padding:24px"><h1 style="font-size:20px;margin:0 0 8px">Tidak ada koneksi internet</h1>' +
  '<p style="margin:0;color:#57534e">Periksa jaringan Anda, lalu muat ulang halaman ini.</p></div>'

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

/**
 * Simpan respons ke cache HANYA bila sukses (2xx). Tanpa ini, halaman error
 * sementara dari hosting (mis. 503 "server is temporarily busy") ikut
 * tersimpan dan terus ditampilkan walau server sudah normal kembali.
 */
function putIfOk(request, response) {
  if (!response || !response.ok) return
  const clone = response.clone()
  caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => undefined)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (req.url.includes('/api/') || req.url.includes('/uploads/')) return

  // Navigasi (HTML): network-first agar selalu memuat bundle terbaru.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          putIfOk(req, res)
          return res
        })
        .catch(async () => {
          const cached = await caches.match(req)
          if (cached && cached.ok) return cached
          const root = await caches.match('/')
          if (root && root.ok) return root
          return new Response(OFFLINE_HTML, {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }),
    )
    return
  }

  // Aset statis: cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((res) => {
          putIfOk(req, res)
          return res
        })
        .catch(() => Response.error())
    }),
  )
})
