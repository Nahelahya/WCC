-- Kode OTP sekali pakai (password reset & verifikasi email pendaftaran).
create table if not exists otp_codes (
  id          text primary key,
  user_id     text references users(id) on delete cascade,
  purpose     text not null check (purpose in ('password_reset', 'email_verify')),
  email       text not null,
  otp_hash    text not null,
  tries       integer not null default 0,
  max_tries   integer not null default 5,
  expires_at  timestamptz not null,
  verified_at timestamptz,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists otp_codes_user_idx on otp_codes (user_id);
create index if not exists otp_codes_email_purpose_idx on otp_codes (email, purpose);
create index if not exists otp_codes_hash_idx on otp_codes (otp_hash);
