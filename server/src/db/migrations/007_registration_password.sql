-- Password pilihan calon anggota saat mendaftar.
--
-- Disimpan sebagai hash bcrypt (bukan teks biasa). Dipakai untuk membuat akun
-- otomatis begitu pendaftaran diverifikasi, sehingga anggota baru bisa langsung
-- masuk (login) dengan email + password yang mereka buat sendiri.
alter table registrations add column if not exists password_hash text;
