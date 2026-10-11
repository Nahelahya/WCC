import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/lib/hooks'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Feedback'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Logo'

export function ResetPasswordPage() {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; otp?: string; password?: string; confirm?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || resending) return
    const fe: typeof fieldErrors = {}
    if (!email.trim()) fe.email = 'Email wajib diisi.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fe.email = 'Format email tidak valid.'
    setFieldErrors(fe)
    if (Object.keys(fe).length) return

    setError(null)
    setSubmitting(true)
    try {
      await authApi.requestPasswordReset(email.trim())
      toast('Kode OTP telah dikirim ke email Anda (5 menit berlaku).', 'success')
      setStep('otp')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function resendOtp() {
    if (resending || submitting) return
    setResending(true)
    setError(null)
    try {
      await authApi.requestPasswordReset(email.trim())
      toast('Kode OTP baru telah dikirim ke email Anda.', 'success')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setResending(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    const fe: typeof fieldErrors = {}
    if (!otp.trim()) fe.otp = 'Kode OTP wajib diisi.'
    if (password.length < 8) fe.password = 'Password baru minimal 8 karakter.'
    if (confirm !== password) fe.confirm = 'Konfirmasi password tidak cocok.'
    setFieldErrors(fe)
    if (Object.keys(fe).length) return

    setError(null)
    setSubmitting(true)
    try {
      await authApi.resetPassword(email.trim(), otp.trim(), password)
      toast('Password berhasil diubah. Silakan masuk dengan password baru.', 'success')
      navigate('/masuk', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 lg:hidden">
          <Link to="/">
            <Logo size={40} />
          </Link>
        </div>

        <div className="card p-6 sm:p-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-control bg-primary/10 text-primary">
            <Icon name="lock" size={21} />
          </span>
          <h1 className="mt-4 text-[22px] font-bold text-ink">
            {step === 'email' ? 'Lupa password' : 'Buat password baru'}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {step === 'email'
              ? 'Masukkan email terdaftar. Kami akan mengirim kode OTP 8 digit ke email Anda.'
              : 'Masukkan kode OTP yang dikirim ke email dan password baru Anda.'}
          </p>

          {error && (
            <Alert tone="error" className="mt-5">
              {error}
            </Alert>
          )}

          {step === 'email' ? (
            <form onSubmit={sendOtp} className="mt-5 space-y-4" noValidate>
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="nama@contoh.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
                required
              />
              <Button type="submit" size="lg" block loading={submitting}>
                Kirim kode OTP
              </Button>
              <div className="text-center text-sm text-muted">
                Kembali ke{' '}
                <Link to="/masuk" className="link">
                  halaman masuk
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
              <Input
                label="Kode OTP"
                inputMode="text"
                placeholder="Contoh: AB9XK4M2"
                value={otp}
                onChange={(e) => setOtp(e.target.value.toUpperCase())}
                error={fieldErrors.otp}
                required
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Tidak menerima OTP?</span>
                <button
                  type="button"
                  className="link"
                  disabled={resending}
                  onClick={resendOtp}
                >
                  {resending ? 'Mengirim…' : 'Kirim ulang OTP'}
                </button>
              </div>
              <Input
                label="Password baru"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                required
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="flex h-9 w-9 items-center justify-center rounded-control text-muted hover:bg-bg hover:text-ink"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    aria-pressed={showPassword}
                  >
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                  </button>
                }
              />
              <Input
                label="Ulangi password baru"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Ketik ulang password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={fieldErrors.confirm}
                required
              />
              <Button type="submit" size="lg" block loading={submitting}>
                Simpan password baru
              </Button>
              <div className="text-center text-sm text-muted">
                <button
                  type="button"
                  className="link"
                  onClick={() => setStep('email')}
                  disabled={submitting}
                >
                  Ganti email
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <Link to="/">
            <Logo size={32} />
          </Link>
        </div>
      </div>
    </div>
  )
}
