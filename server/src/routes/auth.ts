import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { mapUser, type UserRow } from '../lib/mappers'
import { verifyPassword, hashPassword } from '../lib/password'
import { createRefreshToken, hashToken, refreshTokenExpiry, signAccessToken } from '../lib/tokens'
import { sendMail } from '../lib/mailer'
import { passwordResetOtpEmail } from '../lib/emails'
import { generateOtp, hashOtp } from '../lib/otp'
import { newId } from '../lib/ids'
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  issueSession,
  revokeRefreshToken,
  setAccessCookie,
  setRefreshCookie,
} from '../middleware/auth'

// Membatasi percobaan login untuk mencegah brute force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan masuk. Silakan coba lagi beberapa menit lagi.' },
})

// Membatasi permintaan tautan reset agar tidak disalahgunakan untuk spam email.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan pemulihan. Silakan coba lagi beberapa menit lagi.' },
})

/** Masa berlaku OTP pemulihan password. */
const OTP_TTL_MINUTES = 5
const OTP_MAX_TRIES = 5

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
})

export const authRouter = Router()

/**
 * Menukar refresh token (cookie) dengan access token baru.
 * Refresh token lama langsung dicabut (rotasi) agar tidak bisa dipakai ulang.
 */
async function refreshSession(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined
  if (!token) return null

  const { rows } = await query<
    UserRow & { rt_id: string; expires_at: Date; revoked_at: Date | null }
  >(
    `select rt.id as rt_id, rt.expires_at, rt.revoked_at, u.*
     from refresh_tokens rt
     join users u on u.id = rt.user_id
     where rt.token_hash = $1
     limit 1`,
    [hashToken(token)],
  )

  const row = rows[0]
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) return null

  await query('update refresh_tokens set revoked_at = now() where id = $1', [row.rt_id])

  const user = mapUser(row)
  const next = createRefreshToken()
  await query(
    `insert into refresh_tokens (id, user_id, token_hash, expires_at)
     values ($1, $2, $3, $4)`,
    [newId('rt'), user.id, next.hash, refreshTokenExpiry()],
  )
  setAccessCookie(res, signAccessToken({ sub: user.id, role: user.role, name: user.name }))
  setRefreshCookie(res, next.token)
  return user
}

authRouter.post(
  '/login',
  loginLimiter,
  wrap(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body ?? {})

    const { rows } = await query<UserRow>('select * from users where lower(email) = lower($1) limit 1', [
      email.trim(),
    ])
    const row = rows[0]

    // Password dibandingkan dengan hash bcrypt. Pesan error disamakan untuk
    // email tidak ditemukan maupun password salah (mencegah user enumeration).
    const ok = row ? await verifyPassword(password, row.password_hash ?? '') : false
    if (!row || !ok) {
      throw ApiError.unauthorized('Email atau password tidak sesuai. Silakan periksa kembali.')
    }

    const user = mapUser(row)
    await issueSession(res, user)
    res.json({ user })
  }),
)

authRouter.get(
  '/me',
  wrap(async (req, res) => {
    if (req.auth) {
      const { rows } = await query<UserRow>('select * from users where id = $1', [req.auth.userId])
      if (rows[0]) return res.json({ user: mapUser(rows[0]) })
    }
    // Access token kedaluwarsa? Coba perpanjang lewat refresh token.
    const user = await refreshSession(req, res)
    res.json({ user: user ?? null })
  }),
)

authRouter.post(
  '/refresh',
  wrap(async (req, res) => {
    const user = await refreshSession(req, res)
    if (!user) throw ApiError.unauthorized()
    res.json({ user })
  }),
)

authRouter.post(
  '/logout',
  wrap(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined
    if (token) await revokeRefreshToken(token)
    clearAuthCookies(res)
    res.json({ ok: true })
  }),
)

