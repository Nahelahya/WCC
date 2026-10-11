import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool'
import { ApiError } from '../lib/errors'
import { wrap } from '../lib/async'
import { mapRegistration, type RegistrationRow } from '../lib/mappers'
import { newId } from '../lib/ids'
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
  experience: z.string().trim().min(1, 'Pengalaman wajib diisi.'),
  motivation: z.string().optional(),
  consent: z
    .boolean()
    .refine((v) => v === true, 'Persetujuan pemrosesan data pribadi wajib dicentang.'),
})

registrationRouter.post(
  '/',
  wrap(async (req, res) => {
    const input = submitSchema.parse(req.body ?? {})
    const { rows } = await query<RegistrationRow>(
      `insert into registrations (id, full_name, email, phone, experience, motivation, consent, status, submitted_at)
       values ($1,$2,$3,$4,$5,$6,true,'baru', now())
       returning *`,
      [newId('r'), input.fullName, input.email, input.phone, input.experience, input.motivation ?? null],
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
    const { rows } = await query<RegistrationRow>(
      `update registrations
       set status = $2, internal_note = coalesce($3, internal_note)
       where id = $1
       returning *`,
      [req.params.id, status, internalNote ?? null],
    )
    if (!rows[0]) throw ApiError.notFound('Pendaftaran tidak ditemukan.')

    // Kirim email keputusan hanya bila status benar-benar berubah ke hasil final.
    const changed = previous[0]?.status !== rows[0].status
    if ((rows[0].status === 'diverifikasi' || rows[0].status === 'ditolak') && changed) {
      void sendMail(
        registrationDecisionEmail(rows[0].email, rows[0].full_name, rows[0].status, rows[0].internal_note ?? undefined),
      ).catch((err: unknown) => console.error('Gagal mengirim email keputusan pendaftaran:', err))
    }
    res.json(mapRegistration(rows[0]))
  }),
)
