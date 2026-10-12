# Deploy ke Hostinger — WISANGGENI CLIMBING CLUB

Panduan ini untuk hosting **Hostinger Business (Node.js)** dengan metode
**build lokal → upload → jalankan Node.js app**.

Arsitektur:

```
Hostinger domain
   └── Node.js app (entry: server.js)
          ├── server/src  → backend Express (TypeScript, dijalankan via tsx)
          └── dist/       → frontend React hasil build (dilayani Express, SPA fallback)
```

Frontend dan API berada pada **satu origin** (`/api/...`), jadi tidak ada masalah CORS.

---

## 0. Ringkasan masalah lama

| Gejala | Penyebab |
|---|---|
| `/api/*` → 404 HTML | Node.js app tidak berjalan. hPanel hanya melayani file statis. |
| `/masuk` → 404 | Express tidak melayani frontend/SPA fallback. |
| Backend tidak start walau dijalankan | `server.js` butuh `tsx` + `server/src`, tetapi dependency server ada di `server/package.json` (tidak di-install Hostinger). |

Semua sudah diperbaiki di repo ini:

- `server.js` memuat `server/src/index.ts` lewat `tsx`.
- `server/src/app.ts` melayani `dist/` + SPA fallback (`/masuk` dsb).
- Semua dependency server dipindah ke **root `package.json`** supaya di-install Hostinger.

---

## 1. Siapkan paket deploy (di komputer lokal)

```
npm install
npm run build:web          # menghasilkan folder dist/
```

Paket siap-upload ada di **`D:\WCC-Hostinger-NodeJS.zip`** (dibuat dari `D:\WCC-deploy`).

Isi paket:

```
dist/                  # frontend hasil build
server.js              # entry point
package.json           # dependency (express, pg, tsx, dll)
package-lock.json
server/
  src/                 # source backend (TypeScript)
  package.json
  tsconfig.json
```

> Jangan upload `node_modules`, `.env`, atau folder `uploads` dari lokal.

---

## 2. Upload ke Hostinger

1. hPanel → **Files → File Manager** → masuk ke `public_html`.
2. Hapus file lama (kecuali Anda tahu isinya), lalu **Upload** file `WCC-Hostinger-NodeJS.zip`.
3. Klik kanan ZIP → **Extract** ke `public_html`.
4. Pastikan struktur akhir:

```
public_html/
  dist/
  server/
    src/
  server.js
  package.json
```

---

## 3. Aktifkan Node.js Application

hPanel → **Advanced → Node.js** (atau **Website → Node.js**).

### Bila belum ada aplikasi → **Create Application**

| Field | Nilai |
|---|---|
| Domain | `navajowhite-stingray-927086.hostingersite.com` |
| Application root | `public_html` |
| Application startup file | `server.js` |
| Application type | **express** (bukan static/vite) |
| Output directory | **kosongkan** |
| Node.js version | **22** (minimal 20) |

Klik **Create**.

> ⚠️ **Penting:** Jika Hostinger salah mendeteksi sebagai *vite/static*,
> pilih manual **Application type = express** dan **Entry file = server.js**.
> Kalau tidak, backend tidak akan pernah dijalankan.

### Bila sudah ada aplikasi

1. Buka aplikasinya, klik **Stop** dulu bila status Running/Error.
2. Pastikan konfigurasi sama seperti tabel di atas.
3. Klik **Run / Start**.

---

## 4. Install dependency di server

Buka **Advanced → Terminal** (atau SSH) lalu:

```bash
cd ~/public_html
npm install --omit=dev
```

Ini memasang `express`, `pg`, `tsx`, `cors`, dll dari `package.json`.

> Gunakan `--omit=dev` karena `vite`/`typescript` tidak dibutuhkan di server
> (frontend sudah di-build). `tsx` **wajib** ada karena menjalankan TypeScript backend.

---

## 5. Atur Environment Variables

