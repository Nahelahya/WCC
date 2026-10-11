import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../env'
import type { Role } from '../types'

export interface AccessTokenPayload {
  sub: string
  role: Role
  name: string
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.accessTokenTtl as jwt.SignOptions['expiresIn'],
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret)
    if (typeof decoded === 'string') return null
    return { sub: String(decoded.sub), role: decoded.role as Role, name: String(decoded.name ?? '') }
  } catch {
    return null
  }
}

/** Token acak sekali pakai (mis. tautan reset password); hanya hash yang disimpan di DB. */
export function createOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex')
  return { token, hash: hashToken(token) }
}

/** Refresh token = string acak; yang disimpan di database hanya hash-nya. */
export function createRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000)
}
