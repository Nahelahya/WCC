import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

async function runMigrations(): Promise<void> {
  await pool.query(
    `create table if not exists schema_migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  )

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()

  for (const file of files) {
    const { rowCount } = await pool.query('select 1 from schema_migrations where name = $1', [file])
    if (rowCount) {
      console.log(`• ${file} — sudah diterapkan sebelumnya`)
      continue
    }

    const sql = await readFile(join(migrationsDir, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('insert into schema_migrations (name) values ($1)', [file])
      await client.query('COMMIT')
      console.log(`✓ ${file} — diterapkan`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

runMigrations()
  .then(() => {
    console.log('\nMigrasi selesai.')
    return pool.end()
  })
  .catch(async (error) => {
    console.error('\nMigrasi gagal:', error)
    await pool.end()
    process.exit(1)
  })
