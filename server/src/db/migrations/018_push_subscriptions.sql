-- =====================================================================
-- 018 Push subscriptions (Web Push / VAPID)
-- - Menyimpan subscription per perangkat/browser per user.
-- - Satu endpoint unik per baris; upsert dilakukan berdasarkan endpoint.
-- =====================================================================

create table if not exists push_subscriptions (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
