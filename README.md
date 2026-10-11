# WISANGGENI CLIMBING CLUB — Website Manajemen

Website manajemen WISANGGENI CLIMBING CLUB, dibangun mengikuti `design.md` v1.0 dan PRD
**Wisanggeni Climbing Club Management Website** v1.0.

Repositori berisi **dua bagian**:

- **`src/` — Frontend** (React 18 + Vite 5 + TypeScript + Tailwind).
- **`server/` — Backend** (Express + TypeScript) dengan **database PostgreSQL**, autentikasi
  **JWT + cookie HttpOnly**, dan otorisasi berbasis peran (RBAC).

Frontend dapat dijalankan dalam dua mode melalui variabel lingkungan:

| Mode | `VITE_API_MODE` | Sumber data |
| --- | --- | --- |
| Live (default) | `live` | Backend nyata di `server/` (lewat proxy `/api` pada dev server) |
| Demo offline | `mock` | API tiruan `localStorage` (`src/api/mock.ts`) — tanpa backend |

Titik penggantian tunggal ada di `src/api/client.ts`; komponen UI tidak perlu diubah saat
berpindah mode.

---

## 1. Menjalankan proyek

### 1.1 Backend + database (sekali saja)

Prasyarat: **Docker Desktop** berjalan, dan **Node.js 18+** (diuji pada Node 26).

```bash
# 1. Nyalakan PostgreSQL (Docker Compose di root repo)
docker compose up -d            # container: wcc-db, port 5432, db/user/pass: wcc

# 2. Pasang dependensi backend
cd server
npm install

# 3. Salin env dan (opsional) ganti JWT_SECRET
copy .env.example .env          # Windows; atau: cp .env.example .env

# 4. Buat skema + isi data demo
npm run db:setup                # = db:migrate lalu db:seed

# 5. Jalankan API
npm run dev                     # http://localhost:4000
```

Perintah database lain di `server/`:

```bash
npm run db:migrate   # jalankan migrasi (idempoten)
npm run db:seed      # isi ulang data demo (menghapus data lama)
npm run db:reset     # hapus semua tabel + migrasi, lalu siapkan ulang
npm run typecheck    # cek tipe tanpa build
```

### 1.2 Frontend

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # keluaran produksi di folder dist/
npm run preview  # menguji hasil build
```

Pada dev, Vite mem-proxy `/api` ke `http://localhost:4000` (lihat `vite.config.ts`), sehingga
cookie autentikasi bekerja tanpa konfigurasi CORS tambahan.

Untuk mencoba **tanpa backend**, set `VITE_API_MODE=mock` pada `.env`, lalu jalankan `npm run dev`.

Persyaratan: Node.js 18+ (diuji pada Node 26).

## 2. Akun demo

| Peran    | Email             | Password   |
| -------- | ----------------- | ---------- |
| Anggota  | `anggota@wcc.id`  | `wcc12345` |
| Coach    | `coach@wcc.id`    | `wcc12345` |
| Pengurus | `pengurus@wcc.id` | `wcc12345` |

Tombol pilih akun tersedia di halaman **Masuk** dan mengisi kredensial secara otomatis.
Akun demo dibuat oleh `server/src/db/seed.ts` (mode live) dan oleh data contoh di `src/data/seed.ts`
(mode mock).

Mengembalikan data ke kondisi awal:

- **Mode live**: jalankan `npm run db:seed` di folder `server/`.
- **Mode mock**: **Profil → Reset Data Demo** (atau bersihkan penyimpanan lokal peramban).

---

## 3. Peta halaman yang sudah dibuat

### Publik
| Rute | Halaman |
| --- | --- |
| `/` | Landing page (hero, tentang, jadwal mendatang, coach, cara bergabung, footer) |
| `/coach` | Profil coach publik |
| `/cara-bergabung` | Langkah pendaftaran |
| `/daftar` | Formulir pendaftaran anggota baru + halaman sukses |
| `/daftar/status` | Cek status pendaftaran berdasarkan email |
| `/masuk` | Login (email, password, tampil/sembunyikan, ingat saya, lupa password) |
| `/lupa-password` | Permintaan reset password |
| `/reset-password?token=…` | Halaman tujuan tautan email untuk membuat password baru |

