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

/** Ekstensi yang diijinkan berdasarkan isi (MIME) yang terdeteksi. Nama
 *  berkas KEMUDIAN selalu diambil dari tulang punggung ini, bukan dari
 *  `originalname` pengguna, untuk menutup celah `.html`/`.svg`/`.js`. */
const EXT_FROM_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
}

/** Ekstensi yang bermasalah (Active Content). Ditolak sepanjang nama asli.
 *  Cover HTML/SVG/JS + server-side script + config injection. */
const ACTIVE_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.xhtml',
  '.svg',
  '.js',
  '.mjs',
  '.cjs',
  '.xml',
  '.xsl',
  '.xslt',
  '.htaccess',
  '.ini',
  '.env',
  '.php',
  '.phar',
  '.py',
  '.sh',
  '.asp',
  '.aspx',
  '.jsp',
  '.jspx',
  '.pl',
  '.rb',
  '.exe',
  '.dll',
  '.so',
  '.bak',
  '.zip',
  '.gz',
  '.tgz',
])

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

/** File dengan nama akhir yang berisi ekstensi aktif ditolak (H-02). */
function isUnsafeExtension(name: string): boolean {
  return ACTIVE_EXTENSIONS.has(extname(name).toLowerCase())
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
    async _handleFile(_req, file, callback) {
      const buffer = await readStream(file.stream)
      const detected = detectMime(buffer)
      if (!detected || !isAllowedMime(detected)) {
        callback(new ApiError(400, 'Isi berkas tidak sesuai jenisnya. Gunakan PNG, JPG, WebP, atau PDF.'))
        return
      }
      // H-02: ekstensi disimpan selalu dari MIME terdeteksi, bukan dari
      // `originalname` klien, sehingga `.html`/`.svg`/`.js` dengan header
      // palsu tidak bisa disimpan sebagai ekstensi aktif.
      const safeExt = EXT_FROM_MIME[detected] ?? '.bin'
      if (file.originalname && isUnsafeExtension(file.originalname)) {
        callback(new ApiError(400, 'Ekstensi berkas tidak diizinkan (HTML/SVG/JS dan sejenis tidak diperbolehkan).'))
        return
      }
      const filename = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${safeExt}`
      const dir = uploadDir()
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, filename), buffer)
      callback(null, { filename, mimetype: detected })
    },

    _removeFile(_req, file, callback) {
      try {
        const filepath = join(uploadDir(), file.filename)
        if (existsSync(filepath)) unlinkSync(filepath)
      } catch {
        // ignore
      } finally {
        callback(null)
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
