/**
 * Diagnostik koneksi Google Sheets.
 *
 *   npm run sheets:check
 *
 * Memeriksa kredensial service account, ID spreadsheet, akses tab tujuan, dan
 * jumlah transaksi di database — tanpa perlu membuka UI.
 */
import { pool, query } from '../db/pool'
import { ensureTab, getAccessToken, getSheetsConfig, readValues } from '../lib/sheets'

async function main(): Promise<void> {
  const cfg = getSheetsConfig()
  const email = cfg.serviceAccountEmail ?? '(tidak diketahui)'

  console.log('')
  console.log('  Pemeriksaan konfigurasi Google Sheets')
  console.log('  -------------------------------------')
  console.log(`  Status          : ${cfg.configured ? 'SIAP' : 'BELUM SIAP'}`)
  if (!cfg.configured) console.log(`  Alasan          : ${cfg.reason}`)
  console.log(`  Spreadsheet ID  : ${cfg.spreadsheetId || '(kosong)'}`)
  console.log(`  Tab tujuan      : "${cfg.tab}"`)
  console.log(`  Service account : ${email}`)

  const { rows } = await query<{ count: number }>('select count(*)::int as count from transactions')
  console.log(`  Transaksi di DB : ${rows[0]?.count ?? 0} baris`)

  if (!cfg.configured) {
    console.log('')
    console.log('  Langkah perbaikan:')
    console.log('   1. Isi GOOGLE_SHEETS_ID dan GOOGLE_SERVICE_ACCOUNT_FILE (atau _JSON) di server/.env')
    console.log(`   2. Bagikan spreadsheet ke "${email}" sebagai Editor`)
    console.log('   3. Jalankan ulang: npm run sheets:check')
    console.log('')
    process.exitCode = 1
    return
  }

  try {
    const token = await getAccessToken()
    console.log('  Token Google    : OK')
    await ensureTab(token, cfg.spreadsheetId, cfg.tab)
    const values = await readValues(token, cfg.spreadsheetId, cfg.tab)
    console.log(`  Tab "${cfg.tab}"    : dapat diakses (${Math.max(values.length - 1, 0)} baris data saat ini)`)
    console.log('')
    console.log('  Siap! Jalankan `npm run dev`, lalu klik "Sinkronkan Sekarang" di UI.')
  } catch (error) {
    console.log(`  Gagal           : ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
