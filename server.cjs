/**
 * Entry point untuk Hostinger Node.js hosting (LiteSpeed / Passenger).
 *
 * Passenger/LiteSpeed memuat file startup memakai `require()`, sehingga entry
 * HARUS berupa modul CommonJS tanpa top-level await. File ini memakai hook
 * `tsx/cjs` untuk menjalankan backend TypeScript di folder `server/src`,
 * sekaligus melayani frontend hasil build di `dist/` (lihat `server/src/app.ts`).
 */
require('tsx/cjs')
require('./server/src/index.ts')
