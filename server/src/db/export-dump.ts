/**
 * Export database production ke file SQL dump.
 * Jalankan: npx tsx src/db/export-dump.ts
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function exportDump(): Promise<void> {
  console.log('Exporting database dump...')

  const tables = [
    'users',
    'coaches',
    'sessions',
    'attendance',
    'announcements',
    'registrations',
    'transactions',
    'audit_logs',
    'otp_codes',
    'refresh_tokens',
    'landing_content',
    'sync_logs',
    'sync_state',
  ]

  let sql = '-- WCC Production Database Dump\n'
  sql += `-- Generated: ${new Date().toISOString()}\n`
  sql += '-- Database: Neon PostgreSQL\n\n'
  sql += 'BEGIN;\n\n'

  for (const table of tables) {
    console.log(`  Exporting table: ${table}`)

    // Get columns
    const columnsResult = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [table],
    )

    if (columnsResult.rows.length === 0) continue

    const columns = columnsResult.rows.map((r: any) => r.column_name)

    // Get data
    const dataResult = await pool.query(`SELECT * FROM ${table}`)

    if (dataResult.rows.length === 0) {
      sql += `-- Table ${table}: no data\n\n`
      continue
    }

    // Generate INSERT statements
    for (const row of dataResult.rows) {
      const values = columns.map((col: string) => {
        const val = row[col]
        if (val === null) return 'NULL'
        if (val instanceof Date) return `'${val.toISOString()}'`
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
        return String(val)
      })
      sql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`
    }
    sql += '\n'
  }

  sql += 'COMMIT;\n'

  const outputPath = join(__dirname, '..', '..', 'db-backup-production.sql')
  writeFileSync(outputPath, sql, 'utf8')

  console.log(`\nDump saved to: ${outputPath}`)
  console.log(`File size: ${(sql.length / 1024).toFixed(1)} KB`)
}

exportDump()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error('Export failed:', error)
    await pool.end()
    process.exit(1)
  })
