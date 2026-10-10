import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { DEMO_PASSWORD, authApi } from '@/api/client'
import { errorMessage } from '@/lib/hooks'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Feedback'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Logo'

const DEMO_ACCOUNTS = [
  { role: 'Anggota', email: 'anggota@wcc.id', desc: 'Dashboard, jadwal, check-in absensi' },
  { role: 'Coach', email: 'coach@wcc.id', desc: 'Sesi yang diampu & daftar hadir' },
  { role: 'Pengurus', email: 'pengurus@wcc.id', desc: 'Kelola jadwal, absensi, pengumuman, kas' },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/app" replace />

  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  function validate() {
    const fe: typeof fieldErrors = {}
    if (!email.trim()) fe.email = 'Email wajib diisi.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fe.email = 'Format email tidak valid.'
    if (!password) fe.password = 'Password wajib diisi.'
    setFieldErrors(fe)
    return Object.keys(fe).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || !validate()) return
    setError(null)
    setSubmitting(true)
    try {
      const u = await login(email, password)
      toast(`Selamat datang, ${u.name}.`, 'success')
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel visual */}
      <div className="relative hidden overflow-hidden bg-primary p-10 text-white lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 15%, #F28C28 0, transparent 40%), radial-gradient(circle at 90% 80%, #ffffff 0, transparent 45%)',
          }}
        />
        <div className="relative">
          <Link to="/" aria-label="Kembali ke beranda">
            <Logo size={44} variant="light" />
          </Link>
        </div>
        <div className="relative mt-auto">
          <h2 className="max-w-md text-[30px] font-bold leading-tight">
            Satu pintu untuk seluruh kegiatan klub.
          </h2>
          <ul className="mt-6 space-y-3 text-sm text-white/80">
            {[
              'Catat kehadiran latihan langsung dari ponsel.',
              'Pantau jadwal dan pengumuman resmi klub.',
              'Kelola iuran dan kas klub dengan transparan.',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <Icon name="check-circle" size={18} className="mt-0.5 flex-none text-accent" />
                {t}
              </li>
            ))}
          </ul>
          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white"
          >
            <Icon name="chevron-left" size={16} />
            Kembali ke halaman utama
          </Link>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col justify-center bg-bg px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Link to="/">
              <Logo size={40} />
            </Link>
          </div>

          <h1 className="text-[26px] font-bold leading-tight text-ink">Masuk ke akun Anda</h1>
          <p className="mt-1.5 text-sm text-muted">
            Gunakan email yang terdaftar pada klub. Belum punya akun?{' '}
            <Link to="/daftar" className="link">
              Daftar di sini
            </Link>
            .
          </p>

          {error && (
            <Alert tone="error" className="mt-5">
              {error}
            </Alert>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              required
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Masukkan password"
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

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Checkbox
                label="Ingat saya di perangkat ini"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <Link to="/lupa-password" className="link text-sm">
                Lupa password?
              </Link>
            </div>

            <Button type="submit" size="lg" block loading={submitting}>
              {submitting ? 'Memproses…' : 'Masuk'}
            </Button>
          </form>

          <p className="mt-6 text-center text-[12.5px] text-muted">
            Dengan masuk, Anda menyetujui penggunaan data sesuai kebijakan privasi klub.
          </p>

          {/* Akun demo untuk prototype */}
          <div className="mt-8 rounded-card border border-dashed border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Icon name="info" size={16} className="text-info" />
              Akun demo (prototype)
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              Password semua akun: <code className="rounded bg-bg px-1.5 py-0.5 font-semibold text-ink">{DEMO_PASSWORD}</code>
            </p>
            <ul className="mt-3 space-y-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(a.email)
                      setPassword(DEMO_PASSWORD)
                      setFieldErrors({})
                      setError(null)
                    }}
                    className="flex w-full items-center gap-3 rounded-control border border-line px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-bg"
                  >
                    <span className="w-[68px] flex-none text-[12px] font-bold uppercase tracking-wide text-primary">
                      {a.role}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{a.email}</span>
                      <span className="block truncate text-[12px] text-muted">{a.desc}</span>
                    </span>
                    <Icon name="arrow-right" size={16} className="flex-none text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Format email tidak valid.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await authApi.requestPasswordReset(email)
      setSent(res.message)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/masuk" className="mb-6 flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-primary">
          <Icon name="chevron-left" size={15} />
          Kembali ke halaman masuk
        </Link>

        <div className="card p-6 sm:p-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-control bg-primary/10 text-primary">
            <Icon name="lock" size={21} />
          </span>
          <h1 className="mt-4 text-[22px] font-bold text-ink">Lupa password</h1>
          <p className="mt-1.5 text-sm text-muted">
            Masukkan email terdaftar. Kami akan mengirim tautan pemulihan password ke email tersebut.
          </p>

          {sent ? (
            <Alert tone="success" title="Email pemulihan terkirim" className="mt-5">
              {sent}
              <span className="mt-1 block text-[13px] text-ink/70">
                Periksa kotak masuk dan folder spam. Tautan berlaku terbatas.
              </span>
            </Alert>
          ) : (
            <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error ?? undefined}
                required
              />
              <Button type="submit" size="lg" block loading={submitting}>
                Kirim tautan pemulihan
              </Button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-[12.5px] text-muted">
          Untuk alasan keamanan, kami tidak memberi tahu apakah suatu email terdaftar.
        </p>
      </div>
    </div>
  )
}
