import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { mapUser, type UserRow } from '../lib/mappers'
import { hashPassword, verifyPassword } from '../lib/password'
import { requireAuth, requireRole } from '../middleware/auth'
import type { Role } from '../types'

export const userRouter = Router()
userRouter.use(requireAuth)

const ROLES: Role[] = ['anggota', 'coach', 'pengurus']

userRouter.get(
  '/',
  requireRole('pengurus', 'coach'),
  wrap(async (req, res) => {
    const role = typeof req.query.role === 'string' && ROLES.includes(req.query.role as Role)
      ? (req.query.role as Role)
      : 'anggota'
    const { rows } = await query<UserRow>('select * from users where role = $1 order by name asc', [role])
    res.json(rows.map(mapUser))
  }),
)

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.').optional(),
  phone: z.string().trim().max(40, 'Nomor kontak terlalu panjang.').optional(),
  email: z.string().trim().email('Format email tidak valid.').optional(),
})

userRouter.patch(
  '/:id',
  wrap(async (req, res) => {
    const { id } = req.params
    const isSelf = req.auth!.userId === id
    if (!isSelf && req.auth!.role !== 'pengurus') throw ApiError.forbidden()

    const patch = profileSchema.parse(req.body ?? {})
    const { rows } = await query<UserRow>(
      `update users set
         name  = coalesce($2, name),
         phone = coalesce($3, phone),
         email = coalesce($4, email),
         updated_at = now()
       where id = $1
       returning *`,
      [id, patch.name ?? null, patch.phone ?? null, patch.email ?? null],
    )
    if (!rows[0]) throw ApiError.notFound('Pengguna tidak ditemukan.')
    res.json(mapUser(rows[0]))
  }),
)

const passwordSchema = z
  .object({
    current: z.string().optional(),
    next: z.string().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
  })
  .transform((v) => ({ current: v.current ?? v.currentPassword ?? '', next: v.next ?? v.newPassword ?? '' }))
  .refine((v) => v.current.length > 0, { message: 'Password saat ini wajib diisi.' })
  .refine((v) => v.next.length >= 8, { message: 'Password baru minimal 8 karakter.' })

userRouter.post(
  '/:id/password',
  wrap(async (req, res) => {
    const { id } = req.params
    const isSelf = req.auth!.userId === id
    if (!isSelf && req.auth!.role !== 'pengurus') throw ApiError.forbidden()

    const { current, next } = passwordSchema.parse(req.body ?? {})
    const { rows } = await query<UserRow>('select * from users where id = $1', [id])
    const row = rows[0]
    if (!row) throw ApiError.notFound('Pengguna tidak ditemukan.')

    const ok = await verifyPassword(current, row.password_hash ?? '')
    if (!ok) throw ApiError.badRequest('Password saat ini tidak sesuai.')

    await query('update users set password_hash = $2, updated_at = now() where id = $1', [
      id,
      await hashPassword(next),
    ])
    // Paksa login ulang di semua perangkat setelah password berubah.
    await query('update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null', [id])
    res.json({ ok: true })
  }),
)
