-- =====================================================================
--  Absensi: tambah status 'menunggu'
--
--  Sebelumnya check-in anggota langsung berstatus 'hadir', sehingga anggota
--  yang tidak hadir tetap bisa mengabsen selama jendela waktu terbuka.
--  Sekarang check-in anggota berstatus 'menunggu' dan hanya coach/pengurus
--  yang mengonfirmasi menjadi 'hadir' (atau mengoreksi ke 'izin'/'alpha').
-- =====================================================================

alter table attendance drop constraint if exists attendance_status_check;
alter table attendance add constraint attendance_status_check
  check (status in ('menunggu', 'hadir', 'izin', 'alpha'));
