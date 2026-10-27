import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { wrap } from '../lib/async'
import { requireAuth, requireRole } from '../middleware/auth'
import { getLandingDefaults } from '../lib/landing-defaults'
import type { LandingContent } from '../types.landing'

export const landingRouter = Router()

// Statistik publik (tanpa autentikasi) untuk ditampilkan di landing page.
landingRouter.get(
  '/stats',
  wrap(async (_req, res) => {
    const { rows: m } = await query<{ total: number }>(
      "select count(*)::int as total from users where role = 'anggota' and membership_status = 'aktif'",
    )
    const { rows: c } = await query<{ total: number }>(
      "select count(*)::int as total from coaches",
    )
    const { rows: s } = await query<{ total: number }>(
      "select count(*)::int as total from sessions where date >= date_trunc('month', current_date) and date < date_trunc('month', current_date) + interval '1 month'",
    )
    res.json({ activeMembers: m[0]?.total ?? 0, coachCount: c[0]?.total ?? 0, sessionCount: s[0]?.total ?? 0 })
  }),
)

const linkSchema = z.object({
  label: z.string().trim().min(1).max(120),
  href: z.string().trim().min(1).max(500),
  external: z.boolean().optional(),
})

const statSchema = z.object({ label: z.string().trim().min(1), value: z.string().trim().min(1) })

const heroSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim(),
  ctaPrimaryLabel: z.string().trim().min(1),
  ctaPrimaryHref: z.string().trim().min(1),
  ctaSecondaryLabel: z.string().trim().min(1),
  ctaSecondaryHref: z.string().trim().min(1),
  imageUrl: z.string().trim().max(2000).optional().or(z.literal('')),
})

const aboutSchema = z.object({
  badge: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim(),
  stats: z.array(statSchema).max(6),
})

const scheduleItemSchema = z.object({
  day: z.string().trim().min(1),
  time: z.string().trim().min(1),
  activity: z.string().trim().min(1),
  note: z.string().trim().max(240).optional().or(z.literal('')),
})

const scheduleSchema = z.object({
  badge: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim(),
  items: z.array(scheduleItemSchema).max(10),
})

const coachItemSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1),
  expertise: z.array(z.string().trim().min(1)).min(1).max(6),
  experience: z.string().trim().min(1),
  photoUrl: z.string().trim().max(2000).optional().or(z.literal('')),
})

const coachesSchema = z.object({
  badge: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim(),
  items: z.array(coachItemSchema).max(12),
})

const stepSchema = z.object({ title: z.string().trim().min(1), desc: z.string().trim() })

const stepsSchema = z.object({
  badge: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  items: z.array(stepSchema).min(1).max(6),
})

const activityItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400),
  imageUrl: z.string().trim().max(2000).optional().or(z.literal('')),
  focusX: z.number().min(0).max(100).optional(),
  focusY: z.number().min(0).max(100).optional(),
  zoom: z.number().min(1).max(3).optional(),
})

const activitiesSchema = z.object({
  badge: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim(),
  items: z.array(activityItemSchema).max(24),
})

const ctaSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim(),
  ctaPrimaryLabel: z.string().trim().min(1),
  ctaPrimaryHref: z.string().trim().min(1),
  ctaSecondaryLabel: z.string().trim().min(1),
  ctaSecondaryHref: z.string().trim().min(1),
})

const footerContactSchema = z.object({
  address: z.string().trim().min(1),
  email: z.string().trim().min(1),
  phone: z.string().trim().min(1),
})

const footerSectionSchema = z.object({
  title: z.string().trim().min(1),
  links: z.array(linkSchema).min(1).max(12),
})

const footerSchema = z.object({
  description: z.string().trim(),
  contact: footerContactSchema,
  sections: z.array(footerSectionSchema).min(1).max(4),
  copyright: z.string().trim().min(1),
})

const landingSchema = z.object({
  hero: heroSchema,
  about: aboutSchema,
  schedule: scheduleSchema,
  coaches: coachesSchema,
  steps: stepsSchema,
  activities: activitiesSchema,
  cta: ctaSchema,
  footer: footerSchema,
})

function mergeWithDefaults(partial: Partial<LandingContent> | null | undefined): LandingContent {
  const base = getLandingDefaults()
  if (!partial || typeof partial !== 'object') return base
  const deep = (a: any, b: any): any => {
    // Untuk array, isi yang tersimpan bersifat otoritatif (pengurus mengontrol
    // jumlah & isinya). Nilai default hanya dipakai untuk melengkapi field yang
    // hilang pada tiap elemen objek, bukan untuk menentukan panjang array.
    if (Array.isArray(b)) {
      if (!Array.isArray(a)) return b
      return b.map((item, i) => deep(a[i], item))
    }
    if (b && typeof b === 'object') {
      const out: any = { ...a }
      for (const k of Object.keys(b)) out[k] = deep(a?.[k], b[k])
      return out
    }
    return b ?? a
  }
  return deep(base, partial) as LandingContent
}

landingRouter.get(
  '/',
  wrap(async (_req, res) => {
    const { rows } = await query<{ data: any; updated_at: string | null; updated_by_name: string | null }>(
      `select lc.data,
              lc.updated_at,
              u.name as updated_by_name
         from landing_content lc
         left join users u on u.id = lc.updated_by
        where lc.id = 'default'`,
    )
    const stored = rows[0]?.data
    const merged = mergeWithDefaults(stored)
    res.json({
      ...merged,
      updatedAt: rows[0]?.updated_at ?? undefined,
      updatedByName: rows[0]?.updated_by_name ?? null,
    } as any)
  }),
)

landingRouter.put(
  '/',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const parsed = landingSchema.parse(req.body ?? {})
    const data = JSON.parse(JSON.stringify(parsed)) as LandingContent
    const { rows } = await query<{ data: any; updated_at: string | null; updated_by_name: string | null }>(
      `insert into landing_content (id, data, updated_by)
       values ('default', $1::jsonb, $2)
       on conflict (id) do update
         set data = excluded.data,
             updated_by = excluded.updated_by,
             updated_at = now()
       returning data, updated_at,
                 (select name from users where id = $2) as updated_by_name`,
      [JSON.stringify(data), req.auth!.userId],
    )
    const stored = rows[0]?.data
    const merged = mergeWithDefaults(stored)
    res.json({
      ...merged,
      updatedAt: rows[0]?.updated_at ?? undefined,
      updatedByName: rows[0]?.updated_by_name ?? null,
    } as any)
  }),
)