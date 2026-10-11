import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import multer from 'multer'
import { env } from '../env'
import { ApiError } from './errors'

/**
 * Penyimpanan berkas lokal (disk) untuk prototype.
 *
 * Berkas disimpan di folder `UPLOAD_DIR` (default `server/uploads`) dan
 * disajikan kembali lewat `GET /uploads/<nama>`. Untuk produksi, ganti
 * `storage` dengan adaptor S3/GCS tanpa mengubah rute pemanggil.
 */

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
])

export function uploadDir(): string {
  return resolve(process.cwd(), env.uploadDir)
}

/** URL publik relatif untuk sebuah nama berkas. */
export function publicUrl(filename: string): string {
  return `/uploads/${filename}`
}

/** Middleware unggah satu berkas pada field `file`. */
export const uploadSingle = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = uploadDir()
      mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (_req, file, cb) => {
      const safeExt = extname(file.originalname)
        .toLowerCase()
        .replace(/[^.a-z0-9]/g, '')
        .slice(0, 8)
      cb(null, `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${safeExt}`)
    },
  }),
  limits: { fileSize: env.uploadMaxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new ApiError(400, 'Jenis berkas tidak diizinkan. Gunakan gambar (PNG/JPG/WebP) atau PDF.'))
      return
    }
    cb(null, true)
  },
})
