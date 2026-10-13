-- Data profil tambahan calon anggota: identitas KTP (NIK), alamat, riwayat
-- penyakit, data orang tua/wali, dan jenis kelamin.
--
-- Semua kolom nullable agar pendaftaran lama (sebelum penambahan field ini)
-- tetap valid dan tidak menggagalkan migrasi.
alter table registrations add column if not exists nik text;
alter table registrations add column if not exists address text;
alter table registrations add column if not exists medical_history text;
alter table registrations add column if not exists parent_name text;
alter table registrations add column if not exists parent_phone text;
alter table registrations add column if not exists gender text;
