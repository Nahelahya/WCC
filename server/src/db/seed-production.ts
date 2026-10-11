/**
 * Production seed: membersihkan semua data demo dan hanya membuat
 * 1 akun admin dengan email asli.
 *
 * Jalankan dengan: npx tsx src/db/seed-production.ts
 */
import { pool } from './pool'
import { hashPassword } from '../lib/password'
import { newId } from '../lib/ids'

async function seedProduction(): Promise<void> {
  console.log('Membersihkan semua data demo...')

  // Hapus semua data dari tabel (urutan: foreign key dependencies)
  await pool.query(`
    TRUNCATE TABLE
      attendance,
      refresh_tokens,
      otp_codes,
      audit_logs,
      registrations,
      transactions,
      announcements,
      sessions,
      users,
      coaches,
      sync_logs,
      sync_state
    RESTART IDENTITY CASCADE
  `)

  console.log('Semua data demo dihapus.')

  // Buat 1 akun admin
  const adminEmail = 'nahelahya4@gmail.com'
  const adminPassword = 'wcc12345' // GANTI setelah login pertama!
  const adminHash = await hashPassword(adminPassword)

  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, phone, joined_at, membership_status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'pengurus', NULL, now(), 'aktif', now(), now())`,
    [newId('u'), 'Nahel Ahya Ramadhani', adminEmail, adminHash],
  )

  console.log('Akun admin berhasil dibuat:')
  console.log(`  Email    : ${adminEmail}`)
  console.log(`  Password : ${adminPassword}`)
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
