import { query } from '../db/pool'
import { newId } from '../lib/ids'
import { ApiError } from '../lib/errors'
import type { TransactionRow } from '../lib/mappers'
import {
  ensureTab,
  getAccessToken,
  getSheetsConfig,
  isSheetsConfigured,
  readValues,
  writeValues,
} from '../lib/sheets'

/**
 * Sinkronisasi kas klub ke Google Sheets.
 *
 * Strategi: **tulis penuh (full refresh)** — seluruh tabel `transactions`
 * ditulis ulang ke tab tujuan, lalu dibaca kembali untuk rekonsiliasi. Cara ini
 * menjamin selisih 0% (kriteria PRD) dan tidak memerlukan penyimpanan ID baris
 * di spreadsheet.
 *
 * Integrasi "dua arah terbatas": tulis otomatis + baca untuk rekonsiliasi.
 */

export const SYNC_COLUMNS = ['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Keterangan', 'Dicatat Oleh'] as const

export interface SyncRunResult {
  status: 'success'
  rows: number
  spreadsheetId: string
  tab: string
  reconciled: boolean
  message: string
  at: string
}

let inFlight = false

/** Apakah ada proses sinkronisasi yang sedang berjalan. */
export function isSyncRunning(): boolean {
  return inFlight
}

async function setState(status: string, lastSyncAt: Date | null): Promise<void> {
  await query(
    `insert into sync_state (id, status, last_sync_at) values (1, $1, $2)
     on conflict (id) do update set status = excluded.status,
       last_sync_at = coalesce(excluded.last_sync_at, sync_state.last_sync_at)`,
    [status, lastSyncAt],
  )
}

async function writeLog(status: 'success' | 'failed', message: string, rows = 0): Promise<void> {
  await query(
    `insert into sync_logs (id, at, status, message, rows) values ($1, now(), $2, $3, $4)`,
    [newId('l'), status, message, rows],
  )
}

/** Mengubah galat teknis menjadi pesan yang bisa dipahami pengurus. */
function friendlyError(error: unknown): string {
  const status = (error as { status?: number }).status
  const email = getSheetsConfig().serviceAccountEmail

  if (status === 401 || status === 403) {
    return `Akses ke spreadsheet ditolak. Bagikan spreadsheet ke ${email ?? 'email service account'} sebagai Editor, lalu coba lagi.`
  }
  if (status === 404) {
    return 'Spreadsheet tidak ditemukan. Periksa kembali GOOGLE_SHEETS_ID (ID ada pada URL spreadsheet).'
  }

  const detail = error instanceof Error ? error.message : String(error)
  if (/abort|timeout|fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(detail)) {
    return 'Tidak dapat menghubungi Google Sheets. Periksa koneksi server dan coba lagi.'
  }
  return `Sinkronisasi gagal: ${detail}`
}

export async function runSync(trigger: 'manual' | 'scheduled'): Promise<SyncRunResult> {
  if (!isSheetsConfigured()) {
    const reason = (getSheetsConfig().reason ?? 'belum dikonfigurasi').replace(/\.\s*$/, '')
    const message = `Sinkronisasi Google Sheets belum dikonfigurasi (${reason}).`
    await writeLog('failed', message)
    await setState('failed', null)
    throw ApiError.serviceUnavailable(message)
  }

  if (inFlight) {
    throw ApiError.conflict('Sinkronisasi lain sedang berjalan. Mohon tunggu sampai selesai.')
  }

  inFlight = true
  await setState('running', null)

  try {
    const cfg = getSheetsConfig()
    const { rows } = await query<TransactionRow>('select * from transactions order by date asc, created_at asc')

    const values: (string | number)[][] = [
      [...SYNC_COLUMNS],
      ...rows.map((row) => [
        row.date,
        row.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
        row.category,
        Number(row.amount),
        row.note,
        row.recorded_by,
      ]),
    ]

    const token = await getAccessToken()
    await ensureTab(token, cfg.spreadsheetId, cfg.tab)
    await writeValues(token, cfg.spreadsheetId, cfg.tab, values)

    // Rekonsiliasi: baca ulang, bandingkan jumlah baris dan total nominal.
    const readBack = (await readValues(token, cfg.spreadsheetId, cfg.tab))
      .slice(1)
      .filter((line) => (line[0] ?? '').trim() !== '')
    const expectedTotal = rows.reduce((sum, row) => sum + Number(row.amount), 0)
    const actualTotal = readBack.reduce((sum, line) => sum + Number(line[3] ?? 0), 0)
    const reconciled = readBack.length === rows.length && Math.abs(actualTotal - expectedTotal) < 0.01

    if (!reconciled) {
      const message =
        `Sinkron ke "${cfg.tab}" selesai, tetapi rekonsiliasi tidak cocok ` +
        `(${readBack.length} dari ${rows.length} baris terbaca). Periksa kembali spreadsheet.`
      await writeLog('failed', message, readBack.length)
      await setState('failed', null)
      throw ApiError.badGateway(message)
    }

    const at = new Date()
    const total = expectedTotal.toLocaleString('id-ID')
    const message =
      `Sinkron ${trigger === 'scheduled' ? 'terjadwal' : 'manual'} ke "${cfg.tab}" berhasil: ` +
      `${rows.length} baris, total Rp${total} cocok.`
    await writeLog('success', message, rows.length)
    await setState('success', at)

    return {
      status: 'success',
      rows: rows.length,
      spreadsheetId: cfg.spreadsheetId,
      tab: cfg.tab,
      reconciled: true,
      message,
      at: at.toISOString(),
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const message = friendlyError(error)
    await writeLog('failed', message)
    await setState('failed', null)
    throw ApiError.badGateway(message)
  } finally {
    inFlight = false
  }
}