hPanel → Node.js → **Environment Variables** (atau buat file `public_html/.env`).

### Wajib

| Variable | Nilai |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | string acak panjang (lihat catatan di bawah) |
| `DATABASE_URL` | connection string PostgreSQL (Supabase) |
| `CORS_ORIGIN` | `https://navajowhite-stingray-927086.hostingersite.com` |
| `PUBLIC_APP_URL` | `https://navajowhite-stingray-927086.hostingersite.com` |
| `COOKIE_SECURE` | `true` |

> **JANGAN set `PORT`.** Hostinger menyediakan port secara otomatis lewat
> `process.env.PORT`. App sudah membaca nilai itu.

### Opsional (email)

| Variable | Nilai |
|---|---|
| `SMTP_HOST` | mis. `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | alamat Gmail |
| `SMTP_PASS` | app password Gmail (16 karakter) |
| `SMTP_SECURE` | `false` |
| `MAIL_FROM` | `WISANGGENI CLIMBING CLUB <no-reply@wcc.id>` |

Jika `SMTP_HOST` kosong, email hanya ditulis ke log server (tidak terkirim).

### Database

Gunakan `DATABASE_URL` PostgreSQL Supabase yang sudah ada, contoh:

```
postgresql://postgres.iiwujuwliqlwgdhdtayw:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

Set `COOKIE_SECURE=true` hanya bila domain memakai **HTTPS** (Hostinger
menyediakan SSL gratis — aktifkan di hPanel → SSL).

---

## 6. Jalankan & verifikasi

1. Node.js → klik **Run / Restart**.
2. Buka **Logs** bila ada error.
3. Uji dari browser:

| URL | Hasil yang benar |
|---|---|
| `https://<domain>/api/health` | `{"ok":true,"service":"wcc-server",...}` (JSON) |
| `https://<domain>/masuk` | Halaman login (HTML, bukan 404) |
| `https://<domain>/` | Landing page |

Jika `/api/health` masih 404 HTML → Node.js app belum jalan (ulangi langkah 3).
Jika muncul JSON error tapi bukan `ok` → cek **Logs** untuk pesan error
(mis. `Cannot find module 'express'` → langkah 4 belum dijalankan,
`DATABASE_URL ...` → env database salah).

---

## 7. Login

Akun admin (ubah password setelah login pertama):

```
Email    : nahelahya4@gmail.com
Password : wcc12345
```

Akun demo (`anggota@wcc.id`, `coach@wcc.id`, `pengurus@wcc.id`) sudah
**dihapus dari halaman login**. Bila tabel pengguna masih berisi akun demo
dan ingin dibersihkan, jalankan skrip seed produksi dari Terminal:

```bash
cd ~/public_html/server
npx tsx src/db/seed-production.ts
```

---

## 8. Alur update berikutnya

```bash
# Di komputer lokal
npm run build:web
# lalu upload ulang dist/ (atau zip baru) ke public_html
```

Jika ada perubahan kode backend (`server/src`), upload ulang folder `server/src`
lalu klik **Restart** pada Node.js app.

---

## 9. Troubleshooting cepat

| Masalah | Solusi |
|---|---|
| `/api/*` → 404 HTML | Node.js app belum dibuat/dijalankan, atau entry file bukan `server.js`. |
| `Cannot find module 'express'` | Belum `npm install --omit=dev` di `public_html`. |
| `Cannot find module 'tsx'` | `tsx` tidak ada di `dependencies` / install gagal. |
| `JWT_SECRET wajib diisi` | Set env `JWT_SECRET`. |
| Error koneksi database | Cek `DATABASE_URL` (host, port 6543, password). |
| Login berhasil tapi langsung logout | `COOKIE_SECURE=true` tapi situs belum HTTPS, atau `CORS_ORIGIN` salah. |
| Gambar/font tidak muncul | Cek `public_html/dist/assets` sudah ter-upload lengkap. |
