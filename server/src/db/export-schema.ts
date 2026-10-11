/**
 * Export schema (DDL) dari database production.
 * Output bisa dijalankan di Supabase SQL Editor.
 * Jalankan: npx tsx src/db/export-schema.ts
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function exportSchema(): Promise<void> {
  console.log('Exporting database schema...')

  let sql = '-- WCC Production Schema Export\n'
  sql += `-- Generated: ${new Date().toISOString()}\n\n`

  // Get all tables with their columns
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

  for (const table of tables) {
    console.log(`  Exporting: ${table}`)

    // Get columns
    const columnsResult = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [table],
    )

    if (columnsResult.rows.length === 0) continue

    // const columns = columnsResult.rows.map((r: any) => r.column_name)

    // Get primary key
    const pkResult = await pool.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
       WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
      [table],
    )

    // Get foreign keys
    const fkResult = await pool.query(
      `SELECT
         kcu.column_name,
         ccu.table_name AS foreign_table_name,
         ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
       WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'`,
      [table],
    )

    // Generate CREATE TABLE
    sql += `CREATE TABLE IF NOT EXISTS ${table} (\n`

    const columnDefs: string[] = []
    for (const col of columnsResult.rows) {
      let def = `  ${col.column_name} ${col.data_type}`
      if (col.column_default) {
        def += ` DEFAULT ${col.column_default}`
      }
      if (col.is_nullable === 'NO') {
        def += ' NOT NULL'
      }
      columnDefs.push(def)
    }

    // Add primary key
    if (pkResult.rows.length > 0) {
      const pkCols = pkResult.rows.map((r: any) => r.column_name).join(', ')
      columnDefs.push(`  PRIMARY KEY (${pkCols})`)
    }

    // Add foreign keys
    for (const fk of fkResult.rows) {
      columnDefs.push(
        `  FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name})`,
      )
    }

    sql += columnDefs.join(',\n')
    sql += '\n);\n\n'

    // Get indexes
    const indexResult = await pool.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1`,
      [table],
    )
    for (const idx of indexResult.rows) {
      sql += `${idx.indexdef};\n`
    }
    sql += '\n'
  }

  const outputPath = join(__dirname, '..', '..', 'schema-export.sql')
  writeFileSync(outputPath, sql, 'utf8')

  console.log(`\nSchema exported to: ${outputPath}`)
  console.log(`File size: ${(sql.length / 1024).toFixed(1)} KB`)
}

exportSchema()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error('Export failed:', error)
    await pool.end()
    process.exit(1)
  })
