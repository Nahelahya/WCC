import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { mapTransaction, type TransactionRow } from '../lib/mappers'
import { newId } from '../lib/ids'
import { requireAuth, requireRole } from '../middleware/auth'
import { writeAudit } from '../lib/audit'

export const transactionRouter = Router()
// Semua pengguna yang login boleh MELIHAT ringkasan & daftar kas (transparansi,
// sesuai PRD 7.8: "Anggota dapat melihat ringkasan saldo kas dan laporan ringkas
// (read-only)"). Operasi tulis tetap hanya untuk pengurus, dijaga per-rute.
transactionRouter.use(requireAuth)

transactionRouter.get(
  '/',
  wrap(async (_req, res) => {
    const { rows } = await query<TransactionRow>(
      'select * from transactions order by date desc, created_at desc',
    )
    res.json(rows.map(mapTransaction))
  }),
)

// Ringkasan harus di atas '/:id' (walaupun beda metode, ini lebih aman).
transactionRouter.get(
  '/summary',
  wrap(async (req, res) => {
    const q = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(req.query ?? {})
    const conditions: string[] = []
    const params: unknown[] = []
    if (q.from) {
      params.push(q.from)
      conditions.push(`date >= $${params.length}`)
    }
    if (q.to) {
      params.push(q.to)
      conditions.push(`date <= $${params.length}`)
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : ''

    const { rows } = await query<{ income: number; expense: number }>(
      `select
         coalesce(sum(case when type = 'pemasukan' then amount else 0 end), 0)::numeric as income,
         coalesce(sum(case when type = 'pengeluaran' then amount else 0 end), 0)::numeric as expense
       from transactions ${where}`,
      params,
    )
    const { rows: balanceRows } = await query<{ balance: number }>(
      `select coalesce(sum(case when type = 'pemasukan' then amount else -amount end), 0)::numeric as balance
       from transactions`,
    )
    res.json({
      income: Number(rows[0]?.income ?? 0),
      expense: Number(rows[0]?.expense ?? 0),
      balance: Number(balanceRows[0]?.balance ?? 0),
    })
  }),
)

const transactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal wajib diisi.'),
  type: z.enum(['pemasukan', 'pengeluaran']),
  category: z.string().trim().min(1, 'Kategori wajib dipilih.'),
  amount: z.coerce.number().positive('Nominal harus lebih dari 0.'),
  note: z.string().optional(),
  recordedBy: z.string().optional(),
  receiptName: z.string().optional(),
  receiptUrl: z.string().optional(),
})

async function currentUserName(userId: string): Promise<string> {
  const { rows } = await query<{ name: string }>('select name from users where id = $1', [userId])
  return rows[0]?.name ?? 'Pengurus'
}

/** Bentuk ringkas satu transaksi untuk disimpan pada detail jejak audit. */
function snapshot(row: TransactionRow) {
  return {
    date: row.date,
    type: row.type,
    category: row.category,
    amount: Number(row.amount),
    note: row.note,
  }
}

transactionRouter.post(
  '/',
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const input = transactionSchema.parse(req.body ?? {})
    const recordedBy = input.recordedBy ?? (await currentUserName(req.auth!.userId))
    const { rows } = await query<TransactionRow>(
      `insert into transactions (id, date, type, category, amount, note, recorded_by, receipt_name, receipt_url, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       returning *`,
      [
        newId('t'),
        input.date,
        input.type,
        input.category,
        input.amount,
        input.note ?? '',
        recordedBy,
        input.receiptName ?? null,
        input.receiptUrl ?? null,
      ],
    )
    await writeAudit({
      userId: req.auth!.userId,
      action: 'create',
      entity: 'transaction',
      entityId: rows[0].id,
      detail: snapshot(rows[0]),
    })
    res.status(201).json(mapTransaction(rows[0]))
  }),
)

transactionRouter.patch(
  '/:id',
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const patch = transactionSchema.partial().parse(req.body ?? {})
    const { rows: existingRows } = await query<TransactionRow>(
      'select * from transactions where id = $1',
      [req.params.id],
    )
    const before = existingRows[0]
    const { rows } = await query<TransactionRow>(
      `update transactions set
         date         = coalesce($2, date),
         type         = coalesce($3, type),
         category     = coalesce($4, category),
         amount       = coalesce($5, amount),
         note         = coalesce($6, note),
         receipt_name = coalesce($7, receipt_name),
         receipt_url  = coalesce($8, receipt_url)
       where id = $1
       returning *`,
      [
        req.params.id,
        patch.date ?? null,
        patch.type ?? null,
        patch.category ?? null,
        patch.amount ?? null,
        patch.note ?? null,
        patch.receiptName ?? null,
        patch.receiptUrl ?? null,
      ],
    )
    if (!rows[0]) throw ApiError.notFound('Transaksi tidak ditemukan.')
    await writeAudit({
      userId: req.auth!.userId,
      action: 'update',
      entity: 'transaction',
      entityId: rows[0].id,
      detail: {
        before: before ? snapshot(before) : null,
        after: snapshot(rows[0]),
      },
    })
    res.json(mapTransaction(rows[0]))
  }),
)

transactionRouter.delete(
  '/:id',
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const { rows: existingRows } = await query<TransactionRow>(
      'select * from transactions where id = $1',
      [req.params.id],
    )
    const removed = existingRows[0]
    const { rowCount } = await query('delete from transactions where id = $1', [req.params.id])
    if (!rowCount) throw ApiError.notFound('Transaksi tidak ditemukan.')
    await writeAudit({
      userId: req.auth!.userId,
      action: 'delete',
      entity: 'transaction',
      entityId: req.params.id,
      detail: removed ? snapshot(removed) : null,
    })
    res.json({ ok: true })
  }),
)
