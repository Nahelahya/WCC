-- Waktu email calon anggota terverifikasi melalui kode OTP.
-- Dipakai agar pengurus dapat melihat apakah email pendaftar sudah
-- terverifikasi sebelum memutuskan verifikasi/tolak pendaftaran.
alter table registrations add column if not exists email_verified_at timestamptz;
