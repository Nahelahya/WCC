# Deployment Guide - WISANGGENI CLIMBING CLUB

## Target: Render (Full-Stack) + Neon (Database)

### Prerequisites
- [ ] Akun GitHub (untuk connect repo)
- [ ] Akun Render (https://render.com)
- [ ] Akun Neon (https://neon.tech)
- [ ] Gmail app password baru (https://myaccount.google.com/apppasswords)

---

## Step 1: Buat Database di Neon

1. Login ke https://neon.tech
2. Klik **"New Project"**
3. Nama project: `wcc-production`
4. Region: pilih yang terdekat (Singapore/Tokyo)
5. Copy **Connection String** (format: `postgres://user:pass@host/dbname`)
6. Simpan di tempat aman

---

## Step 2: Buat Gmail App Password Baru

1. Login ke https://myaccount.google.com/apppasswords
2. Nama app: `WCC Production`
3. Copy 16-character password (format: `xxxx xxxx xxxx xxxx`)
4. Simpan di tempat aman

---

## Step 3: Push Code ke GitHub

```bash
git add .
git commit -m "Production deployment setup"
git push origin main
```

---

## Step 4: Deploy ke Render

### 4.1 Buat Web Service Baru

1. Login ke https://render.com
2. Klik **"New +" > "Web Service"**
3. Connect repo GitHub Anda
4. Pilih repo ini

### 4.2 Konfigurasi Render

| Field | Value |
|---|---|
| **Name** | `wcc-app` |
| **Branch** | `main` |
| **Runtime** | **Node** |
| **Build Command** | `npm install && npm run build && cd server && npm install && npm run build` |
| **Start Command** | `cd server && npm start` |
| **Instance Type** | Free |

### 4.3 Environment Variables (Render Dashboard)

Set ini di **Environment** tab:

```
NODE_ENV=production
PORT=4000
DATABASE_URL=<Neon connection string>
JWT_SECRET=<sudah di-generate di .env>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_DAYS=30
CORS_ORIGIN=https://wcc-app.onrender.com
COOKIE_SECURE=true
PUBLIC_APP_URL=https://wcc-app.onrender.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=nahelahya4@gmail.com
SMTP_PASS=<Gmail app password 16-char>
MAIL_FROM=WISANGGENI CLIMBING CLUB <nahelahya4@gmail.com>
UPLOAD_DIR=uploads
UPLOAD_MAX_MB=5
GOOGLE_SHEETS_ID=18-B3nKarCdsm48VUn8dm_d8F4rOgS--06qZOm1eJGl8
GOOGLE_SHEETS_TAB=Kas
SHEETS_SYNC_INTERVAL_MINUTES=0
SHEETS_REQUEST_TIMEOUT_MS=15000
```

### 4.4 Deploy

Klik **"Create Web Service"** — Render akan build + deploy otomatis.

---

## Step 5: Setup Database Migrasi

Migrasi akan otomatis jalan saat server start (via `start.sh`).
Cek logs di Render dashboard untuk memastikan migrasi berhasil.

---

## Step 6: Verifikasi

1. Buka `https://wcc-app.onrender.com/api/health` → harus return `{"ok":true}`
2. Buka `https://wcc-app.onrender.com` → landing page harus muncul
3. Test login, registrasi, dst

---

## Domain Custom (Opsional)

Kalau nanti sudah punya domain:
1. Render dashboard > Settings > Custom Domain
2. Tambah domain + update DNS records
3. Update `CORS_ORIGIN` dan `PUBLIC_APP_URL` di Render env vars

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Build failed | Cek pastikan `npm run build` sukses di local |
| DB connection error | Verify Neon connection string + allow Render IP |
| SMTP gagal | Pastikan app password benar, bukan password Gmail biasa |
| CORS error | Update `CORS_ORIGIN` ke domain Render yang benar |
