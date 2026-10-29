import { pool } from './pool'
import { hashPassword } from '../lib/password'
import { newId } from '../lib/ids'
import { randomBytes } from 'node:crypto'

/** Seed produksi: buat 1 akun admin (pengurus) saja, tanpa password statis.
 *
 *   npx tsx src/db/seed-production.ts
 *
 * Password awal diambil dari environment `ADMIN_PASSWORD` bila diisi;
 * bila tidak, di-generate acak (16 karakter) dan dicetak jelas supaya
 * pengurus segera menggantinya setelah login pertama.
 */
async function seedProduction(): Promise<void> {
  console.log('Membersihkan semua data demo...')

  // Hapus semua data dari tabel (urutan: foreign key dependencies)
  await pool.query(`delete from audit_logs cascade`)
  await pool.query(`delete from transactions cascade`)
  await pool.query(`delete from registrations cascade`)
  await pool.query(`delete from otp_codes cascade`)
  await pool.query(`delete from refresh_tokens cascade`)
  await pool.query(`delete from attendance cascade`)
  await pool.query(`delete from announcements cascade`)
  await pool.query(`delete from sessions cascade`)
  await pool.query(`delete from users cascade`)
  await pool.query(`delete from coaches cascade`)
  await pool.query(`delete from sync_logs cascade`)
  await pool.query(`delete from sync_state cascade`)

  console.log('Semua data demo dihapus.')

  // Ambil 1 akun admin tanpa password literal di source.
  const adminEmail = process.env.ADMIN_EMAIL ?? 'nahelahya4@gmail.com'
  let adminPassword: string
  if (process.env.ADMIN_PASSWORD) {
    adminPassword = process.env.ADMIN_PASSWORD
  } else {
    // Generate acak (tidak tersimpan di Git, hanya di console sekali).
    adminPassword = randomBytes(12).toString('base64url')
    console.log(
      '⚠️  ADMIN_PASSWORD tidak diisi. Password admin di-generate acak untuk sesi ini.',
    )
  }
  const adminHash = await hashPassword(adminPassword)

  await pool.query(
    `insert into users (id, name, email, password_hash, role, phone, joined_at, membership_status, created_at, updated_at)
     values ($1, $2, $3, $4, 'pengurus', null, now(), 'aktif', now(), now())`,
    [newId('u'), 'Nahel Ahya Ramadhani', adminEmail, adminHash],
  )

  console.log('Akun admin berhasil dibuat:')
  console.log(`  Email    : ${adminEmail}`)
  console.log(`  Password : ${adminPassword}  (catat segera, lalu ganti setelah login pertama)`)
  console.log(`  Role     : pengurus`)
  console.log('')
  console.log('⚠️  GANTI PASSWORD SEGERA setelah login pertama!')
}

seedProduction()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error('Production seed gagal:', error)
    await pool.end()
    process.exit(1)
  })
