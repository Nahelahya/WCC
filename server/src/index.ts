import { createApp } from './app'
import { pool } from './db/pool'
import { env } from './env'
import { getSheetsConfig } from './lib/sheets'
import { mailerStatus } from './lib/mailer'
import { uploadDir } from './lib/uploads'
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
  console.log(`  Email       : ${mailerStatus()}`)
  console.log(`  Unggahan    : ${uploadDir()}`)
  console.log(
    `  Google Sheets: ${
      sheets.configured ? `aktif (tab "${sheets.tab}")` : `belum dikonfigurasi — ${sheets.reason}`
    }`,
  )
  console.log('')

  startSyncScheduler()
})

// Batas waktu koneksi agar permintaan yang macet tidak menumpuk di antrean
// reverse proxy. Tanpa ini, Node membiarkan koneksi menggantung hingga 5 menit
// dan proxy bisa membalas 503 "The server is temporarily busy".
server.requestTimeout = 60_000
server.headersTimeout = 30_000
server.keepAliveTimeout = 65_000

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

// Catat kesalahan tak tertangani supaya penyebab matinya aplikasi terlihat di
// runtime log hosting (sebelumnya proses bisa berhenti tanpa jejak apa pun).
process.on('unhandledRejection', (reason) => {
  console.error(`[unhandledRejection] ${new Date().toISOString()}`, reason)
})

process.on('uncaughtException', (error) => {
  console.error(`[uncaughtException] ${new Date().toISOString()}`, error)
  // Keluar dengan kode gagal agar process manager (Passenger/Hostinger)
  // menyalakan ulang proses baru, bukan melanjutkan dengan state rusak.
  process.exit(1)
})
