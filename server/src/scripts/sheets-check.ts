/**
 * Diagnostik koneksi Google Sheets.
 *
 *   npm run sheets:check
 *
 * Memeriksa kredensial service account, ID spreadsheet, akses tab tujuan, dan
 * jumlah transaksi di database — tanpa perlu membuka UI.
 */
import { pool, query } from '../db/pool'
import { getSheetsConfig, pingSheet } from '../lib/sheets'

async function main(): Promise<void> {
  const cfg = getSheetsConfig()

  console.log('')
  console.log('  Pemeriksaan konfigurasi Google Sheets')
  console.log('  -------------------------------------')
  console.log(`  Status          : ${cfg.configured ? 'SIAP' : 'BELUM SIAP'}`)
  if (!cfg.configured) console.log(`  Alasan          : ${cfg.reason}`)
  console.log(`  Mode            : ${cfg.mode === 'apps-script' ? 'Apps Script Web App' : 'Service Account'}`)
  console.log(`  Spreadsheet ID  : ${cfg.spreadsheetId || '(kosong)'}`)
  console.log(`  Tab tujuan      : "${cfg.tab}"`)
  if (cfg.mode === 'service-account') console.log(`  Service account : ${cfg.serviceAccountEmail ?? '(tidak diketahui)'}`)

  const { rows } = await query<{ count: number }>('select count(*)::int as count from transactions')
  console.log(`  Transaksi di DB : ${rows[0]?.count ?? 0} baris`)

  if (!cfg.configured) {
    console.log('')
    console.log('  Langkah perbaikan (pilih salah satu):')
    console.log('   A. Apps Script (mudah):')
    console.log('      a. Deploy Web App dari spreadsheet (lihat docs/apps-script/Code.gs)')
    console.log('      b. Isi GOOGLE_APPS_SCRIPT_URL (dan token bila dipakai) di server/.env')
    console.log('   B. Service account:')
    console.log('      a. Isi GOOGLE_SHEETS_ID dan GOOGLE_SERVICE_ACCOUNT_FILE (atau _JSON) di server/.env')
    console.log('      b. Bagikan spreadsheet ke service account sebagai Editor')
    console.log('   Lalu jalankan ulang: npm run sheets:check')
    console.log('')
    process.exitCode = 1
    return
  }

  try {
    if (cfg.mode === 'apps-script') {
      const { tab } = await pingSheet(cfg)
      console.log(`  Web App         : OK (tab "${tab}")`)
      console.log('')
      console.log('  Siap! Jalankan `npm run dev`, lalu klik "Sinkronkan Sekarang" di UI.')
      return
    }
    await pingSheet(cfg)
    console.log('  Token Google    : OK')
    console.log(`  Tab "${cfg.tab}"    : dapat diakses`)
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
