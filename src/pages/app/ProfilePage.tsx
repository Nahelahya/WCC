import { useState } from 'react'
import { Link } from 'react-router-dom'
import { API_MODE, attendanceApi, syncApi, uploadApi, userApi } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsync, errorMessage } from '@/lib/hooks'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/cards/StatCard'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Alert, EmptyState, ListSkeleton } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { MemberIdCard } from '@/components/cards/MemberIdCard'
import { Avatar } from '@/components/layout/SidebarNavigation'
import { StatusBadge, ATTENDANCE_TONE, ATTENDANCE_LABEL } from '@/components/ui/StatusBadge'
import { ROLE_LABEL } from '@/components/layout/nav'
import { formatDateID } from '@/lib/date'

export function ProfilePage() {
  const { user, setUser, logout } = useAuth()
  const { toast } = useToast()
  const history = useAsync(() => attendanceApi.byUser(user!.id), [user!.id])

  const [name, setName] = useState(user!.name)
  const [phone, setPhone] = useState(user!.phone ?? '')
  const [email, setEmail] = useState(user!.email)
  const [gender, setGender] = useState<'L' | 'P' | ''>(user!.gender ?? '')
  const [nik, setNik] = useState(user!.nik ?? '')
  const [address, setAddress] = useState(user!.address ?? '')
  const [medicalHistory, setMedicalHistory] = useState(user!.medicalHistory ?? '')
  const [parentName, setParentName] = useState(user!.parentName ?? '')
  const [parentPhone, setParentPhone] = useState(user!.parentPhone ?? '')
  const [profileErrors, setProfileErrors] = useState<{
    name?: string
    email?: string
    phone?: string
    nik?: string
    parentPhone?: string
  }>({})
  const [savingProfile, setSavingProfile] = useState(false)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [savingPw, setSavingPw] = useState(false)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)

  const rows = history.data ?? []
  const hadir = rows.filter((r) => r.status === 'hadir').length

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (savingProfile) return
    const errs: typeof profileErrors = {}
    if (!name.trim()) errs.name = 'Nama wajib diisi.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Format email tidak valid.'
    if (phone && phone.replace(/\D/g, '').length < 9) errs.phone = 'Nomor kontak terlalu pendek.'
    if (nik && !/^\d{16}$/.test(nik.trim())) errs.nik = 'NIK KTP harus tepat 16 digit angka.'
    if (parentPhone && parentPhone.replace(/\D/g, '').length < 9)
      errs.parentPhone = 'Kontak orang tua/wali terlalu pendek.'
    setProfileErrors(errs)
    if (Object.keys(errs).length) return

    setSavingProfile(true)
    try {
      const updated = await userApi.updateProfile(user!.id, {
        name,
        phone,
        email,
        gender: gender || undefined,
        nik,
        address,
        medicalHistory,
        parentName,
        parentPhone,
      })
      setUser(updated)
      toast('Perubahan berhasil disimpan.', 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (savingPw) return
    const errs: typeof pwErrors = {}
    if (!current) errs.current = 'Password saat ini wajib diisi.'
    if (next.length < 8) errs.next = 'Password baru minimal 8 karakter.'
    if (next !== confirm) errs.confirm = 'Konfirmasi password tidak sama.'
    setPwErrors(errs)
    if (Object.keys(errs).length) return

    setSavingPw(true)
    try {
      await userApi.changePassword(user!.id, current, next)
      toast('Password berhasil diubah.', 'success')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSavingPw(false)
    }
  }

  async function doReset() {
    setResetting(true)
    try {
      await syncApi.reset()
      toast('Data demo dikembalikan ke kondisi awal. Halaman akan dimuat ulang.', 'info')
      window.setTimeout(() => window.location.reload(), 900)
    } finally {
      setResetting(false)
    }
  }

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Format file tidak valid. Gunakan JPG, PNG, WebP, atau GIF.', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Ukuran foto maksimal 5 MB.', 'error')
      return
    }
    setUploadingPhoto(true)
    try {
      const { url } = await uploadApi.upload(file)
      const updated = await userApi.updateProfile(user!.id, { photoUrl: url })
      setUser(updated)
      toast('Foto profil berhasil diperbarui.', 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function removePhoto() {
    setRemovingPhoto(true)
    try {
      const updated = await userApi.updateProfile(user!.id, { photoUrl: '' })
      setUser(updated)
      toast('Foto profil berhasil dihapus.', 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setRemovingPhoto(false)
    }
  }

  return (
    <>
      <PageHeader
        title={user!.role === 'pengurus' ? 'Pengaturan & Profil' : 'Profil Akun'}
        description="Kelola informasi pribadi, keamanan akun, dan data keanggotaan."
      />

      {/* Kartu identitas */}
      <div className="card mb-6 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-none">
            <Avatar user={user!} size={72} />
            <label
              className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-primary shadow-sm transition hover:bg-bg disabled:opacity-60"
              title="Ubah foto profil"
            >
              <Icon name="camera" size={15} />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploadingPhoto}
                onChange={(e) => void onPhotoChange(e)}
              />
            </label>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold text-ink">{user!.name}</h2>
            <p className="truncate text-sm text-muted">{user!.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge tone="primary" icon="user">
                {ROLE_LABEL[user!.role]}
              </StatusBadge>
              {user!.membershipStatus && (
                <StatusBadge tone={user!.membershipStatus === 'aktif' ? 'success' : 'warning'} icon="check-circle">
                  Keanggotaan {user!.membershipStatus === 'aktif' ? 'Aktif' : 'Belum aktif'}
                </StatusBadge>
              )}
              <StatusBadge tone="neutral" icon="calendar">
                Bergabung {formatDateID(user!.joinedAt)}
              </StatusBadge>
            </div>
            {user!.photoUrl && (
              <button
                type="button"
                className="mt-2 text-[12.5px] font-medium text-muted transition hover:text-danger disabled:opacity-60"
                onClick={() => void removePhoto()}
                disabled={removingPhoto || uploadingPhoto}
              >
                {removingPhoto ? 'Menghapus…' : 'Hapus foto profil'}
              </button>
            )}
          </div>
          <div className="flex flex-none flex-col gap-2 sm:w-44">
            <Link to="/" className={buttonClasses('secondary', 'md', 'w-full')}>
              <Icon name="mountain" size={17} />
              Lihat Situs Publik
            </Link>
            <Button variant="secondary" icon="logout" onClick={() => void logout()} block>
              Keluar
            </Button>
          </div>
        </div>
      </div>

      {/* ID Card & QR Code */}
      <div className="card mb-6 p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">ID Card &amp; QR Code Absensi</h3>
        <MemberIdCard userId={user!.id} name={user!.name} photoUrl={user!.photoUrl} memberNumber={user!.id} />
      </div>

      {user!.role === 'anggota' && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total kehadiran" value={hadir} icon="check-circle" tone="success" />
          <StatCard label="Izin" value={rows.filter((r) => r.status === 'izin').length} icon="clock" tone="warning" />
          <StatCard
            label="Tidak hadir"
            value={rows.filter((r) => r.status === 'alpha').length}
            icon="x"
            tone="danger"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Edit profil */}
        <section>
          <SectionHeader title="Informasi dasar" description="Nama, email, nomor kontak, dan data identitas Anda." />
          <form onSubmit={saveProfile} className="card space-y-4 p-4 sm:p-5" noValidate>
            <Input
              label="Nama lengkap"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={profileErrors.name}
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={profileErrors.email}
              helper="Perubahan email memengaruhi cara Anda login."
              required
            />
            <Input
              label="Nomor kontak"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={profileErrors.phone}
              placeholder="0812-3456-7890"
            />
            {user!.role === 'anggota' && (
              <div className="space-y-4 border-t border-line pt-4">
                <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">
                  Data identitas &amp; kesehatan
                </p>
                <Select
                  label="Jenis kelamin"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'L' | 'P' | '')}
                >
                  <option value="">Belum diisi</option>
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </Select>
                <Input
                  label="NIK KTP"
                  inputMode="numeric"
                  maxLength={16}
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                  error={profileErrors.nik}
                  placeholder="16 digit sesuai KTP"
                  helper="Wajib 16 digit angka sesuai KTP."
                />
                <Textarea
                  label="Alamat lengkap"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jalan, nomor, RT/RW, kelurahan, kecamatan, kota/kabupaten."
                />
                <Textarea
                  label="Riwayat penyakit"
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  placeholder="Misalnya: asma, cedera lutut, atau tulis '-' jika tidak ada."
                  helper="Tulis '-' bila tidak memiliki riwayat penyakit/cedera."
                />
                <Input
                  label="Nama orang tua/wali"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="Nama lengkap orang tua/wali"
                />
                <Input
                  label="Kontak orang tua/wali"
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  error={profileErrors.parentPhone}
                  placeholder="0812-3456-7890"
                />
              </div>
            )}
            <div className="border-t border-line pt-4">
              <Button type="submit" loading={savingProfile} icon="check">
                Simpan Perubahan
              </Button>
            </div>
          </form>

          <SectionHeader className="mt-6" title="Ganti password" description="Gunakan password minimal 8 karakter." />
          <form onSubmit={savePassword} className="card space-y-4 p-4 sm:p-5" noValidate>
            <Input
              label="Password saat ini"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              error={pwErrors.current}
              autoComplete="current-password"
              required
            />
            <Input
              label="Password baru"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              error={pwErrors.next}
              autoComplete="new-password"
              required
            />
            <Input
              label="Konfirmasi password baru"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={pwErrors.confirm}
              autoComplete="new-password"
              required
            />
            <div className="border-t border-line pt-4">
              <Button type="submit" variant="secondary" loading={savingPw} icon="lock">
                Ganti Password
              </Button>
            </div>
          </form>
        </section>

        {/* Riwayat & pengaturan */}
        <section>
          <SectionHeader title="Riwayat absensi" description="Klik sesi untuk melihat detail." />
          {history.loading ? (
            <div className="card">
              <ListSkeleton rows={5} />
            </div>
          ) : rows.length === 0 ? (
            <div className="card">
              <EmptyState icon="check-circle" title="Belum ada riwayat absensi" />
            </div>
          ) : (
            <div className="card mb-6 divide-y divide-line">
              {rows.slice(0, 8).map((r) => (
                <Link
                  key={r.id}
                  to={`/app/jadwal/${r.sessionId}`}
                  className="flex items-center gap-3 p-3.5 transition-colors hover:bg-bg/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{r.sessionTitle}</p>
                    <p className="text-[12.5px] text-muted">
                      {formatDateID(r.sessionDate)}
                      {r.checkInTime ? ` · check-in ${r.checkInTime}` : ''}
                    </p>
                  </div>
                  <StatusBadge tone={ATTENDANCE_TONE[r.status]}>{ATTENDANCE_LABEL[r.status]}</StatusBadge>
                </Link>
              ))}
            </div>
          )}

          {API_MODE === 'mock' && (
            <>
              <SectionHeader title="Pengaturan prototype" description="Hanya tersedia pada versi demonstrasi." />
              <div className="card p-4 sm:p-5">
                <Alert tone="info" title="Data demo">
                  Prototype ini menyimpan data pada penyimpanan lokal peramban Anda. Anda dapat mengembalikannya
                  ke kondisi awal kapan saja.
                </Alert>
                <Button variant="danger" icon="refresh" className="mt-4" onClick={() => setResetOpen(true)}>
                  Reset Data Demo
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Reset data demo?"
        description="Seluruh perubahan yang Anda buat (jadwal, absensi, pengumuman, transaksi) akan dihapus dan data contoh dimuat ulang."
        confirmLabel="Reset Data"
        loading={resetting}
        onConfirm={doReset}
        onClose={() => setResetOpen(false)}
      />
    </>
  )
}
