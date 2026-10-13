-- Data profil anggota pada tabel pengguna.
--
-- Disalin dari formulir pendaftaran saat akun anggota dibuat (ketika pengurus
-- memverifikasi pendaftaran), sehingga pengurus dapat melihat identitas (NIK),
-- jenis kelamin, alamat, riwayat penyakit, dan data orang tua melalui halaman
-- Manajemen Pengguna. Semua kolom nullable agar akun lama tetap valid.
alter table users add column if not exists gender text;
alter table users add column if not exists nik text;
alter table users add column if not exists address text;
alter table users add column if not exists medical_history text;
alter table users add column if not exists parent_name text;
alter table users add column if not exists parent_phone text;

-- Isi data untuk akun yang sudah ada dari pendaftaran terakhir dengan email
-- yang sama. Dijaga `u.nik is null` agar tidak menimpa data bila migrasi
-- dijalankan ulang pada deploy berikutnya.
update users u
set gender          = r.gender,
    nik             = r.nik,
    address         = r.address,
    medical_history = r.medical_history,
    parent_name     = r.parent_name,
    parent_phone    = r.parent_phone
from (
  select distinct on (lower(email))
    lower(email) as email,
    gender, nik, address, medical_history, parent_name, parent_phone
  from registrations
  order by lower(email), submitted_at desc
) r
where lower(u.email) = r.email
  and u.nik is null;
