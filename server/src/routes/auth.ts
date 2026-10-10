import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { mapUser, type UserRow } from '../lib/mappers'
import { verifyPassword } from '../lib/password'
import { createRefreshToken, hashToken, refreshTokenExpiry, signAccessToken } from '../lib/tokens'
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
  wrap(async (req, res) => {
    const { email } = z.object({ email: z.string().email('Format email tidak valid.') }).parse(req.body ?? {})
    // Tidak membocorkan apakah email terdaftar. Nanti di sini email reset dikirim.
    res.json({
      message: `Jika ${email} terdaftar, kami telah mengirim tautan pemulihan ke email tersebut.`,
    })
  }),
)
