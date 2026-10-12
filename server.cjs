/**
 * Entry point untuk Hostinger Node.js hosting (LiteSpeed / Passenger).
 *
 * Passenger/LiteSpeed memuat file startup memakai `require()`, sehingga entry
 * HARUS berupa modul CommonJS tanpa top-level await. File ini memakai hook
 * `tsx/cjs` untuk menjalankan backend TypeScript di folder `server/src`,
 * sekaligus melayani frontend hasil build di `dist/` (lihat `server/src/app.ts`).
 */

const fs = require('node:fs')
const path = require('node:path')

/**
 * Beberapa hosting Node.js (mis. Hostinger) menyimpan variabel lingkungan di
 * `hbuilds/config/.env`, yaitu DI LUAR folder aplikasi, dan proses induknya
 * belum tentu memuat ulang berkas itu saat aplikasi di-restart. Di sini berkas
 * tersebut dimuat lebih dulu (dengan `override`) sehingga mengubah `.env` +
 * restart aplikasi sudah cukup — tanpa perlu deploy ulang.
 *
 * Di lingkungan lain (lokal, Render/Docker) berkas ini tidak ada, jadi bagian
 * ini dilewati dan `dotenv/config` biasa tetap dipakai.
 */
try {
  const dotenv = require('dotenv')
  const candidates = [
    path.resolve(__dirname, '../../../config/.env'), // .../hbuilds/versions/<id>/nodejs
    path.resolve(__dirname, '../../config/.env'), // .../hbuilds/current/nodejs
    path.resolve(process.cwd(), '../../../config/.env'),
    path.resolve(process.cwd(), '../../config/.env'),
  ]
  const found = candidates.find((file) => fs.existsSync(file))
  if (found) dotenv.config({ path: found, override: true })
} catch {
  // dotenv/berkas opsional — abaikan bila tidak tersedia.
}

require('tsx/cjs')
require('./server/src/index.ts')
