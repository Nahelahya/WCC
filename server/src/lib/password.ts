import bcrypt from 'bcryptjs'

// Semakin tinggi cost, semakin lambat brute force — dan semakin lama login.
// 10 adalah keseimbangan yang wajar untuk aplikasi seperti ini.
const ROUNDS = 10

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