### Aplikasi (setelah login)
| Rute | Anggota | Coach | Pengurus |
| --- | :-: | :-: | :-: |
| `/app` | Dashboard anggota | Dashboard coach | Dashboard pengurus |
| `/app/jadwal` | Jadwal latihan | Jadwal yang diampu | Jadwal **+ tambah/edit/hapus** |
| `/app/jadwal/:id` | Detail + **check-in** | Detail + **daftar hadir** | Detail + **daftar hadir + koreksi status** |
| `/app/absensi` | Riwayat absensi saya | Daftar hadir per sesi | **Rekap absensi + filter + ekspor CSV** |
| `/app/pengumuman` | Daftar + detail | Daftar + detail | Daftar + detail + **kelola (draf/publikasi/hapus)** |
| `/app/coach` | — | — | Kelola data coach |
| `/app/pendaftaran` | — | — | Verifikasi/tolak pendaftaran |
| `/app/kas` | — | — | Kas & Treasury (CRUD transaksi) |
| `/app/laporan` | — | — | Laporan kas + ekspor CSV/PDF |
| `/app/sinkronisasi` | — | — | Status & log sinkronisasi spreadsheet |
| `/app/audit` | — | — | **Jejak audit** transaksi kas (tambah/ubah/hapus + pelaku & waktu) |
| `/app/profil` | Profil, ganti password, riwayat | idem | Pengaturan/Profil |

Halaman yang dibuka tanpa kewenangan menampilkan **“Akses ditolak”**. Ini hanya lapisan UX —
penegakan sebenarnya dilakukan **di server** (`server/src/middleware/auth.ts`), yang membalas **403**
bila peran tidak berwenang (sudah diuji untuk anggota pada `/api/transactions`).

---

## 4. Yang sudah sesuai `design.md`

- **Palet & tipografi**: token warna `--color-*` (primary `#173F35`, accent `#F28C28`, dst.) dan font Inter.
- **Struktur navigasi**: sidebar desktop per peran + bottom navigation mobile + drawer “Lainnya”.
- **Komponen reusable**: `AppShell`, `SidebarNavigation`, `MobileNavigation`, `PageHeader`,
  `StatCard`, `ScheduleCard`, `AnnouncementCard`, `CoachCard`, `StatusBadge`, `DataTable`,
  `FormField` (`Input`/`Select`/`Textarea`/`Checkbox`), `ConfirmDialog`, `Toast/Alert`,
  `EmptyState`, `LoadingSkeleton`, `Pagination`.
- **State**: loading (skeleton), empty, error + tombol coba lagi, validasi field, akses ditolak, submit ganda dicegah.
- **Status aksesibel**: selalu memakai **ikon + teks**, tidak hanya warna.
- **Format Indonesia**: tanggal `11 Oktober 2026`, waktu `19.00`, nominal `Rp150.000`.
- **Responsif**: tabel berubah menjadi kartu di layar kecil, area sentuh ≥44px, tanpa scroll horizontal halaman.
- **Aksi destruktif** memakai dialog konfirmasi.
- **Microcopy** mengikuti contoh pada dokumen desain (mis. “Absensi berhasil dicatat pada pukul 19.05.”).
- **Keamanan UI**: kredensial/token integrasi tidak pernah ditampilkan; status sinkronisasi hanya “berhasil”
  setelah proses selesai.

---

## 5. Kontrak API (sudah diimplementasikan di `server/`)

Endpoint berikut sudah tersedia di backend Express (`server/src/routes/`) dan dipetakan 1:1 oleh
klien live `src/api/live.ts`. Bentuk `Database` pada `src/types.ts` menggambarkan model data
relasional yang dipakai (lihat skema di `server/src/db/migrations/001_init.sql`).

> **Awalan `/api`**: semua path di bawah diawali `/api` (mis. `/api/sessions`). Pada dev, frontend
> (5173) mem-proxy `/api` ke backend (4000). Otorisasi per peran dijaga **di server** melalui
> `server/src/middleware/auth.ts`; pemeriksaan di klien hanya untuk UX.

