-- =====================================================================
--  Skema database WISANGGENI CLIMBING CLUB
--  Diterapkan otomatis oleh `npm run db:migrate` (lihat src/db/migrate.ts)
-- =====================================================================

create table if not exists coaches (
  id          text primary key,
  name        text not null,
  expertise   text[] not null default '{}',
  experience  text not null default '',
  photo_url   text,
  bio         text,
  years       integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists users (
  id                text primary key,
  name              text not null,
  email             text not null unique,
  role              text not null check (role in ('anggota', 'coach', 'pengurus')),
  phone             text,
  photo_url         text,
  joined_at         date not null default current_date,
  membership_status text check (membership_status in ('aktif', 'nonaktif', 'pending')),
  coach_id          text references coaches(id) on delete set null,
  -- Kata sandi TIDAK PERNAH disimpan sebagai teks biasa; selalu hash bcrypt.
  password_hash     text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists sessions (
  id          text primary key,
  title       text not null,
  date        date not null,
  start_time  text not null,
  end_time    text not null,
  location    text not null,
  coach_id    text references coaches(id) on delete set null,
  note        text,
  cancelled   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists attendance (
  id           text primary key,
  session_id   text not null references sessions(id) on delete cascade,
  user_id      text not null references users(id) on delete cascade,
  check_in_at  timestamptz not null default now(),
  status       text not null check (status in ('hadir', 'izin', 'alpha')),
  -- Satu anggota hanya boleh punya satu baris absensi per sesi.
  unique (session_id, user_id)
);

create table if not exists announcements (
  id            text primary key,
  title         text not null,
  summary       text not null default '',
  body          text not null,
  priority      text not null default 'normal' check (priority in ('tinggi', 'normal', 'rendah')),
  published_at  timestamptz not null default now(),
  author        text not null default 'Pengurus WCC',
  published     boolean not null default true
);

create table if not exists registrations (
  id             text primary key,
  full_name      text not null,
  email          text not null,
  phone          text not null default '',
  experience     text not null default '',
  motivation     text,
  consent        boolean not null default false,
  status         text not null default 'baru' check (status in ('baru', 'diverifikasi', 'ditolak')),
  submitted_at   timestamptz not null default now(),
  internal_note  text
);
create index if not exists registrations_email_idx on registrations (lower(email));

create table if not exists transactions (
  id            text primary key,
  date          date not null,
  type          text not null check (type in ('pemasukan', 'pengeluaran')),
  category      text not null,
  amount        numeric(14, 2) not null,
  note          text not null default '',
  recorded_by   text not null default 'Pengurus',
  receipt_name  text,
  created_at    timestamptz not null default now()
);
create index if not exists transactions_date_idx on transactions (date desc);

create table if not exists sync_state (
  id            integer primary key default 1,
  status        text not null default 'idle',
  last_sync_at  timestamptz,
  constraint sync_state_singleton check (id = 1)
);
insert into sync_state (id) values (1) on conflict (id) do nothing;

create table if not exists sync_logs (
  id       text primary key,
  at       timestamptz not null default now(),
  status   text not null check (status in ('success', 'failed')),
  message  text not null,
  rows     integer not null default 0
);

-- Token penyegar (refresh token) disimpan dalam bentuk hash, bukan teks asli.
create table if not exists refresh_tokens (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  token_hash  text not null,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists refresh_tokens_user_idx on refresh_tokens (user_id);

-- Jejak audit sederhana (siapa mengubah apa).
create table if not exists audit_logs (
  id          text primary key,
  user_id     text references users(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
