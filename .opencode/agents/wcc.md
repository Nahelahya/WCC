---
description: Eksekutor repo WISANGGENI CLIMBING CLUB (React+Vite / Express+PostgreSQL)
mode: primary
permissions:
  # Agen boleh commit lokal, tetapi TIDAK boleh push/deploy.
  # Push hanya lewat /usr/local/bin/wcc-deploy setelah disetujui manusia.
  - action: shell
    resource: "*git push*"
    effect: deny
  - action: shell
    resource: "*git reset --hard*"
    effect: deny
  - action: shell
    resource: "*git clean -*"
    effect: deny
  - action: shell
    resource: "*rm -rf *"
    effect: deny
  - action: shell
    resource: "*sudo *"
    effect: deny
  - action: shell
    resource: "*npm publish*"
    effect: deny
  - action: shell
    resource: "*shutdown*"
    effect: deny
  - action: shell
    resource: "*reboot*"
    effect: deny

  # Rahasia tidak boleh dibaca, kecuali contohnya.
  - action: read
    resource: "**/.env"
    effect: deny
  - action: read
    resource: "**/.env.*"
    effect: deny
  - action: read
    resource: "**/.env.example"
    effect: allow
  - action: read
    resource: "**/*.pem"
    effect: deny
  - action: read
    resource: "**/id_ed25519*"
    effect: deny
---

Kamu bekerja pada repo WISANGGENI CLIMBING CLUB (WCC) di
`/home/wcc/apps/WCC`. Stack: React 18 + Vite 8 (frontend), Express 4 +
PostgreSQL (backend), satu origin. Produksi: `https://wisanggeniclub.site`
(Hostinger, Node 22).

## Aturan wajib

1. Baca `README.md`, `HOSTINGER.md`, dan `docs/handoff-hermes-ubuntu.md`
   sebelum mengubah apa pun.
2. Jangan pernah membaca, mencetak, atau meng-commit `.env`, token, kunci,
   atau dump database.
3. Jangan mengubah framework, database, tema, atau struktur navigasi tanpa
   diminta eksplisit.
4. Ikuti pola kode yang ada: komentar bahasa Indonesia, struktur
   `src/pages`, `src/api`, `server/src/routes`, penamaan yang konsisten.
5. Setiap perubahan wajib diverifikasi:
   - `npm run typecheck`
   - `cd server && npm run typecheck`
   - `npm run build`
6. **Jangan push, jangan deploy, jangan menjalankan migrasi DB.** Itu tugas
   `wcc-deploy` dan manusia. Tinggalkan perubahan sebagai commit lokal.
7. Jangan menambah dependency baru tanpa alasan kuat.
8. Jangan mengedit `hbuilds/` atau `public_html/` di Hostinger.

## Cara kerja

- Kalau tugas ambigu atau menyentuh skema DB, berhenti dan tulis
  `BUTUH KEPUTUSAN: ...` dalam ringkasan akhir.
- Kalau ada bug, gunakan skill `systematic-debugging` (cari akar masalah
  sebelum memperbaiki).
- Kalau membuat fitur, gunakan `brainstorming` lalu `writing-plans`.
- Akhiri dengan ringkasan: file yang diubah, hasil verifikasi, commit hash.
