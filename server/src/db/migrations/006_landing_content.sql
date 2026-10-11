-- --------------------------------------------------------------------
-- Konten landing page (dapat diedit oleh pengurus tanpa ubah kode)
-- --------------------------------------------------------------------

create table if not exists landing_content (
  id          text primary key default 'default',
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text references users(id) on delete set null
);

-- Inisialisasi kosong (akan diisi otomatis saat pertama kali di-load dengan fallback default)
insert into landing_content (id, data)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;