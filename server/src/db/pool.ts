import pg from 'pg'
import { env } from '../env'

// Secara default `pg` mengubah kolom DATE menjadi objek Date (rawan bergeser
// satu hari karena zona waktu) dan NUMERIC menjadi string. Kita ubah agar:
//   - DATE   -> teks 'YYYY-MM-DD' (persis yang diharapkan frontend)
//   - NUMERIC-> number
pg.types.setTypeParser(1082, (value) => value)
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number(value)))

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
})

export type QueryParams = ReadonlyArray<unknown>

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: QueryParams = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[])
}

/** Menjalankan serangkaian query dalam satu transaksi. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
