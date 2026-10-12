/**
 * Database migration runner for production.
 * Runs all SQL files in migrations/ directory in order.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool'

const currentDir = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const migrationsDir = join(currentDir, 'migrations')
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  console.log(`Found ${files.length} migration(s) to run.`)

  for (const file of files) {
    const filePath = join(migrationsDir, file)
    const sql = readFileSync(filePath, 'utf8')
    console.log(`Running migration: ${file}`)
    try {
      await pool.query(sql)
      console.log(`  ✓ ${file} applied`)
    } catch (error: any) {
      // Skip "already exists" errors
      if (error?.code === '42P07' || error?.code === '42710' || error?.message?.includes('already exists')) {
        console.log(`  ~ ${file} already applied, skipping`)
      } else {
        console.error(`  ✗ ${file} failed:`, error?.message || error)
        throw error
      }
    }
  }

  console.log('All migrations completed.')
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
