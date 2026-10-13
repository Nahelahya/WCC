import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { registrationApi } from '@/api/client'
import { errorMessage } from '@/lib/hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Feedback'
import { Icon } from '@/components/ui/Icon'
import { StatusBadge, REGISTRATION_LABEL, REGISTRATION_TONE } from '@/components/ui/StatusBadge'
import { formatDateID, localDateOf } from '@/lib/date'
import type { Registration } from '@/types'

interface FormState {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  phone: string
  gender: '' | 'L' | 'P'
  nik: string
  address: string
  medicalHistory: string
  parentName: string
  parentPhone: string
  experience: string
  motivation: string
  consent: boolean
}

const EMPTY: FormState = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  gender: '',
  nik: '',
  address: '',
  medicalHistory: '',
  parentName: '',
  parentPhone: '',
  experience: '',
  motivation: '',
  consent: false,
}

export function RegisterPage() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Registration | null>(null)

  // Alur setelah kirim: `form` -> `otp` (verifikasi email) -> `done`.
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpNotice, setOtpNotice] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [emailVerified, setEmailVerified] = useState(false)

  // Hitung mundur tombol "Kirim ulang OTP".
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate() {
    const e: typeof errors = {}
    if (!form.fullName.trim()) e.fullName = 'Nama lengkap wajib diisi.'
    if (!form.email.trim()) e.email = 'Email wajib diisi.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Format email tidak valid.'
    if (!form.password) e.password = 'Password wajib diisi.'
    else if (form.password.length < 8) e.password = 'Password minimal 8 karakter.'
    if (!form.confirmPassword) e.confirmPassword = 'Konfirmasi password wajib diisi.'
    else if (form.confirmPassword !== form.password) e.confirmPassword = 'Konfirmasi password tidak sama.'
    if (!form.phone.trim()) e.phone = 'Nomor kontak wajib diisi.'
    else if (form.phone.replace(/\D/g, '').length < 9) e.phone = 'Nomor kontak terlalu pendek.'
    if (!form.gender) e.gender = 'Jenis kelamin wajib dipilih.'
    if (!form.nik.trim()) e.nik = 'NIK KTP wajib diisi.'
    else if (!/^\d{16}$/.test(form.nik.trim())) e.nik = 'NIK KTP harus tepat 16 digit angka.'
    if (!form.address.trim()) e.address = 'Alamat wajib diisi.'
    if (!form.medicalHistory.trim()) e.medicalHistory = 'Riwayat penyakit wajib diisi (tulis "-" jika tidak ada).'
    if (!form.parentName.trim()) e.parentName = 'Nama orang tua/wali wajib diisi.'
    if (!form.parentPhone.trim()) e.parentPhone = 'Kontak orang tua/wali wajib diisi.'
    else if (form.parentPhone.replace(/\D/g, '').length < 9) e.parentPhone = 'Kontak orang tua/wali terlalu pendek.'
    if (!form.experience.trim()) e.experience = 'Ceritakan pengalaman Anda (isi "-" jika belum pernah).'
    if (!form.consent) e.consent = 'Persetujuan pemrosesan data pribadi wajib dicentang.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (submitting || !validate()) return
    setGeneralError(null)
    setSubmitting(true)
    try {
      const created = await registrationApi.submit({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        gender: form.gender as 'L' | 'P',
        nik: form.nik.trim(),
        address: form.address,
        medicalHistory: form.medicalHistory,
        parentName: form.parentName,
        parentPhone: form.parentPhone,
        experience: form.experience,
        motivation: form.motivation,
        consent: form.consent,
        password: form.password,
      })
      setResult(created)
      setOtp('')
      setOtpError(null)
      setOtpNotice(null)
      setEmailVerified(false)
      setCooldown(60)
      setStep('otp')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setGeneralError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function onVerifyOtp(ev: React.FormEvent) {
    ev.preventDefault()
    if (verifying || !result) return
    const code = otp.trim()
    if (code.length < 6) {
      setOtpError('Masukkan kode OTP yang kami kirim ke email Anda.')
      return
    }
    setOtpError(null)
    setOtpNotice(null)
    setVerifying(true)
    try {
      await registrationApi.verifyOtp(result.email, code)
      setEmailVerified(true)
      setStep('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setOtpError(errorMessage(err))
    } finally {
      setVerifying(false)
    }
  }

  async function onResendOtp() {
    if (resending || cooldown > 0 || !result) return
    setResending(true)
    setOtpError(null)
    setOtpNotice(null)
    try {
      const res = await registrationApi.resendOtp(result.email)
      setOtpNotice(res.message)
      setCooldown(60)
    } catch (err) {
      setOtpError(errorMessage(err))
    } finally {
      setResending(false)
    }
  }

  if (step === 'otp' && result) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 sm:py-14">
        <PageHeader
          title="Verifikasi Email"
          description="Masukkan kode OTP yang kami kirim ke email Anda untuk mengonfirmasi pendaftaran."
          breadcrumb={
            <Link to="/" className="hover:text-primary">
              Beranda
            </Link>
          }
        />

        <div className="card p-6 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="mail" size={24} />
          </span>
          <h1 className="mt-4 text-[22px] font-bold text-ink">Cek email Anda</h1>
          <p className="mt-2 text-sm text-muted">
            Kami mengirim kode OTP 8 karakter ke{' '}
            <span className="font-semibold text-ink">{result.email}</span>. Kode berlaku selama 5 menit.
          </p>

          <form onSubmit={onVerifyOtp} className="mt-5 space-y-4" noValidate>
            <Input
              label="Kode OTP"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value)
                setOtpError(null)
              }}
              error={otpError ?? undefined}
              placeholder="8 karakter dari email"
              maxLength={12}
              autoComplete="one-time-code"
              autoFocus
              required
            />

            {otpNotice && <Alert tone="success">{otpNotice}</Alert>}

            <Button type="submit" size="lg" loading={verifying} block>
              Verifikasi Email
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted">
            <span>Tidak menerima kode?</span>
            <button
              type="button"
              className="font-medium text-primary transition hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onResendOtp()}
              disabled={resending || cooldown > 0}
            >
              {resending
                ? 'Mengirim…'
                : cooldown > 0
                  ? `Kirim ulang dalam ${cooldown} detik`
                  : 'Kirim ulang OTP'}
            </button>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <button
              type="button"
              className="text-[13px] font-medium text-muted transition hover:text-primary"
              onClick={() => {
                setStep('done')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              Verifikasi nanti — lanjut ke ringkasan pendaftaran
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'done' && result) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="card p-6 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <Icon name="check-circle" size={26} />
          </span>
          <h1 className="mt-4 text-[24px] font-bold text-ink">Pendaftaran berhasil dikirim</h1>
          <p className="mt-2 text-sm text-muted">
            Terima kasih, <span className="font-semibold text-ink">{result.fullName}</span>. Data Anda telah
            kami terima dan sedang menunggu verifikasi pengurus (maksimal 2 hari kerja).
          </p>
          <p className="mt-2 text-sm text-muted">
            Setelah diverifikasi, akun Anda otomatis aktif — silakan masuk menggunakan <strong>email</strong>{' '}
            dan <strong>password</strong> yang Anda buat tadi.
          </p>

          <Alert tone={emailVerified ? 'success' : 'warning'} className="mt-4">
            {emailVerified
              ? 'Email Anda berhasil diverifikasi.'
              : 'Email Anda belum diverifikasi. Verifikasi email membantu mempercepat proses persetujuan pengurus.'}
          </Alert>

          <dl className="mt-6 grid gap-3 rounded-card border border-line bg-bg/60 p-4 sm:grid-cols-2">
            <div>
              <dt className="text-[12.5px] text-muted">Nomor pendaftaran</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">{result.id.toUpperCase()}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted">Tanggal pengajuan</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">
                {formatDateID(localDateOf(result.submittedAt))}
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted">Status</dt>
              <dd className="mt-1">
                <StatusBadge tone={REGISTRATION_TONE[result.status]} icon="clock">
                  {REGISTRATION_LABEL[result.status]}
                </StatusBadge>
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted">Email terdaftar</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{result.email}</dd>
            </div>
          </dl>

          <Alert tone="info" className="mt-5" title="Langkah selanjutnya">
            Simpan nomor pendaftaran Anda. Pantau status melalui halaman Cek Status Pendaftaran menggunakan
            email yang Anda daftarkan.
          </Alert>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/daftar/status" className={buttonClasses('primary', 'md')}>
              Cek Status Pendaftaran
            </Link>
            <Link to="/" className={buttonClasses('secondary', 'md')}>
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        title="Pendaftaran Anggota Baru"
        description="Lengkapi data berikut. Pengurus akan meninjau pendaftaran Anda maksimal 2 hari kerja."
        breadcrumb={
          <Link to="/" className="hover:text-primary">
            Beranda
          </Link>
        }
      />

      <div className="card p-5 sm:p-6">
        {generalError && (
          <Alert tone="error" className="mb-5">
            {generalError}
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Input
            label="Nama lengkap"
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            error={errors.fullName}
            placeholder="Sesuai identitas"
            autoComplete="name"
            required
          />

          <Input
            label="Email aktif"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            error={errors.email}
            placeholder="nama@email.com"
            helper="Digunakan untuk login dan pemberitahuan status pendaftaran."
            autoComplete="email"
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              error={errors.password}
              placeholder="Minimal 8 karakter"
              helper="Password untuk masuk setelah pendaftaran diverifikasi."
              autoComplete="new-password"
              required
            />
            <Input
              label="Konfirmasi password"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              placeholder="Ulangi password"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nomor kontak"
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              error={errors.phone}
              placeholder="0812-3456-7890"
              autoComplete="tel"
              required
            />
            <Select
              label="Jenis kelamin"
              value={form.gender}
              onChange={(e) => set('gender', e.target.value as FormState['gender'])}
              error={errors.gender}
              required
            >
              <option value="">Pilih…</option>
              <option value="L">Laki-laki (L)</option>
              <option value="P">Perempuan (P)</option>
            </Select>
          </div>

          <Input
            label="Nomor identitas / NIK KTP"
            inputMode="numeric"
            maxLength={16}
            value={form.nik}
            onChange={(e) => set('nik', e.target.value.replace(/\D/g, ''))}
            error={errors.nik}
            placeholder="16 digit sesuai KTP"
            helper="Wajib 16 digit angka sesuai KTP."
            required
          />

          <Textarea
            label="Alamat lengkap"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            error={errors.address}
            placeholder="Jalan, nomor, RT/RW, kelurahan, kecamatan, kota/kabupaten."
            required
          />

          <Textarea
            label="Riwayat penyakit"
            value={form.medicalHistory}
            onChange={(e) => set('medicalHistory', e.target.value)}
            error={errors.medicalHistory}
            placeholder="Misalnya: asma, cedera lutut, atau tulis '-' jika tidak ada."
            helper="Tulis '-' bila tidak memiliki riwayat penyakit/cedera."
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nama orang tua/wali"
              value={form.parentName}
              onChange={(e) => set('parentName', e.target.value)}
              error={errors.parentName}
              placeholder="Nama lengkap orang tua/wali"
              required
            />
            <Input
              label="Kontak orang tua/wali"
              type="tel"
              value={form.parentPhone}
              onChange={(e) => set('parentPhone', e.target.value)}
              error={errors.parentPhone}
              placeholder="0812-3456-7890"
              autoComplete="tel"
              required
            />
          </div>

          <Textarea
            label="Pengalaman panjat tebing"
            value={form.experience}
            onChange={(e) => set('experience', e.target.value)}
            error={errors.experience}
            placeholder="Misalnya: bouldering 1 tahun, atau tulis '-' jika belum pernah."
            required
          />

          <Textarea
            label="Alasan bergabung (opsional)"
            value={form.motivation}
            onChange={(e) => set('motivation', e.target.value)}
            placeholder="Ceritakan singkat motivasi Anda."
          />

          <Checkbox
            label={
              <>
                Saya menyetujui pemrosesan data pribadi saya untuk keperluan administrasi keanggotaan
                WISANGGENI CLIMBING CLUB.
              </>
            }
            checked={form.consent}
            onChange={(e) => set('consent', e.target.checked)}
            error={errors.consent}
          />

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Link to="/" className={buttonClasses('secondary', 'lg', 'sm:w-auto')}>
              Batal
            </Link>
            <Button type="submit" size="lg" loading={submitting}>
              {submitting ? 'Mengirim…' : 'Kirim Pendaftaran'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function RegisterStatusPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [rows, setRows] = useState<Registration[]>([])
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Masukkan email yang Anda gunakan saat mendaftar.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await registrationApi.getByEmail(email)
      setRows(res)
      setSearched(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        title="Cek Status Pendaftaran"
        description="Masukkan email yang Anda gunakan saat mengirim pendaftaran."
        breadcrumb={
          <Link to="/" className="hover:text-primary">
            Beranda
          </Link>
        }
      />

      <div className="card p-5 sm:p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
          <div className="flex-1">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error ?? undefined}
              placeholder="nama@email.com"
              required
            />
          </div>
          <Button type="submit" size="lg" loading={loading} className="sm:mb-0">
            Cek Status
          </Button>
        </form>

        {searched && (
          <div className="mt-6">
            {rows.length === 0 ? (
              <Alert tone="warning" title="Data tidak ditemukan">
                Tidak ada pendaftaran dengan email tersebut. Periksa penulisan email atau hubungi pengurus.
              </Alert>
            ) : (
              <ul className="space-y-3">
                {rows.map((r) => (
                  <li key={r.id} className="rounded-card border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[15px] font-semibold text-ink">{r.fullName}</p>
                        <p className="text-[12.5px] text-muted">
                          {r.id.toUpperCase()} · Diajukan {formatDateID(localDateOf(r.submittedAt))}
                        </p>
                      </div>
                      <StatusBadge
                        tone={REGISTRATION_TONE[r.status]}
                        icon={r.status === 'diverifikasi' ? 'check-circle' : r.status === 'ditolak' ? 'x' : 'clock'}
                      >
                        {REGISTRATION_LABEL[r.status]}
                      </StatusBadge>
                    </div>

                    <p className="mt-3 rounded-control bg-bg px-3 py-2.5 text-[13px] text-muted">
                      {r.status === 'baru' &&
                        'Pendaftaran Anda sedang ditinjau pengurus. Mohon menunggu maksimal 2 hari kerja.'}
                      {r.status === 'diverifikasi' &&
                        'Pendaftaran diverifikasi. Akun Anda sudah aktif — silakan masuk menggunakan email dan password yang Anda buat saat mendaftar.'}
                      {r.status === 'ditolak' &&
                        'Pendaftaran belum dapat diterima. Silakan hubungi pengurus untuk informasi lebih lanjut.'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="mt-5 text-[12.5px] text-muted">
        Catatan internal pengurus tidak ditampilkan pada halaman ini.
      </p>
    </div>
  )
}
