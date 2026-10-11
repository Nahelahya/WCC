import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { wrap } from '../lib/async'
import { requireAuth, requireRole } from '../middleware/auth'

/**
 * Jejak audit kas (PRD 10 — Auditability). Hanya pengurus yang boleh membaca,
 * karena berisi riwayat perubahan pencatatan keuangan beserta identitas pelaku.
 */
export const auditRouter = Router()
auditRouter.use(requireAuth, requireRole('pengurus'))

interface AuditRow {
  id: string
  user_name: string | null
  action: string
  entity: string
  entity_id: string | null
  detail: unknown
  created_at: Date | string
}

auditRouter.get(
  '/',
  wrap(async (req, res) => {
    const q = z
      .object({
        action: z.enum(['create', 'update', 'delete']).optional(),
        entity: z.string().trim().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      })
      .parse(req.query ?? {})

    const conditions: string[] = []
    const params: unknown[] = []
    if (q.action) {
      params.push(q.action)
      conditions.push(`al.action = $${params.length}`)
    }
    if (q.entity) {
      params.push(q.entity)
      conditions.push(`al.entity = $${params.length}`)
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : ''
    params.push(q.limit ?? 100)

    const { rows } = await query<AuditRow>(
      `select al.id, al.action, al.entity, al.entity_id, al.detail, al.created_at,
              u.name as user_name
       from audit_logs al
       left join users u on u.id = al.user_id
       ${where}
       order by al.created_at desc
       limit $${params.length}`,
      params,
    )

    res.json(
      rows.map((row) => ({
        id: row.id,
        at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        userName: row.user_name ?? 'Sistem',
        action: row.action,
        entity: row.entity,
        entityId: row.entity_id ?? undefined,
        detail: row.detail ?? null,
      })),
    )
  }),
)
