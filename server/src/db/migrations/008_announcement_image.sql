-- Tautan/URL gambar pada pengumuman (hasil unggahan ke penyimpanan berkas).
alter table announcements add column if not exists image_url text;
