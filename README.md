# WISANGGENI CLIMBING CLUB

Website manajemen WISANGGENI CLIMBING CLUB.

Repositori berisi dua bagian:

- `src/` — Frontend (React + Vite + TypeScript + Tailwind CSS).
- `server/` — Backend (Express + TypeScript + PostgreSQL).

## Menjalankan proyek

Prasyarat: Node.js 20+ dan PostgreSQL (atau Docker).

```bash
# Backend
cd server
npm install
cp .env.example .env   # sesuaikan variabel lingkungan
npm run db:setup       # migrasi + seed data demo
npm run dev            # http://localhost:4000

# Frontend (terminal baru)
npm install
npm run dev            # http://localhost:5173
```

Frontend mem-proxy `/api` ke backend pada mode dev. Untuk mode demo tanpa backend, set `VITE_API_MODE=mock`.

## Produksi

- Frontend: `npm run build` (keluaran di `dist/`).
- Backend: jalankan migrasi `npm run db:migrate` pada database produksi.
- Jangan commit berkas `.env`, kredensial, atau data sensitif.

## Keamanan

Repositori ini tidak menyertakan kredensial, akun demo, atau detail infrastruktur produksi.
Konfigurasi sensitif disimpan pada variabel lingkungan server dan tidak pernah dikirim ke frontend.

## Lisensi

Hak cipta WISANGGENI CLIMBING CLUB. Seluruh hak dilindungi undang-undang.