### Autentikasi
| Method | Endpoint | Fungsi pada klien |
| --- | --- | --- |
| `POST` | `/api/auth/login` | `authApi.login(email, password)` — set cookie `wcc_at` + `wcc_rt` |
| `GET` | `/api/auth/me` | `authApi.me()` |
| `POST` | `/api/auth/refresh` | (otomatis oleh klien) rotasi refresh token |
| `POST` | `/api/auth/logout` | `authApi.logout()` — cabut refresh token |
| `POST` | `/api/auth/forgot-password` | `authApi.requestPasswordReset(email)` — kirim tautan reset (rate limit 5/15 menit) |
| `GET` | `/api/auth/reset-password?token=…` | `authApi.verifyResetToken(token)` — cek tautan masih berlaku |
| `POST` | `/api/auth/reset-password` | `authApi.resetPassword(token, password)` — set password baru, cabut sesi lama |
| `GET` | `/api/health` | cek status server |

**Autentikasi**: access token JWT berumur pendek pada cookie `wcc_at` (HttpOnly, SameSite=Lax) +
refresh token opaque pada cookie `wcc_rt` (path `/api/auth`) dengan **rotasi** saat dipakai ulang.
Password di-hash dengan bcrypt. Login dibatasi 10 percobaan / 15 menit per IP. Token **tidak pernah**
disimpan pada `localStorage` (mode mock dulu memakai `wcc.token`; kini tidak lagi).

### Pengguna & profil
| Method | Endpoint | Fungsi |
| --- | --- | --- |
| `GET` | `/users?role=anggota` | `userApi.list()` |
| `PATCH` | `/users/:id` | `userApi.updateProfile()` |
| `POST` | `/users/:id/password` | `userApi.changePassword()` |

### Jadwal latihan
| Method | Endpoint | Fungsi |
| --- | --- | --- |
| `GET` | `/sessions` | `sessionApi.list()` |
| `GET` | `/sessions/:id` | `sessionApi.get()` |
| `POST` | `/sessions` | `sessionApi.create()` |
| `PATCH` | `/sessions/:id` | `sessionApi.update()` |
| `DELETE` | `/sessions/:id` | `sessionApi.remove()` |

### Absensi
| Method | Endpoint | Fungsi |
| --- | --- | --- |
| `GET` | `/sessions/:id/attendance` | `attendanceApi.bySession()` |
| `GET` | `/attendance?userId=…` | `attendanceApi.byUser()` |
| `GET` | `/attendance?from=…&to=…` | `attendanceApi.recap()` |
| `POST` | `/sessions/:id/attendance/check-in` | `attendanceApi.checkIn()` |
| `PATCH` | `/sessions/:id/attendance/:userId` | `attendanceApi.setStatus()` |

> **Penting**: backend harus memvalidasi jendela waktu check-in (buka 30 menit sebelum, tutup saat sesi
> berakhir), mencegah check-in ganda, dan mencatat waktu dari server — bukan dari klien.

### Pengumuman, coach, pendaftaran
| Method | Endpoint | Fungsi |
| --- | --- | --- |
| `GET` | `/announcements?includeDrafts=…` | `announcementApi.list()` |
| `GET` | `/announcements/:id` | `announcementApi.get()` |
| `POST`/`PATCH` | `/announcements[/:id]` | `announcementApi.save()` |
| `DELETE` | `/announcements/:id` | `announcementApi.remove()` |
| `GET` | `/coaches` · `/coaches/:id` | `coachApi.list()` / `get()` |
| `POST`/`PATCH` | `/coaches[/:id]` | `coachApi.save()` |
| `DELETE` | `/coaches/:id` | `coachApi.remove()` |
| `GET` | `/registrations` | `registrationApi.list()` |
| `POST` | `/registrations` | `registrationApi.submit()` (publik) |
| `GET` | `/api/registrations/status?email=…` | `registrationApi.getByEmail()` (publik; tanpa catatan internal) |
| `PATCH` | `/registrations/:id/status` | `registrationApi.setStatus()` |

