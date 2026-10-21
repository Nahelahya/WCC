import { query } from '../db/pool'
import { newId } from '../lib/ids'
import { ApiError } from '../lib/errors'
import type { TransactionRow } from '../lib/mappers'
import {
  getSheetsConfig,
  isSheetsConfigured,
  syncSheet,
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
  const cfg = getSheetsConfig()
  const detail = error instanceof Error ? error.message : String(error)

  if (/abort|timeout|fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(detail)) {
    return cfg.mode === 'apps-script'
      ? 'Tidak dapat menghubungi Google Apps Script. Periksa URL Web App dan coba lagi.'
      : 'Tidak dapat menghubungi Google Sheets. Periksa koneksi server dan coba lagi.'
  }

  if (cfg.mode === 'apps-script') {
    return `Sinkronisasi gagal: ${detail}`
  }

  if (cfg.mode === 'oauth' && /invalid_grant|invalid_client|unauthorized_client|expired|revoked/i.test(detail)) {
    return 'Refresh token OAuth tidak valid atau sudah kedaluwarsa. Buat refresh token baru lalu perbarui GOOGLE_OAUTH_REFRESH_TOKEN, kemudian coba lagi.'
  }

  const status = (error as { status?: number }).status
  if (status === 401 || status === 403) {
    if (cfg.mode === 'oauth') {
      return 'Google menolak akses (401/403). Pastikan akun pemilik refresh token berhak mengedit spreadsheet tujuan, lalu coba lagi.'
    }
    return `Akses ke spreadsheet ditolak. Bagikan spreadsheet ke ${cfg.serviceAccountEmail ?? 'email service account'} sebagai Editor, lalu coba lagi.`
  }
  if (status === 404) {
    return 'Spreadsheet tidak ditemukan. Periksa kembali GOOGLE_SHEETS_ID (ID ada pada URL spreadsheet).'
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
    // Rekonsiliasi otomatis: pastikan setiap pembayaran iuran 'paid' memiliki
    // baris transaksi kas (idempoten). Menangani kasus webhook tidak terpicu.
    await query(`
      insert into transactions (id, date, type, category, amount, note, recorded_by, payment_id, created_at)
      select 't-' || substr(md5(p.id),1,8),
             (p.paid_at at time zone 'Asia/Jakarta')::date,
             'pemasukan', 'Iuran Anggota', p.amount,
             trim('Iuran ' || coalesce(p.period,'') || ' — ' || coalesce(p.payer_name,'anggota') || ' (online)'),
             'Pembayaran Online', p.id, now()
      from payments p
      where p.purpose = 'iuran' and p.status = 'paid'
        and not exists (select 1 from transactions t where t.payment_id = p.id)
        and not exists (select 1 from transactions t where t.category='Iuran Anggota' and t.amount=p.amount and t.note = trim('Iuran ' || coalesce(p.period,'') || ' — ' || coalesce(p.payer_name,'anggota') || ' (online)'))
    `)
    // Rekonsiliasi biaya pendaftaran yang lunas via gateway.
    await query(`
      insert into transactions (id, date, type, category, amount, note, recorded_by, created_at)
      select 't-' || substr(md5(p.id),1,8),
             (p.paid_at at time zone 'Asia/Jakarta')::date,
             'pemasukan', 'Biaya Pendaftaran', p.amount,
             trim('Biaya pendaftaran — ' || coalesce(p.payer_name,'calon anggota') || ' (online)'),
             'Pembayaran Online', now()
      from payments p
      where p.purpose = 'pendaftaran' and p.status = 'paid'
        and not exists (
          select 1 from transactions t
          where t.category = 'Biaya Pendaftaran' and t.amount = p.amount
            and t.note = trim('Biaya pendaftaran — ' || coalesce(p.payer_name,'calon anggota') || ' (online)')
        )
    `)
    const { rows } = await query<TransactionRow>('select * from transactions order by date asc, created_at asc')

    const income = rows
      .filter((r) => r.type === 'pemasukan')
      .reduce((s, r) => s + Number(r.amount), 0)
    const expense = rows
      .filter((r) => r.type === 'pengeluaran')
      .reduce((s, r) => s + Number(r.amount), 0)
    const balance = income - expense

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
      [],
      ['RINGKASAN', '', '', '', '', ''],
      ['Total Pemasukan', '', '', income, '', ''],
      ['Total Pengeluaran', '', '', expense, '', ''],
      ['Saldo (Pemasukan - Pengeluaran)', '', '', balance, '', ''],
    ]

    const { readBack } = await syncSheet(cfg, values)

    // Rekonsiliasi: hanya baris transaksi (tanpa baris ringkasan).
    const readBackRows = readBack.slice(1, 1 + rows.length).filter((line) => (line[0] ?? '').trim() !== '')
    const expectedTotal = rows.reduce((sum, row) => sum + Number(row.amount), 0)
    const actualTotal = readBackRows.reduce((sum, line) => sum + Number(line[3] ?? 0), 0)
    const reconciled = readBackRows.length === rows.length && Math.abs(actualTotal - expectedTotal) < 0.01

    if (!reconciled) {
      const message =
        `Sinkron ke "${cfg.tab}" selesai, tetapi rekonsiliasi tidak cocok ` +
        `(${readBackRows.length} dari ${rows.length} baris terbaca). Periksa kembali spreadsheet.`
      await writeLog('failed', message, readBackRows.length)
      await setState('failed', null)
      throw ApiError.badGateway(message)
    }

    const at = new Date()
    const total = expectedTotal.toLocaleString('id-ID')
    const message =
      `Sinkron ${trigger === 'scheduled' ? 'terjadwal' : 'manual'} ke "${cfg.tab}" berhasil: ` +
      `${rows.length} baris, total Rp${total} cocok. Saldo: Rp${balance.toLocaleString('id-ID')}.`
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
