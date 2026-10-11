import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { env } from '../env'
import { ApiError } from '../lib/errors'

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' })
}

/**
 * Semua error berakhir di sini. Bentuk respons selalu
 * `{ message: string }` agar bisa langsung ditampilkan sebagai toast di UI.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      message: err.issues[0]?.message ?? 'Permintaan tidak valid.',
      details: err.issues,
    })
    return
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    })
    return
  }

  // Pelanggaran constraint PostgreSQL (mis. email ganda).
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: string }).code
    if (code === '23505') {
      res.status(409).json({ message: 'Data sudah ada (duplikat).' })
      return
    }
    if (code === '23503') {
      res.status(400).json({ message: 'Data terkait tidak ditemukan.' })
      return
    }
  }

  // Kesalahan unggah berkas dari multer (mis. melebihi batas ukuran).
  if (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'MulterError') {
    const code = (err as { code?: string }).code
    const tooLarge = code === 'LIMIT_FILE_SIZE'
    res.status(tooLarge ? 413 : 400).json({
      message: tooLarge
        ? `Ukuran berkas melebihi batas (maksimal ${env.uploadMaxMb} MB).`
        : 'Unggahan berkas tidak valid.',
    })
    return
  }

  console.error('[error]', err)
  res.status(500).json({
    message: env.isProd ? 'Terjadi kesalahan pada server.' : String((err as Error)?.message ?? err),
  })
}