### Kas, laporan, sinkronisasi
| Method | Endpoint | Fungsi |
| --- | --- | --- |
| `GET` | `/transactions` | `treasuryApi.list()` |
| `GET` | `/transactions/summary?from=…&to=…` | `treasuryApi.summary()` |
| `POST`/`PATCH` | `/transactions[/:id]` | `treasuryApi.save()` |
| `DELETE` | `/transactions/:id` | `treasuryApi.remove()` |
| `GET` | `/api/audit-logs?action=…&entity=…` | `auditApi.list()` — jejak audit kas (khusus pengurus) |
| `GET` | `/api/sync/status` | `syncApi.get()` — plus `configured`, `reason`, `tab`, `columns` |
| `POST` | `/api/sync/run` | `syncApi.run()` — sinkron nyata; **200** sukses, **503** belum dikonfigurasi, **502** bila Google gagal |
| `POST` | `/api/uploads` | `uploadApi.upload(file)` — unggah bukti transaksi / foto coach (multipart, field `file`, maks 5 MB) |
| `GET` | `/uploads/:file` | penyajian berkas hasil unggahan (statis, tanpa autentikasi) |

Struktur kolom spreadsheet: `Tanggal | Tipe | Kategori | Nominal | Keterangan | Dicatat Oleh`.

### Ringkasan dashboard
`GET /dashboard/member`, `GET /dashboard/admin`, `GET /dashboard/coach`, `GET /sessions/:id/summary`
— diwakili `statsApi.*`.

---

## 6. Yang masih saya butuhkan dari Anda

### Wajib untuk produksi
1. ✅ **Backend REST API + database relasional** — selesai (Express + PostgreSQL di `server/`).
2. ✅ **Autentikasi & otorisasi server** — selesai (JWT + cookie HttpOnly, bcrypt, RBAC, refresh
   token dengan rotasi, rate limit login).
3. ⏳ **Kredensial Google Sheets** — kode & integrasi **selesai** (lihat **bagian 9**). Yang tinggal
   diminta dari Anda: **berkas Service Account JSON** + **ID spreadsheet**, lalu **bagikan** spreadsheet
   ke email service account sebagai Editor. Sinkronisasi otomatis terjadwal dapat diaktifkan lewat
   `SHEETS_SYNC_INTERVAL_MINUTES`.
4. ✅ **Layanan email** — kode **selesai**: modul `server/src/lib/mailer.ts` mengirim lewat **SMTP**
   (nodemailer) bila `SMTP_HOST` diisi, dan otomatis beralih ke **mode log** (isi email dicetak ke
   konsol server) bila belum. Dipakai untuk **reset password** dan **notifikasi pendaftaran**
   (diterima / diverifikasi / ditolak). Yang tinggal dari Anda: **kredensial SMTP** (host, port,
   user, password) atau penyedia seperti SendGrid/Resend.
5. ✅ **Penyimpanan berkas** — kode **selesai**: unggahan disimpan di disk server (`UPLOAD_DIR`,
   default `server/uploads/`) dan disajikan lewat `/uploads/:file`; kolom `receipt_url` (bukti
   transaksi) & `photo_url` (foto coach) kini terisi. Untuk produksi tinggal ganti penyimpanan ke
   **object storage** (S3/GCS) atau pasang **volume persisten** + backup.
6. **Domain & hosting** (mis. Vercel/Netlify untuk frontend, VPS/Cloud Run untuk API) + HTTPS.
7. **Kebijakan privasi & persetujuan pemrosesan data pribadi** (formulir pendaftaran sudah menyertakannya).
8. ✅ **Audit log transaksi kas** (siapa, kapan, perubahan apa) — selesai, lihat `/app/audit`.

### Aset & konten
9. **Logo**: sudah dipakai dari `WCC.png` yang Anda kirim → `public/logo-wcc.png`
   (varian lain: `logo-wcc-wide.png`, `logo-fpti.png`, `jersey.png`).
   Jika ingin versi putih/transparan untuk latar gelap, mohon kirimkan berkasnya.
