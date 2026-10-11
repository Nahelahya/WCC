-- Tautan/URL berkas bukti transaksi (hasil unggahan ke penyimpanan berkas).
alter table transactions add column if not exists receipt_url text;
