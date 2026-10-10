import type { CookieOptions, NextFunction, Request, Response } from 'express'
import { env } from '../env'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { newId } from '../lib/ids'
import {
  createRefreshToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
  verifyAccessToken,
} from '../lib/tokens'
import type { Role } from '../types'

export const ACCESS_COOKIE = 'wcc_at'
export const REFRESH_COOKIE = 'wcc_rt'

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000

function cookieBase(): CookieOptions {
  return {
    httpOnly: true, // tidak bisa dibaca JavaScript -> aman dari XSS
    sameSite: 'lax', // mitigasi CSRF
    secure: env.cookieSecure, // true hanya saat HTTPS
  }
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie(ACCESS_COOKIE, token, { ...cookieBase(), path: '/', maxAge: ACCESS_MAX_AGE_MS })
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieBase(),
    // Hanya dikirim ke endpoint auth, bukan ke setiap request.
    path: '/api/auth',
    maxAge: env.refreshTokenDays * 24 * 60 * 60 * 1000,
  })
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), path: '/' })
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: '/api/auth' })
}

export interface SessionUser {
  id: string
  role: Role
  name: string
}

/** Membuat access + refresh token baru dan menyimpannya sebagai cookie. */
export async function issueSession(res: Response, user: SessionUser): Promise<void> {
  setAccessCookie(res, signAccessToken({ sub: user.id, role: user.role, name: user.name }))
  const { token, hash } = createRefreshToken()
  await query(
    `insert into refresh_tokens (id, user_id, token_hash, expires_at)
     values ($1, $2, $3, $4)`,
    [newId('rt'), user.id, hash, refreshTokenExpiry()],
  )
  setRefreshCookie(res, token)
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await query(
    `update refresh_tokens set revoked_at = now()
     where token_hash = $1 and revoked_at is null`,
    [hashToken(token)],
  )
}

/** Membaca pengguna dari access token (cookie atau header Authorization). */
function accessPayload(req: Request) {
  const header = req.header('authorization')
  const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined
  const token = (req.cookies?.[ACCESS_COOKIE] as string | undefined) ?? bearer
  if (!token) return null
  return verifyAccessToken(token)
}

/** Menempelkan `req.auth` bila access token valid. Tidak memaksa login. */
export function attachAuth(req: Request, _res: Response, next: NextFunction): void {
  const payload = accessPayload(req)
  if (payload) req.auth = { userId: payload.sub, role: payload.role }
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) return next(ApiError.unauthorized())
  next()
}

/** Otorisasi berbasis peran (RBAC). */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(ApiError.unauthorized())
    if (!roles.includes(req.auth.role)) return next(ApiError.forbidden())
    next()
  }
}
