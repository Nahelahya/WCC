import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, resolve, join } from 'node:path'
import multer from 'multer'
import { env } from '../env'
import { ApiError } from './errors'

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
])

const MAGIC_SIGNATURES: Array<{ mime: string; sig: Buffer }> = [
  { mime: 'image/png',  sig: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) },
  { mime: 'image/jpeg', sig: Buffer.from([0xFF, 0xD8, 0xFF]) },
  { mime: 'image/gif',  sig: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) }, // GIF89a
  { mime: 'image/gif',  sig: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) }, // GIF87a
  { mime: 'application/pdf', sig: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]) }, // %PDF-
]

function detectMime(buffer: Buffer): string | null {
  for (const { mime, sig } of MAGIC_SIGNATURES) {
    if (buffer.length < sig.length) continue
    let match = true
    for (let i = 0; i < sig.length; i += 1) {
      if (buffer[i] !== sig[i]) {
        match = false
        break
      }
    }
    if (match) return mime
  }
  return null
}

function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime)
}

function readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

export function uploadDir(): string {
  return resolve(process.cwd(), env.uploadDir)
}

/** URL publik relatif untuk sebuah nama berkas. */
export function publicUrl(filename: string): string {
  return `/uploads/${filename}`
}

/** Middleware unggah satu berkas pada field `file`. */
export const uploadSingle = multer({
  storage: {
    async _handleFile(req, file, callback) {
      const buffer = await readStream(file.stream)
      const detected = detectMime(buffer)
      if (!detected || !isAllowedMime(detected)) {
        callback(new ApiError(400, 'Isi berkas tidak sesuai jenisnya. Gunakan PNG, JPG, WebP, atau PDF.'))
        return
      }
      const safeExt = extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8)
      const filename = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${safeExt}`
      const dir = uploadDir()
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, filename), buffer)
      callback(null, { filename, mimetype: detected })
    },

    _removeFile(req, file, callback) {
      try {
        const filepath = join(uploadDir(), file.filename)
        if (existsSync(filepath)) unlinkSync(filepath)
      } catch {
        // ignore
      } finally {
        callback?.()
      }
    },
  },
  limits: { fileSize: env.uploadMaxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedMime(file.mimetype)) {
      cb(new ApiError(400, 'Jenis berkas tidak diizinkan. Gunakan gambar (PNG/JPG/WebP) atau PDF.'))
      return
    }
    cb(null, true)
  },
})
