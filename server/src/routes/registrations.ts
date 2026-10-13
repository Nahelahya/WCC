import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { mapRegistration, type RegistrationRow } from '../lib/mappers'
import { newId } from '../lib/ids'
import { hashPassword } from '../lib/password'
import { sendMail } from '../lib/mailer'
import { emailVerifyOtpEmail, registrationDecisionEmail, registrationReceivedEmail } from '../lib/emails'
import { generateOtp, hashOtp } from '../lib/otp'
import { requireAuth, requireRole } from '../middleware/auth'

export const registrationRouter = Router()

/* ---------------- Publik: kirim & cek status pendaftaran ---------------- */

const submitSchema = z.object({
  fullName: z.string().trim().min(1, 'Nama lengkap wajib diisi.'),
  email: z.string().trim().email('Format email tidak valid.'),
  phone: z.string().trim().min(1, 'Nomor kontak wajib diisi.'),
  gender: z.enum(['L', 'P'], {
    errorMap: () => ({ message: 'Jenis kelamin wajib dipilih (L/P).' }),
  }),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, 'NIK KTP harus tepat 16 digit angka.'),
  address: z.string().trim().min(1, 'Alamat wajib diisi.'),
  medicalHistory: z
    .string()
    .trim()
    .min(1, 'Riwayat penyakit wajib diisi (tulis "-" bila tidak ada).'),
  parentName: z.string().trim().min(1, 'Nama orang tua/wali wajib diisi.'),
  parentPhone: z.string().trim().min(1, 'Kontak orang tua/wali wajib diisi.'),
  experience: z.string().trim().min(1, 'Pengalaman wajib diisi.'),
  motivation: z.string().optional(),
  password: z.string().min(8, 'Password minimal 8 karakter.'),
  consent: z
    .boolean()
    .refine((v) => v === true, 'Persetujuan pemrosesan data pribadi wajib dicentang.'),
})

registrationRouter.post(
  '/',
  wrap(async (req, res) => {
    const input = submitSchema.parse(req.body ?? {})
    const { rows } = await query<RegistrationRow>(
      `insert into registrations
         (id, full_name, email, phone, gender, nik, address, medical_history,
          parent_name, parent_phone, experience, motivation, consent,
          password_hash, status, submitted_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,'baru', now())
       returning *`,
      [
        newId('r'),
        input.fullName,
        input.email,
        input.phone,
        input.gender,
        input.nik,
        input.address,
        input.medicalHistory,
        input.parentName,
        input.parentPhone,
        input.experience,
        input.motivation ?? null,
        await hashPassword(input.password),
      ],
    )
    // Kirim email konfirmasi & OTP verifikasi email
    void sendMail(registrationReceivedEmail(rows[0].email, rows[0].full_name)).catch((err: unknown) =>
      console.error('Gagal mengirim email konfirmasi pendaftaran:', err),
    )
    void (async () => {
      try {
        // Batalkan OTP email_verify lama untuk email ini yang belum dipakai
        await query(
          `update otp_codes set used_at = now() where lower(email)=lower($1) and purpose='email_verify' and used_at is null and verified_at is null`,
          [rows[0].email],
        )
        const otp = generateOtp(8)
        await query(
          `insert into otp_codes (id, purpose, email, otp_hash, expires_at, max_tries)
           values ($1, 'email_verify', $2, $3, now() + make_interval(mins => 5), 5)`,
          [newId('otp'), rows[0].email, hashOtp(otp)],
        )
        await sendMail(emailVerifyOtpEmail(rows[0].email, rows[0].full_name, otp))
      } catch (err) {
        console.error('Gagal mengirim OTP verifikasi email pendaftaran:', err)
      }
    })()
    res.status(201).json(mapRegistration(rows[0]))
  }),
)

// Harus dideklarasikan SEBELUM rute '/:id' agar tidak tertukar.
registrationRouter.get(
  '/status',
  wrap(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().min(1, 'Email wajib diisi.') }).parse(req.query)
    const { rows } = await query<RegistrationRow>(
      `select * from registrations
       where lower(email) = lower($1)
       order by submitted_at desc`,
      [email],
    )
    // Data lengkap milik pemohon sendiri, TANPA catatan internal pengurus.
    res.json(
      rows.map((row) => {
        const mapped = mapRegistration(row)
        delete mapped.internalNote
        return mapped
      }),
    )
  }),
)

/* -------------------------- Pengurus: kelola --------------------------- */

