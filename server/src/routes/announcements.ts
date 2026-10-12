import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { mapAnnouncement, type AnnouncementRow } from '../lib/mappers'
import { newId } from '../lib/ids'
import { requireAuth, requireRole } from '../middleware/auth'

export const announcementRouter = Router()

announcementRouter.get(
  '/',
  wrap(async (req, res) => {
    // Draf hanya boleh dilihat pengurus.
    const includeDrafts = req.query.includeDrafts === 'true' && req.auth?.role === 'pengurus'
    const { rows } = await query<AnnouncementRow>(
      `select * from announcements
       ${includeDrafts ? '' : 'where published = true'}
       order by published_at desc`,
    )
    res.json(rows.map(mapAnnouncement))
  }),
)

announcementRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const { rows } = await query<AnnouncementRow>('select * from announcements where id = $1', [
      req.params.id,
    ])
    const row = rows[0]
    if (!row || (!row.published && req.auth?.role !== 'pengurus')) {
      throw ApiError.notFound('Pengumuman tidak ditemukan.')
    }
    res.json(mapAnnouncement(row))
  }),
)

const announcementSchema = z.object({
  title: z.string().trim().min(1, 'Judul pengumuman wajib diisi.'),
  body: z.string().trim().min(1, 'Isi pengumuman wajib diisi.'),
  summary: z.string().optional(),
  priority: z.enum(['tinggi', 'normal', 'rendah']).optional(),
  published: z.boolean().optional(),
  author: z.string().optional(),
  /** URL gambar (hasil unggahan). Kirim string kosong untuk menghapus gambar. */
  imageUrl: z.string().trim().optional(),
})

announcementRouter.post(
  '/',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const input = announcementSchema.parse(req.body ?? {})
    const { rows } = await query<AnnouncementRow>(
      `insert into announcements (id, title, summary, body, priority, published, published_at, author, image_url)
       values ($1,$2,$3,$4,$5,$6,now(),$7,$8)
       returning *`,
      [
        newId('an'),
        input.title,
        input.summary ?? input.body.slice(0, 120),
        input.body,
        input.priority ?? 'normal',
        input.published ?? true,
        input.author ?? 'Pengurus WCC',
        input.imageUrl ? input.imageUrl : null,
      ],
    )
    res.status(201).json(mapAnnouncement(rows[0]))
  }),
)

announcementRouter.patch(
  '/:id',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const patch = announcementSchema.partial().parse(req.body ?? {})
    const { rows } = await query<AnnouncementRow>(
      `update announcements set
         title     = coalesce($2, title),
         summary   = coalesce($3, summary),
         body      = coalesce($4, body),
         priority  = coalesce($5, priority),
         published = coalesce($6, published),
         author    = coalesce($7, author),
         image_url = case when $8::text is null then image_url else nullif($8::text, '') end
       where id = $1
       returning *`,
      [
        req.params.id,
        patch.title ?? null,
        patch.summary ?? null,
        patch.body ?? null,
        patch.priority ?? null,
        patch.published ?? null,
        patch.author ?? null,
        patch.imageUrl ?? null,
      ],
    )
    if (!rows[0]) throw ApiError.notFound('Pengumuman tidak ditemukan.')
    res.json(mapAnnouncement(rows[0]))
  }),
)

announcementRouter.delete(
  '/:id',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const { rowCount } = await query('delete from announcements where id = $1', [req.params.id])
    if (!rowCount) throw ApiError.notFound('Pengumuman tidak ditemukan.')
    res.json({ ok: true })
  }),
)
