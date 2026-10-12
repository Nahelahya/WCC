# Deploy ke Hostinger — WISANGGENI CLIMBING CLUB

Panduan ini menggunakan **Hostinger Web Apps / Deployments (GitHub)** dengan
alur **push ke GitHub → build otomatis di server → jalankan Node.js (Express)**.
Tidak perlu build/upload manual.

- Domain contoh: `navajowhite-stingray-927086.hostingersite.com`
- Repo: `https://github.com/Nahelahya/WCC` (branch `main`)
- Node.js: 22

Arsitektur (satu origin, jadi bebas CORS):

```
Domain (HTTPS)
   └── Node.js app (Express, Passenger/LiteSpeed)
          ├── dist/               → frontend React hasil build (dibuat di server via `vite build`)
          └── server/src/**       → backend Express (TypeScript, dijalankan via tsx/cjs)
   Frontend memanggil API lewat path relatif: /api/...
```

---

## 1. Setelan Deployment di hPanel

hPanel → **Websites → kelola domain → Deployments / Web Apps → Settings**.

| Field | Nilai |
|---|---|
| Framework / Application type | **Express** |
| Root directory | *(kosongkan)* |
| Build command / Build script | `build` |
| **Output directory** | *(kosongkan — penting untuk Express)* |
| **Entry file** | **`server.cjs`** |
| Package manager | `npm` |
| Node.js version | `22` |
| Repository | `Nahelahya/WCC` |
| Branch | `main` |

> ⚠️ Jangan biarkan tipe aplikasi terdeteksi sebagai **vite/static** dan jangan
> isi Output directory dengan `dist`. Kalau diisi `dist`, Node/Express tidak akan
> pernah dijalankan (hanya file statis yang dilayani).

Setelah disimpan, klik **Deploy / Save and redeploy**.

---

## 2. Environment Variables

hPanel → Deployments → **Environment Variables**. (Bisa juga lewat API
`PUT /api/hosting/v1/accounts/{username}/websites/{domain}/nodejs/builds/settings/env`.)

### Wajib

| Variable | Nilai |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | connection string PostgreSQL (Supabase) |
| `JWT_SECRET` | string acak panjang |
| `CORS_ORIGIN` | `https://<domain>` |
| `PUBLIC_APP_URL` | `https://<domain>` |
| `COOKIE_SECURE` | `true` |

### Frontend (dipakai saat `vite build`)

| Variable | Nilai |
|---|---|
| `VITE_API_MODE` | `live` |
| `VITE_API_URL` | `/api` |

### Penyimpanan berkas unggahan (disarankan persisten)

Letakkan **di luar** `hbuilds/` agar tidak hilang setiap deploy:

| Variable | Nilai |
|---|---|
| `UPLOAD_DIR` | `/home/<user>/wcc-uploads` |

### Opsional (email)

| Variable | Nilai |
|---|---|
| `SMTP_HOST` | mis. `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | alamat Gmail |
| `SMTP_PASS` | app password Gmail |
| `SMTP_SECURE` | `false` |
| `MAIL_FROM` | `WISANGGENI CLIMBING CLUB <no-reply@wcc.id>` |

Jika `SMTP_HOST` kosong, email hanya ditulis ke log server (tidak terkirim).

> **JANGAN set `PORT`.** Hostinger/Passenger menyediakan port otomatis lewat
> `process.env.PORT`; app sudah membacanya.

> **Catatan `DATABASE_URL`:** bila password memuat karakter khusus (mis. `#`,
> `/`, `?`), app akan meng-encode bagian password secara otomatis (lihat
> `server/src/db/connectionString.ts`), jadi URL boleh ditulis apa adanya.

---

## 3. Cara entry point bekerja

Passenger/LiteSpeed memuat entry file dengan `require()`. Karena itu:

- Entry adalah **`server.cjs`** (CommonJS), **bukan** ESM dan **tanpa**
  top-level `await` — kalau tidak, muncul `ERR_REQUIRE_ASYNC_MODULE`.
- `server.cjs` memakai hook `tsx/cjs` untuk menjalankan `server/src/index.ts`
  (TypeScript langsung, tanpa langkah build backend terpisah).
- `server/src/app.ts` melayani `dist/` + SPA fallback untuk semua rute
  non-`/api` dan non-`/uploads` (mis. `/masuk`, `/kebijakan-privasi`).

Semua dependency backend ada di **root `package.json`** supaya di-install
Hostinger. Build tools frontend (`vite`, `typescript`, `tailwindcss`, dll) juga
ditaruh di `dependencies` karena build frontend dijalankan di server dengan
`NODE_ENV=production` (yang biasanya melewati `devDependencies`).

---

## 4. Alur update berikutnya

Karena **auto-deploy** GitHub sudah aktif, cukup:

```bash
git add -A
git commit -m "perubahan ..."
git push origin main
```

Hostinger akan otomatis: `npm install` → `npm run build` (`vite build`) →
restart aplikasi. Pantau di **Deployments → Logs** atau lewat API:

```
GET  /api/hosting/v1/accounts/{username}/websites/{domain}/nodejs/builds
POST /api/hosting/v1/accounts/{username}/websites/{domain}/nodejs/builds   # trigger build manual
GET  .../nodejs/builds/{uuid}/logs
POST .../nodejs/server/restart
```

> Jangan mengedit isi `hbuilds/` atau `public_html/` secara manual — akan
> ditimpa setiap deploy.

---

## 5. Verifikasi

| URL | Hasil yang benar |
|---|---|
| `https://<domain>/api/health` | `{"ok":true,"service":"wcc-server",...}` (JSON) |
| `https://<domain>/masuk` | Halaman login (HTML 200) |
| `https://<domain>/` | Landing page |
| `https://<domain>/kebijakan-privasi` | Halaman kebijakan privasi (HTML 200) |

---

## 6. Login

```
Email    : nahelahya4@gmail.com
Password : wcc12345
```

Akun demo (`anggota@wcc.id`, `coach@wcc.id`, `pengurus@wcc.id`) sudah
**dihapus dari halaman login**.

---

## 7. Troubleshooting cepat

| Masalah | Solusi |
|---|---|
| Semua rute → **503 Service Unavailable** | Aplikasi crash saat start. Baca `hbuilds/current/nodejs/stderr.log` / `console.log`. |
| `ERR_REQUIRE_ASYNC_MODULE` | Entry harus CommonJS (`server.cjs`), bukan ESM dengan top-level `await`. |
| `/api/*` → 404 HTML, `/` menampilkan statis lama | Application type masih **vite/static**. Set ke **Express**, Output directory **kosong**. |
| `TypeError: Invalid URL` (pg) | Password `DATABASE_URL` memuat karakter khusus — pastikan `connectionString.ts` dipakai (sudah otomatis). |
| `JWT_SECRET wajib diisi` | Set env `JWT_SECRET`. |
| Upload hilang setelah deploy | Set `UPLOAD_DIR` ke folder di luar `hbuilds/` (mis. `/home/<user>/wcc-uploads`). |
| Login sukses tapi langsung logout | `COOKIE_SECURE=true` tapi situs belum HTTPS, atau `CORS_ORIGIN` salah. |
| Gambar tampak "berubah" setelah diunggah | Optimasi gambar otomatis oleh CDN Hostinger (hcdn) — normal, gambar tetap valid. |
