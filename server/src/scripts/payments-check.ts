/**
 * Pemeriksaan cepat integrasi pembayaran DOKU.
 *
 *   cd server && npm run payments:check
 *
 * Yang dilakukan skrip ini:
 *   1) Menguji `verifyDokuNotification()` asli dari `lib/doku.ts`
 *      (tanda tangan sah diterima, body/header yang diubah ditolak).
 *   2) Menampilkan apakah kredensial DOKU sudah terisi.
 *   3) Mencetak contoh notifikasi SUCCESS yang sudah ditandatangani (siap
 *      dikirim dengan curl) agar webhook bisa diuji lokal tanpa membayar.
 *
 * TIDAK membuat transaksi atau menarik dana apa pun.
 *
 * Catatan: nilai contoh di bawah hanya dipakai bila `server/.env` belum
 * mengisi DOKU_CLIENT_ID / DOKU_SECRET_KEY. Karena `env.ts` mengimpor dotenv
 * (tanpa override), penugasan ini harus terjadi SEBELUM `env` dievaluasi —
 * itulah sebabnya modul dimuat lewat `await import()`.
 */

export {}

const { env } = await import('../env')
const { dokuSignature, verifyDokuNotification, dokuConfigured } = await import('../lib/doku')

// Bila kredensial belum diisi di .env, uji memakai nilai contoh agar skrip
// tetap berguna. Nilai .env (yang sebenarnya) selalu diutamakan.
if (!env.dokuClientId) env.dokuClientId = 'TEST-CLIENT-ID'
if (!env.dokuSecretKey) env.dokuSecretKey = 'TEST-SECRET-KEY'

const NOTIFICATION_PATH = env.dokuNotificationPath || '/api/payments/doku/notification'
const target = NOTIFICATION_PATH

function section(title: string): void {
  console.log(`\n${title}`)
  console.log('─'.repeat(title.length))
}

function isoUtc(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

let failed = false
function check(label: string, value: boolean, goodWhen: boolean): void {
  const pass = value === goodWhen
  if (!pass) failed = true
  console.log(`  ${pass ? 'OK   ' : 'GAGAL'} · ${label}`)
}

/* ------------------------------------------------------------------ */

const clientId = env.dokuClientId
const secretKey = env.dokuSecretKey
const requestId = `req-${Date.now()}`
const timestamp = isoUtc()
const body = JSON.stringify({
  order: { invoice_number: `WCCTEST${Date.now()}`, amount: env.registrationFee },
  transaction: { status: 'SUCCESS', date: timestamp },
  channel: { id: 'VIRTUAL_ACCOUNT', name: 'BCA Virtual Account' },
})
const signature = `HMACSHA256=${dokuSignature(
  clientId,
  requestId,
  timestamp,
  target,
  body,
  secretKey,
)}`
const headers = { clientId, requestId, requestTimestamp: timestamp, signature }

section('1. Konfigurasi')
console.log(`  Kredensial terisi : ${dokuConfigured() ? 'ya' : 'belum (memakai nilai contoh)'}`)
console.log(`  Client-Id         : ${clientId}`)
console.log(`  Base URL          : ${env.dokuBaseUrl}`)
console.log(
  `  URL notifikasi    : ${env.dokuNotificationUrl || `${env.publicAppUrl}${env.dokuNotificationPath}`}`,
)
console.log(`  Biaya pendaftaran : Rp ${env.registrationFee.toLocaleString('id-ID')}`)
console.log(`  Iuran bulanan     : Rp ${env.monthlyDues.toLocaleString('id-ID')}`)

section('2. Uji verifikasi tanda tangan (lib/doku.ts)')
check('tanda tangan sah diterima', verifyDokuNotification(body, headers, target), true)
check(
  'body diubah ditolak',
  verifyDokuNotification(`${body} `, headers, target),
  false,
)
check(
  'tanda tangan salah ditolak',
  verifyDokuNotification(body, { ...headers, signature: `${signature}x` }, target),
  false,
)
check(
  'Client-Id asing ditolak',
  verifyDokuNotification(body, { ...headers, clientId: 'CLIENT-LAIN' }, target),
  false,
)
check(
  'Request-Target berbeda ditolak',
  verifyDokuNotification(body, headers, '/path/lain'),
  false,
)
check(
  'header tidak lengkap ditolak',
  verifyDokuNotification(body, { clientId, requestId, requestTimestamp: timestamp }, target),
  false,
)

section('3. Contoh notifikasi untuk uji webhook lokal')
console.log('Kirim permintaan berikut ke server lokal (Request-Target harus sama):\n')
console.log(`  curl -X POST "${env.publicAppUrl}${target}" ^`)
console.log('    -H "Content-Type: application/json" ^')
console.log(`    -H "Client-Id: ${clientId}" ^`)
console.log(`    -H "Request-Id: ${requestId}" ^`)
console.log(`    -H "Request-Timestamp: ${timestamp}" ^`)
console.log(`    -H "Signature: ${signature}" ^`)
console.log(`    -d "${body}"`)
console.log('')
console.log('  (Di PowerShell, ganti ^ dengan ` atau kirim satu baris.)')

section(failed ? 'ADA YANG GAGAL' : 'SELESAI — semua pemeriksaan lolos')
console.log('  Skrip ini tidak membuat transaksi atau menarik dana apa pun.')
if (failed) process.exitCode = 1
