import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { mapCoach, type CoachRow } from '../lib/mappers'
import { newId } from '../lib/ids'
import { requireAuth, requireRole } from '../middleware/auth'

export const coachRouter = Router()

coachRouter.get(
  '/',
  wrap(async (_req, res) => {
    const { rows } = await query<CoachRow>('select * from coaches order by name asc')
    res.json(rows.map(mapCoach))
  }),
)

coachRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const { rows } = await query<CoachRow>('select * from coaches where id = $1', [req.params.id])
    if (!rows[0]) throw ApiError.notFound('Coach tidak ditemukan.')
    res.json(mapCoach(rows[0]))
  }),
)

const coachSchema = z.object({
  name: z.string().trim().min(1, 'Nama coach wajib diisi.'),
  expertise: z.array(z.string().trim().min(1)).min(1, 'Minimal satu keahlian wajib diisi.'),
  experience: z.string().optional(),
  years: z.coerce.number().int().min(0).optional(),
  bio: z.string().optional(),
  photoUrl: z.string().optional(),
})

coachRouter.post(
  '/',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const input = coachSchema.parse(req.body ?? {})
    const { rows } = await query<CoachRow>(
      `insert into coaches (id, name, expertise, experience, years, bio, photo_url)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [
        newId('c'),
        input.name,
        input.expertise,
        input.experience ?? '',
        input.years ?? 0,
        input.bio ?? null,
        input.photoUrl ?? null,
      ],
    )
    res.status(201).json(mapCoach(rows[0]))
  }),
)

coachRouter.patch(
  '/:id',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const patch = coachSchema.partial().parse(req.body ?? {})
    const { rows } = await query<CoachRow>(
      `update coaches set
         name       = coalesce($2, name),
         expertise  = coalesce($3, expertise),
         experience = coalesce($4, experience),
         years      = coalesce($5, years),
         bio        = coalesce($6, bio),
         photo_url  = coalesce($7, photo_url)
       where id = $1
       returning *`,
      [
        req.params.id,
        patch.name ?? null,
        patch.expertise ?? null,
        patch.experience ?? null,
        patch.years ?? null,
        patch.bio ?? null,
        patch.photoUrl ?? null,
      ],
    )
    if (!rows[0]) throw ApiError.notFound('Coach tidak ditemukan.')
    res.json(mapCoach(rows[0]))
  }),
)

coachRouter.delete(
  '/:id',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const { rowCount } = await query('delete from coaches where id = $1', [req.params.id])
    if (!rowCount) throw ApiError.notFound('Coach tidak ditemukan.')
    res.json({ ok: true })
  }),
)
