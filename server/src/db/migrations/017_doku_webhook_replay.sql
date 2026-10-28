-- =====================================================================
-- 017 DOKU webhook replay prevention
-- - Tabel `doku_webhook_replays` menyimpan Request-Id yang sudah diproses,
--   agar webhook retry/duplicate (Request-Id sama) tidak diproses ulang.
-- =====================================================================

create table if not exists doku_webhook_replays (
  request_id varchar(255) primary key,
  created_at timestamptz not null default now()
);
