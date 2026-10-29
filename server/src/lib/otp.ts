import { randomBytes, timingSafeEqual } from 'node:crypto'
import { query } from '../db/pool'
import { ApiError } from './errors'
import { hashToken } from './tokens'

/** Karakter alfanumerik yang dihindari mudah tertukar (0,O,1,l,I). */
const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** Generate OTP 8 digit (campuran huruf + angka). */
export function generateOtp(length = 8): string {
  let out = ''
  const bytes = randomBytes(length * 2)
  for (let i = 0; i < length; i++) {
    out += ALPHANUM[bytes[i] % ALPHANUM.length]
  }
  return out
}

/** Hash OTP sebelum disimpan ke DB (menggunakan skema hash serupa refresh token). */
export function hashOtp(code: string): string {
  return hashToken(code.trim().toUpperCase())
}

/** Verifikasi OTP secara aman.
 *
 * Pengecekan selalu dilakukan di aplikasi (bukan `otp_hash = $3` di query)
 * agar kode yang salah tetap "ditemukan" dan counter `tries` bertambah.
 * `tries` hanya bertambah saat KEGAGALAN; sukses tidak menaikkan counter
 * (M-01). */
export async function verifyOtp(email: string, purpose: 'email_verify' | 'password_reset', otp: string): Promise<void> {
  const candidateHash = hashToken(otp)
  const { rows } = await query<OtpRow>(
    `select id, otp_hash, used_at, verified_at, expires_at, tries, max_tries
     from otp_codes
     where lower(email) = lower($1) and purpose = $2 and used_at is null and verified_at is null
     order by created_at desc limit 1`,
    [email, purpose],
  )
  const code = rows[0]
  if (!code) throw ApiError.badRequest('Kode OTP tidak valid.')
  if (code.tries >= code.max_tries) throw ApiError.badRequest('Percobaan OTP melebihi batas. Minta kode baru.')
  if (new Date(code.expires_at).getTime() < Date.now()) throw ApiError.badRequest('Kode OTP sudah kedaluwarsa.')

  const matches = await hashTokenEqual(code.otp_hash, candidateHash)
  if (!matches) {
    // Gagal: catat percobaan gagal secara atomik.
    await query('update otp_codes set tries = tries + 1 where id = $1', [code.id])
    throw ApiError.badRequest('Kode OTP tidak valid.')
  }
  // Berhasil: tandai diverifikasi, jangan naikkan tries.
  await query('update otp_codes set verified_at = now() where id = $1', [code.id])
}

interface OtpRow {
  id: string
  otp_hash: string
  used_at: Date | null
  verified_at: Date | null
  expires_at: Date
  tries: number
  max_tries: number
}

/** Bandingkan hash OTP tanpa mengungkapkan panjang / timing lewat. */
async function hashTokenEqual(stored: string, candidate: string): Promise<boolean> {
  const a = Buffer.from(stored)
  const b = Buffer.from(candidate)
  const size = Math.max(a.length, b.length, 32)
  const x = Buffer.concat([a, Buffer.alloc(size - a.length)])
  const y = Buffer.concat([b, Buffer.alloc(size - b.length)])
  if (x.length !== y.length) return false
  try {
    return timingSafeEqual(x, y)
  } catch {
    return false
  }
}
