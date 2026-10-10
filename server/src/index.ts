import { createApp } from './app'
import { pool } from './db/pool'
import { env } from './env'
import { getSheetsConfig } from './lib/sheets'
import { runSync } from './services/syncService'

const app = createApp()

const server = app.listen(env.port, () => {
  const maskedDb = env.databaseUrl.replace(/:[^:@/]+@/, ':****@')
  const sheets = getSheetsConfig()
  console.log('')
  console.log(`  WCC API siap di http://localhost:${env.port}`)
  console.log(`  Environment : ${env.nodeEnv}`)
  console.log(`  Database    : ${maskedDb}`)
  console.log(`  CORS origin : ${env.corsOrigins.join(', ')}`)
  console.log(
    `  Google Sheets: ${
      sheets.configured ? `aktif (tab "${sheets.tab}")` : `belum dikonfigurasi — ${sheets.reason}`
    }`,
  )
  console.log('')

  startSyncScheduler()
})

/** Menjalankan sinkronisasi berkala bila diaktifkan lewat SHEETS_SYNC_INTERVAL_MINUTES. */
function startSyncScheduler(): void {
  if (env.sheetsSyncIntervalMinutes <= 0) return
  if (!getSheetsConfig().configured) {
    console.log('  Penjadwal sinkronisasi dilewati (Google Sheets belum dikonfigurasi).')
    return
  }
  const intervalMs = env.sheetsSyncIntervalMinutes * 60_000
  console.log(`  Penjadwal sinkronisasi aktif setiap ${env.sheetsSyncIntervalMinutes} menit.`)
  const timer = setInterval(() => {
    void runSync('scheduled').catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`  [sync] sinkronisasi terjadwal gagal: ${message}`)
    })
  }, intervalMs)
  timer.unref()
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} diterima, menutup server...`)
  server.close(() => {
    void pool.end().then(() => process.exit(0))
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
