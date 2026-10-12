/**
 * Entry point untuk Hostinger Node.js hosting.
 *
 * Menjalankan backend Express (TypeScript, folder `server/src`) memakai `tsx`,
 * sekaligus melayani frontend hasil build di `dist/` (dilakukan di `server/src/app.ts`).
 *
 * Catatan: file ini harus berakhiran `.js` karena Hostinger hanya menerima
 * entry file berekstensi .js/.mjs/.cjs. Dependency diambil dari `node_modules`
 * di root proyek (lihat package.json).
 */
import { register } from 'tsx/esm/api'

register()

await import('./server/src/index.ts')
