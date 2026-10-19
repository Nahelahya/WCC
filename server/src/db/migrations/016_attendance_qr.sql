-- =====================================================================
--  016 Attendance QR token + session status support
--  - Tambah kolom attendance_token (UUID acak) pada users untuk QR ID card.
--  - Backfill token untuk anggota yang sudah ada.
--  - Unique index agar token tidak duplikat.
-- =====================================================================

alter table users
  add column if not exists attendance_token text;

update users
  set attendance_token = gen_random_uuid()::text
  where attendance_token is null;

create unique index if not exists users_attendance_token_idx
  on users (attendance_token);

-- Kolom status sesi (terjadwal/aktif/selesai) opsional; default null = diturunkan dari tanggal/waktu.
alter table sessions
  add column if not exists status text check (status in ('terjadwal', 'aktif', 'selesai'));
