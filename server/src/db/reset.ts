import { pool } from './pool'

const TABLES = [
  'attendance',
  'refresh_tokens',
  'audit_logs',
  'registrations',
  'transactions',
  'announcements',
  'sessions',
  'users',
  'coaches',
  'sync_logs',
  'sync_state',
  'schema_migrations',
]

async function reset(): Promise<void> {
  await pool.query(`drop table if exists ${TABLES.join(', ')} cascade`)
  console.log('Semua tabel dihapus. Jalankan `npm run db:setup` untuk membuat ulang.')
}

reset()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error('Reset gagal:', error)
    await pool.end()
    process.exit(1)
  })