registrationRouter.get(
  '/',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (_req, res) => {
    const { rows } = await query<RegistrationRow>('select * from registrations order by submitted_at desc')
    res.json(rows.map(mapRegistration))
  }),
)

registrationRouter.get(
  '/:id',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const { rows } = await query<RegistrationRow>('select * from registrations where id = $1', [
      req.params.id,
    ])
    if (!rows[0]) throw ApiError.notFound('Pendaftaran tidak ditemukan.')
    res.json(mapRegistration(rows[0]))
  }),
)

/**
 * Membuat akun anggota dari pendaftaran yang diverifikasi.
 *
 * Memakai password (hash) yang dipilih calon anggota saat mendaftar, sehingga
 * begitu verifikasi disetujui mereka bisa langsung masuk tanpa dibuat manual.
 * Dilewati bila email sudah punya akun, atau bila pendaftaran lama tanpa password.
 */
async function provisionMemberAccount(reg: RegistrationRow): Promise<void> {
  if (!reg.password_hash) return
  try {
    const { rows } = await query<{ id: string }>(
      'select id from users where lower(email) = lower($1) limit 1',
      [reg.email],
    )
    if (rows[0]) return

    await query(
      `insert into users
         (id, name, email, role, phone, gender, nik, address, medical_history,
          parent_name, parent_phone, membership_status, password_hash, joined_at, created_at, updated_at)
       values ($1,$2,$3,'anggota',$4,$5,$6,$7,$8,$9,$10,'aktif',$11, current_date, now(), now())`,
      [
        newId('u'),
        reg.full_name,
        reg.email,
        reg.phone || null,
        reg.gender || null,
        reg.nik || null,
        reg.address || null,
        reg.medical_history || null,
        reg.parent_name || null,
        reg.parent_phone || null,
        reg.password_hash,
      ],
    )
  } catch (error) {
    // Verifikasi tetap berhasil walau pembuatan akun gagal; pengurus dapat
    // membuat akun manual lewat menu Pengguna bila perlu.
    console.error('Gagal membuat akun anggota dari pendaftaran:', error)
  }
}

registrationRouter.patch(
  '/:id/status',
  requireAuth,
  requireRole('pengurus'),
  wrap(async (req, res) => {
    const { status, internalNote } = z
      .object({
        status: z.enum(['baru', 'diverifikasi', 'ditolak']),
        internalNote: z.string().optional(),
      })
      .parse(req.body ?? {})

    const { rows: previous } = await query<RegistrationRow>('select * from registrations where id = $1', [
      req.params.id,
    ])
    const before = previous[0]
    if (!before) throw ApiError.notFound('Pendaftaran tidak ditemukan.')

    // Keputusan verifikasi/tolak bersifat FINAL — sekali dipilih tidak dapat
    // diubah lagi. Ini mencegah keputusan bolak-balik dan pembuatan akun ganda.
    const finalTerpilih = before.status === 'diverifikasi' || before.status === 'ditolak'
    if (finalTerpilih && status !== before.status) {
      throw ApiError.conflict(
        before.status === 'diverifikasi'
          ? 'Pendaftaran ini sudah diverifikasi dan keputusannya bersifat final.'
          : 'Pendaftaran ini sudah ditolak dan keputusannya bersifat final.',
      )
    }

    const { rows } = await query<RegistrationRow>(
      `update registrations
       set status = $2, internal_note = coalesce($3, internal_note)
       where id = $1
       returning *`,
      [req.params.id, status, internalNote ?? null],
    )
    if (!rows[0]) throw ApiError.notFound('Pendaftaran tidak ditemukan.')

    const changed = before.status !== rows[0].status

    // Saat diverifikasi: buat akun anggota otomatis memakai password yang
    // dipilih calon anggota saat mendaftar, agar bisa langsung masuk (login).
    if (rows[0].status === 'diverifikasi' && changed) {
      await provisionMemberAccount(rows[0])
    }

    // Kirim email keputusan hanya bila status benar-benar berubah ke hasil final.
    if ((rows[0].status === 'diverifikasi' || rows[0].status === 'ditolak') && changed) {
      void sendMail(
        registrationDecisionEmail(rows[0].email, rows[0].full_name, rows[0].status, rows[0].internal_note ?? undefined),
      ).catch((err: unknown) => console.error('Gagal mengirim email keputusan pendaftaran:', err))
    }
    res.json(mapRegistration(rows[0]))
  }),
)
