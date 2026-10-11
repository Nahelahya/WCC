import { Router } from 'express'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { publicUrl, uploadSingle } from '../lib/uploads'
import { requireAuth } from '../middleware/auth'

export const uploadRouter = Router()
// Hanya pengguna yang sudah masuk yang boleh mengunggah berkas.
uploadRouter.use(requireAuth)

/**
 * Unggah satu berkas (bukti transaksi / foto coach).
 * Multipart: field `file`. Mengembalikan URL yang bisa disimpan pada entitas.
 */
uploadRouter.post(
  '/',
  uploadSingle.single('file'),
  wrap(async (req, res) => {
    const file = req.file
    if (!file) throw ApiError.badRequest('Berkas wajib diunggah pada field "file".')
    res.status(201).json({
      url: publicUrl(file.filename),
      name: file.originalname,
      size: file.size,
      mime: file.mimetype,
    })
  }),
)
