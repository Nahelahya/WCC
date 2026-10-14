-- =====================================================================
--  Tautan transaksi kas -> baris pembayaran
--  Dipakai untuk iuran tunai yang dicatat pengurus: satu pembayaran
--  menghasilkan tepat satu baris pemasukan di Kas & Treasury sehingga
--  perubahan/penghapusan catatan ikut tersinkron (ON DELETE CASCADE).
--  Idempoten: aman dijalankan berulang.
-- =====================================================================

alter table transactions
  add column if not exists payment_id text references payments(id) on delete cascade;

create index if not exists transactions_payment_idx on transactions (payment_id);