authRouter.post(
  '/forgot-password',
  forgotLimiter,
  wrap(async (req, res) => {
    const { email } = z.object({ email: z.string().email('Format email tidak valid.') }).parse(req.body ?? {})

    const { rows } = await query<UserRow>('select * from users where lower(email) = lower($1) limit 1', [email])
    const user = rows[0]

    if (user) {
      // Batalkan OTP password_reset yang belum dipakai
      await query(
        `update otp_codes set used_at = now() where lower(email) = lower($1) and purpose = 'password_reset' and used_at is null and verified_at is null`,
        [user.email],
      )

      const otp = generateOtp(8)
      const otpHash = hashOtp(otp)
      await query(
        `insert into otp_codes (id, user_id, purpose, email, otp_hash, expires_at, max_tries)
         values ($1, $2, 'password_reset', $3, $4, now() + make_interval(mins => $5), $6)`,
        [newId('otp'), user.id, user.email, otpHash, OTP_TTL_MINUTES, OTP_MAX_TRIES],
      )

      await sendMail(passwordResetOtpEmail(user.email, user.name, otp)).catch((error: unknown) => {
        console.error('[otp] gagal mengirim kode OTP reset:', error)
      })
    }

    // Selalu jawaban sama -> tidak membocorkan apakah email terdaftar.
    res.json({
      message: `Jika ${email} terdaftar, kami telah mengirim kode OTP ke email tersebut.`,
    })
  }),
)

// Memeriksa apakah OTP reset masih valid
authRouter.post(
  '/verify-otp',
  wrap(async (req, res) => {
    const { email, purpose, otp } = z
      .object({
        email: z.string().email('Format email tidak valid.'),
        purpose: z.enum(['password_reset', 'email_verify']),
        otp: z.string().min(6).max(12, 'Kode OTP tidak valid.'),
      })
      .parse(req.body ?? {})

    const h = hashOtp(otp)
    const { rows } = await query<{
      id: string
      used_at: Date | null
      verified_at: Date | null
      expires_at: Date
      tries: number
      max_tries: number
    }>(
      `select id, used_at, verified_at, expires_at, tries, max_tries
       from otp_codes
       where lower(email) = lower($1) and purpose = $2 and otp_hash = $3
       order by created_at desc limit 1`,
      [email, purpose, h],
    )

    const c = rows[0]
    if (!c) throw ApiError.badRequest('Kode OTP tidak valid.')
    if (c.used_at) throw ApiError.badRequest('Kode OTP sudah digunakan.')
    if (c.verified_at) throw ApiError.badRequest('Kode OTP sudah diverifikasi sebelumnya.')
    if (new Date(c.expires_at).getTime() < Date.now()) throw ApiError.badRequest('Kode OTP sudah kedaluwarsa.')
    if (c.tries >= c.max_tries) throw ApiError.badRequest('Percobaan OTP melebihi batas. Minta kode baru.')

    await query('update otp_codes set verified_at = now(), tries = tries + 1 where id = $1', [c.id])
    res.json({ verified: true, purpose })
  }),
)

authRouter.post(
  '/reset-password',
  wrap(async (req, res) => {
    const { email, otp, password } = z
      .object({
        email: z.string().email('Format email tidak valid.'),
        otp: z.string().min(6).max(12, 'Kode OTP tidak valid.'),
        password: z.string().min(8, 'Password baru minimal 8 karakter.'),
      })
      .parse(req.body ?? {})

    const h = hashOtp(otp)
    const { rows } = await query<{ id: string; user_id: string; tries: number; max_tries: number; expires_at: Date; used_at: Date | null; verified_at: Date | null }>(
      `select id, user_id, tries, max_tries, expires_at, used_at, verified_at
       from otp_codes
       where lower(email) = lower($1) and purpose = 'password_reset' and otp_hash = $2
       order by created_at desc limit 1`,
      [email, h],
    )

    const c = rows[0]
    if (!c) throw ApiError.badRequest('Kode OTP tidak valid.')
    if (c.used_at) throw ApiError.badRequest('Kode OTP sudah digunakan.')
    if (new Date(c.expires_at).getTime() < Date.now()) throw ApiError.badRequest('Kode OTP sudah kedaluwarsa.')
    if (c.tries >= c.max_tries) throw ApiError.badRequest('Percobaan OTP melebihi batas. Minta kode baru.')

    // Tandai sebagai terpakai
    await query('update otp_codes set used_at = now(), tries = tries + 1 where id = $1', [c.id])

    await query('update users set password_hash = $2, updated_at = now() where id = $1', [
      c.user_id,
      await hashPassword(password),
    ])

    // Cabut semua sesi aktif
    await query('update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null', [c.user_id])

    res.json({ ok: true })
  }),
)