10. **Foto kegiatan / hero** untuk landing page. Saat ini area foto memakai panel gradien + logo
    karena foto resmi belum dipilih (saya tidak dapat menilai isi gambar).
11. **Data resmi klub**: alamat lengkap, email, nomor kontak (saat ini placeholder),
    tahun berdiri, jumlah anggota sebenarnya, dan tautan media sosial.

### Keputusan produk (dari bagian 15 `design.md`)
12. Apakah landing page **mempublikasikan jadwal** secara terbuka.
13. **Aturan waktu check-in** final + apakah pengurus dapat mengoreksi check-in (saat ini: 30 menit sebelum s/d sesi berakhir; pengurus dapat koreksi).
14. **Data wajib** pada formulir pendaftaran (saat ini: nama, email, kontak, pengalaman, persetujuan).
15. **Kebijakan transparansi kas** untuk anggota (halaman kas saat ini khusus pengurus).
16. Apakah **coach boleh mengubah** absensi atau hanya melihat (implementasi saat ini: hanya melihat).
17. **Kategori transaksi kas** yang final dan aturan edit/hapus transaksi.
18. Ekspor **CSV/PDF** pada fase pertama atau lanjutan (di prototype keduanya sudah tersedia).

---

## 7. Struktur folder

```
src/                         # FRONTEND
  api/client.ts            # titik tunggal pemilihan mode (mock | live)
  api/mock.ts              # API tiruan (localStorage) untuk mode demo
  api/live.ts              # klien fetch ke backend (cookie-based)
  api/types.ts             # tipe respons bersama
  components/
    cards/                 # StatCard, ScheduleCard, AnnouncementCard, CoachCard
    layout/                # AppShell, SidebarNavigation (sidebar + bottom nav), PageHeader, nav.ts, PublicLayout
    ui/                    # Button, Field, StatusBadge, DataTable, Modal, Feedback, Icon, Logo
  context/                 # AuthContext, ToastContext
  data/seed.ts             # Data contoh untuk mode mock
  lib/                     # date.ts (format Indonesia), session.ts (status & check-in), hooks.ts
  pages/
    public/                # Landing, coach, login, pendaftaran
    app/                   # Dashboard, jadwal, absensi, pengumuman, profil
    app/admin/             # Coach, pendaftaran, kas, laporan, sinkronisasi
  types.ts                 # Model data

server/                      # BACKEND
  src/
    index.ts               # entri HTTP (port 4000) + penjadwal sinkronisasi
    app.ts                 # perakitan Express + CORS + cookie + pemasangan router
    env.ts                 # pembacaan variabel lingkungan
    types.ts
    lib/                   # errors, async, ids, password, tokens, time, mappers
      mailer.ts            # pengiriman email (SMTP via nodemailer; fallback: log konsol)
      emails.ts            # template email (reset password, notifikasi pendaftaran)
      uploads.ts           # penyimpanan berkas disk lokal (multer) + URL publik
      sheets.ts            # klien Google Sheets API v4 (service account JWT)
    services/
      syncService.ts       # orkestrasi sinkronisasi + rekonsiliasi + log
    db/
      pool.ts              # koneksi pg
      migrations/001_init.sql
      migrate.ts · seed.ts · reset.ts
    scripts/
      sheets-check.ts      # diagnostik koneksi Google Sheets
    middleware/            # auth.ts (JWT/cookie/RBAC), error.ts
    routes/                # auth, users, sessions+attendance, announcements,
                           # coaches, registrations, transactions, audit, uploads,
                           # sync, dashboard
  docker-compose.yml       # (di root) PostgreSQL 16
```

## 8. Catatan

- Mode **live**: data tersimpan di PostgreSQL (`wcc-db`); gunakan `npm run db:seed` untuk
  mengembalikan data demo.
- Mode **mock**: data tersimpan pada `localStorage` peramban (`wcc.db`); membersihkan data peramban
  akan mengembalikan data contoh, dan data contoh “digeser” otomatis setiap hari agar sesi
  berlangsung selalu tersedia untuk mendemokan check-in.
