import { randomBytes } from 'node:crypto'
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

/**
 * Hash OTP sebelum disimpan ke DB (menggunakan skema hash serupa refresh token).
 *
 * Kode dinormalisasi (dibersihkan spasi + dijadikan huruf besar) agar
 * pemeriksaan tidak terpengaruh besar/kecil huruf yang diketik pengguna.
 */
export function hashOtp(code: string): string {
  return hashToken(code.trim().toUpperCase())
}
