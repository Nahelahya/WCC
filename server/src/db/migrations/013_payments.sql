-- =====================================================================
--  Pembayaran online (DOKU Checkout)
--  - payments           : "niat bayar" + status transaksi gateway
--  - registrations      : metode & status pembayaran biaya administrasi
--  Idempoten: aman dijalankan berulang.
-- =====================================================================

create table if not exists payments (
  id              text primary key,
  -- 'pendaftaran' = biaya administrasi / 'iuran' = kas bulanan anggota
  purpose         text not null check (purpose in ('pendaftaran', 'iuran')),
  status          text not null default 'pending'
                  check (status in ('pending', 'paid', 'expired', 'failed')),
  amount          numeric(14, 2) not null,
  -- Nomor invoice unik yang dipakai DOKU (tanpa simbol, <= 30 karakter).
  invoice_number  text not null unique,
  user_id         text references users(id) on delete set null,
  registration_id text references registrations(id) on delete set null,
  -- Periode iuran: 'YYYY-MM' (null untuk pembayaran pendaftaran).
  period          text,
  payer_name      text not null default '',
  payer_email     text not null default '',
  payer_phone     text not null default '',
  -- Kanal yang dipilih pembeli di halaman DOKU (VA, e-wallet, dsb).
  channel         text,
  doku_session_id text,
  doku_token_id   text,
  doku_url        text,
  paid_at         timestamptz,
  expires_at      timestamptz,
  -- Salinan mentah notifikasi DOKU, untuk penelusuran/rekonsiliasi.
  notification    jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists payments_user_idx on payments (user_id, created_at desc);
create index if not exists payments_registration_idx on payments (registration_id);
create index if not exists payments_status_idx on payments (status);
create index if not exists payments_period_idx on payments (user_id, purpose, period);

-- Metode bayar yang dipilih calon anggota: 'cash' | 'gateway'.
alter table registrations add column if not exists payment_method text;
-- 'belum' | 'lunas'.
alter table registrations add column if not exists payment_status text;