- Token sesi **hanya** pada cookie HttpOnly; `localStorage` tidak lagi dipakai pada mode live.
- **Email**: bila `SMTP_HOST` belum diisi, email (mis. tautan reset password) **dicetak ke konsol
  server** agar alur tetap dapat diuji. Isi kredensial SMTP pada `server/.env` untuk pengiriman nyata.
- **Unggahan berkas**: tersimpan di folder `server/uploads/` (diabaikan git) dan disajikan di
  `/uploads/...`. Pada dev, Vite mem-proxy `/uploads` ke backend. Untuk produksi gunakan object
  storage atau volume persisten.
- Ekspor PDF memakai dialog cetak peramban (pilih “Simpan sebagai PDF”); produksi sebaiknya memakai
  pustaka PDF di sisi server.

---

## 9. Sinkronisasi Google Sheets (poin 3)

Backend menyinkronkan **kas klub** ke Google Sheets memakai *service account*. UI hanya
menampilkan status & log — kredensial tidak pernah keluar dari server.

**Cara kerja**

1. `POST /api/sync/run` (khusus pengurus) menandai status `running`.
2. Seluruh tabel `transactions` ditulis ulang (*full refresh*) ke tab tujuan, terurut menaik
   menurut tanggal — menjamin selisih **0%**.
3. Backend **membaca ulang** tab lalu membandingkan jumlah baris + total nominal (rekonsiliasi).
   Bila tidak cocok → status `failed`.
4. Hasil (`success`/`failed`) dicatat pada `sync_logs` dan `sync_state`.

Struktur kolom: `Tanggal | Tipe | Kategori | Nominal | Keterangan | Dicatat Oleh`.

### 9.1 Menyiapkan kredensial (sekali saja)

1. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat/pilih proyek.
2. **APIs & Services → Library** → aktifkan **Google Sheets API**.
3. **IAM & Admin → Service Accounts** → **Create service account** (nama bebas).
4. Buka service account → tab **Keys** → **Add key → Create new key → JSON**. Berkas JSON akan
   terunduh — **jangan pernah di-commit**.
5. Simpan berkas ke `server/service-account.json` (pola ini sudah masuk `.gitignore`).
6. Buat spreadsheet baru, lalu **share** ke `client_email` pada berkas JSON
   (mis. `wcc-sync@proyek-anda.iam.gserviceaccount.com`) sebagai **Editor**.
7. Isi `server/.env`:

   ```ini
   GOOGLE_SHEETS_ID=<id-spreadsheet>     # bagian antara /d/ dan /edit pada URL
   GOOGLE_SHEETS_TAB=Kas                 # dibuat otomatis bila belum ada
   GOOGLE_SERVICE_ACCOUNT_FILE=service-account.json
   # Alternatif: GOOGLE_SERVICE_ACCOUNT_JSON=<JSON satu baris atau base64>
   SHEETS_SYNC_INTERVAL_MINUTES=0        # 0 = hanya manual; mis. 60 = tiap jam
   ```

8. Uji koneksi:

   ```bash
   cd server
   npm run sheets:check      # periksa token, akses tab, dan jumlah transaksi
   ```

Lalu buka `/app/sinkronisasi` dan klik **Sinkronkan Sekarang**.

**Pesan kegagalan** disajikan dalam bahasa yang mudah dipahami, misalnya:

- *“Akses ke spreadsheet ditolak. Bagikan spreadsheet ke … sebagai Editor, lalu coba lagi.”*
- *“Spreadsheet tidak ditemukan. Periksa kembali GOOGLE_SHEETS_ID…”*
- *“Tidak dapat menghubungi Google Sheets. Periksa koneksi server dan coba lagi.”*

> Selama kredensial belum diisi, `GET /api/sync/status` mengembalikan `configured: false` + `reason`,
> dan `POST /api/sync/run` membalas **503** dengan pesan yang sama — bukan pura-pura berhasil.
> UI menampilkan panduan penyiapan agar pengurus tahu apa yang harus dilengkapi.
