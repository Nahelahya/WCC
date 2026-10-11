-- Tautan pemulihan password sekali pakai.
-- Yang disimpan adalah HASH token, bukan token asli (pola sama seperti refresh token).
create table if not exists password_reset_tokens (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  token_hash  text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_idx on password_reset_tokens (user_id);
create index if not exists password_reset_tokens_hash_idx on password_reset_tokens (token_hash);
