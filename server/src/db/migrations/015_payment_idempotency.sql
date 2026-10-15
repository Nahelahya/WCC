-- =====================================================================
--  Idempotensi checkout pembayaran.
--  Klien mengirim `idempotencyKey` unik per niat bayar; server memakainya
--  untuk mengembalikan invoice yang sama bila permintaan diulang (klik
--  ganda / retry jaringan), sehingga tidak tercipta invoice ganda.
--  Idempoten: aman dijalankan berulang.
-- =====================================================================

alter table payments add column if not exists idempotency_key text;

create unique index if not exists payments_idempotency_uq
  on payments (idempotency_key) where idempotency_key is not null;
