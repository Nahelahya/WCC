import { Router } from 'express'
import { query } from '../db/pool'
import { wrap } from '../lib/async'
import { mapSyncLog, type SyncLogRow } from '../lib/mappers'
import { getSheetsConfig } from '../lib/sheets'
import { requireAuth, requireRole } from '../middleware/auth'
import { runSync, SYNC_COLUMNS } from '../services/syncService'

export const syncRouter = Router()
syncRouter.use(requireAuth, requireRole('pengurus'))

/**
 * Status sinkronisasi + konfigurasi (tanpa kredensial).
 * `configured = false` membantu UI menampilkan panduan penyiapan yang jelas.
 */
async function loadState() {
  const { rows: state } = await query<{ status: string; last_sync_at: Date | null }>(
    'select status, last_sync_at from sync_state where id = 1',
  )
  const { rows: log } = await query<SyncLogRow>('select * from sync_logs order by at desc limit 20')
  const s = state[0]
  const cfg = getSheetsConfig()
  return {
    status: s?.status ?? 'idle',
    lastSyncAt: s?.last_sync_at ? new Date(s.last_sync_at).toISOString() : null,
    log: log.map(mapSyncLog),
    configured: cfg.configured,
    reason: cfg.configured ? undefined : cfg.reason,
    mode: cfg.mode,
    spreadsheetId: cfg.spreadsheetId || undefined,
    tab: cfg.tab,
    serviceAccountEmail: cfg.serviceAccountEmail,
    columns: [...SYNC_COLUMNS],
  }
}

syncRouter.get(
  '/status',
  wrap(async (_req, res) => {
    res.json(await loadState())
  }),
)

/**
 * Menjalankan sinkronisasi kas ke Google Sheets.
 * Bila belum dikonfigurasi → 503 dengan pesan yang mudah dipahami;
 * bila Google menolak → 502. Log kegagalan selalu dicatat.
 */
syncRouter.post(
  '/run',
  wrap(async (req, res) => {
    const trigger = (req.body as { trigger?: string } | undefined)?.trigger === 'scheduled' ? 'scheduled' : 'manual'
    const result = await runSync(trigger)
    res.json(result)
  }),
)
