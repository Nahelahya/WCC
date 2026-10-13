import { useMemo, useState } from 'react'
import { coachApi, userApi } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { useAsync, errorMessage } from '@/lib/hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/cards/StatCard'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge'
import { ROLE_LABEL } from '@/components/layout/nav'
import { formatDateID } from '@/lib/date'
import type { Role, User } from '@/types'

type Membership = 'aktif' | 'nonaktif' | 'pending'

interface FormState {
  id?: string
  name: string
  email: string
  role: Role
  password: string
  phone: string
  membershipStatus: Membership
  coachId: string
}

const EMPTY: FormState = {
  name: '',
  email: '',
  role: 'anggota',
  password: '',
  phone: '',
  membershipStatus: 'aktif',
  coachId: '',
}

const ROLE_TONE: Record<Role, StatusTone> = {
  anggota: 'neutral',
  coach: 'info',
  pengurus: 'primary',
}

const MEMBERSHIP_TONE: Record<Membership, StatusTone> = {
  aktif: 'success',
  pending: 'warning',
  nonaktif: 'neutral',
}

const MEMBERSHIP_LABEL: Record<Membership, string> = {
  aktif: 'Aktif',
  pending: 'Menunggu',
  nonaktif: 'Nonaktif',
}

const ROLE_FILTERS: { value: Role | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua peran' },
  { value: 'anggota', label: ROLE_LABEL.anggota },
  { value: 'coach', label: ROLE_LABEL.coach },
  { value: 'pengurus', label: ROLE_LABEL.pengurus },
]

export function UsersPage() {
  const { toast } = useToast()
  const { user: me } = useAuth()
  const users = useAsync(async () => {
    const [anggota, coach, pengurus] = await Promise.all([
      userApi.listByRole('anggota'),
      userApi.listByRole('coach'),
      userApi.listByRole('pengurus'),
    ])
    return [...anggota, ...coach, ...pengurus].sort((a, b) => a.name.localeCompare(b.name))
  }, [])
  const coaches = useAsync(() => coachApi.list(), [])

  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [saving, setSaving] = useState(false)

  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [detail, setDetail] = useState<User | null>(null)

  const all = users.data ?? []

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [all, roleFilter, search])

  const coachName = (id?: string) => coaches.data?.find((c) => c.id === id)?.name

  function openCreate() {
    setForm(EMPTY)
    setErrors({})
    setFormOpen(true)
  }

  function openEdit(u: User) {
    setForm({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      password: '',
      phone: u.phone ?? '',
      membershipStatus: u.membershipStatus ?? 'aktif',
      coachId: u.coachId ?? '',
    })
    setErrors({})
    setFormOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const errs: typeof errors = {}
    if (!form.name.trim()) errs.name = 'Nama wajib diisi.'
    if (!form.email.trim()) errs.email = 'Email wajib diisi.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Format email tidak valid.'
    if (!form.id && form.password.length < 8) errs.password = 'Password minimal 8 karakter.'
    if (form.role === 'coach' && !form.coachId) errs.coachId = 'Pilih profil coach untuk akun ini.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      if (form.id) {
        await userApi.updateAccount(form.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: form.role,
          membershipStatus: form.membershipStatus,
          coachId: form.coachId,
        })
        toast('Akun pengguna berhasil diperbarui.', 'success')
      } else {
        await userApi.create({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          phone: form.phone.trim() || undefined,
          membershipStatus: form.membershipStatus,
          coachId: form.coachId || undefined,
        })
        toast(`Akun ${ROLE_LABEL[form.role]} berhasil dibuat.`, 'success')
      }
      setFormOpen(false)
      users.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function confirmReset() {
    if (!resetTarget) return
    if (newPassword.length < 8) {
      toast('Password baru minimal 8 karakter.', 'error')
      return
    }
    setResetting(true)
    try {
      await userApi.changePassword(resetTarget.id, '', newPassword)
      toast(`Password ${resetTarget.name} berhasil disetel ulang.`, 'success')
      setResetTarget(null)
      setNewPassword('')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setResetting(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await userApi.remove(deleteTarget.id)
      toast('Akun pengguna berhasil dihapus.', 'success')
      setDeleteTarget(null)
      users.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const showCoachField = form.role === 'coach' || form.role === 'anggota'

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Nama',
      render: (u) => (
        <div>
          <p className="font-medium text-ink">{u.name}</p>
          <p className="text-[12.5px] text-muted">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Peran',
      render: (u) => (
        <StatusBadge tone={ROLE_TONE[u.role]} icon={u.role === 'anggota' ? 'user' : 'shield'}>
          {ROLE_LABEL[u.role]}
        </StatusBadge>
      ),
    },
    {
      key: 'membership',
      header: 'Keanggotaan',
      hideOnMobile: true,
      render: (u) => (
        <StatusBadge tone={MEMBERSHIP_TONE[(u.membershipStatus ?? 'aktif') as Membership]}>
          {MEMBERSHIP_LABEL[(u.membershipStatus ?? 'aktif') as Membership]}
        </StatusBadge>
      ),
    },
    {
      key: 'coach',
      header: 'Profil Coach',
      hideOnMobile: true,
      render: (u) => <span className="text-muted">{u.coachId ? coachName(u.coachId) ?? u.coachId : '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Kontak',
      hideOnMobile: true,
      render: (u) => <span className="text-muted">{u.phone || '—'}</span>,
    },
    {
      key: 'joined',
      header: 'Bergabung',
      hideOnMobile: true,
      render: (u) => <span className="text-muted">{formatDateID(u.joinedAt.slice(0, 10))}</span>,
    },
    {
      key: 'action',
      header: 'Aksi',
      align: 'right',
      render: (u) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="secondary" icon="eye" onClick={() => setDetail(u)}>
            <span className="sr-only">Lihat data {u.name}</span>
          </Button>
          <Button size="sm" variant="secondary" icon="edit" onClick={() => openEdit(u)}>
            <span className="sr-only">Ubah {u.name}</span>
          </Button>
          {me?.id !== u.id && (
            <Button
              size="sm"
              variant="secondary"
              icon="lock"
              onClick={() => {
                setResetTarget(u)
                setNewPassword('')
              }}
            >
              <span className="sr-only">Setel ulang password {u.name}</span>
            </Button>
          )}
          {me?.id !== u.id && (
            <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleteTarget(u)}>
              <span className="sr-only">Hapus {u.name}</span>
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Manajemen Pengguna"
        description="Buat dan kelola akun pengguna: anggota, coach, dan pengurus."
        action={<Button icon="plus" onClick={openCreate}>Tambah Pengguna</Button>}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Anggota" value={all.filter((u) => u.role === 'anggota').length} icon="user" tone="info" />
        <StatCard label="Coach" value={all.filter((u) => u.role === 'coach').length} icon="users" tone="accent" />
        <StatCard label="Pengurus" value={all.filter((u) => u.role === 'pengurus').length} icon="shield" tone="success" />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <Select label="Filter peran" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}>
            {ROLE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-72">
          <Input
            label="Cari"
            placeholder="Cari nama atau email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        loading={users.loading}
        error={users.error}
        onRetry={users.reload}
        caption="Daftar pengguna"
        emptyIcon="users"
        emptyTitle="Belum ada pengguna"
        emptyDescription="Tambahkan akun anggota, coach, atau pengurus melalui tombol Tambah Pengguna."
        emptyAction={<Button icon="plus" onClick={openCreate}>Tambah Pengguna</Button>}
        renderMobileCard={(u) => (
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{u.name}</p>
                <p className="truncate text-[12.5px] text-muted">{u.email}</p>
              </div>
              <StatusBadge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</StatusBadge>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" icon="eye" onClick={() => setDetail(u)}>
                Detail
              </Button>
              <Button size="sm" variant="secondary" icon="edit" onClick={() => openEdit(u)}>
                Ubah
              </Button>
              {me?.id !== u.id && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="lock"
                    onClick={() => {
                      setResetTarget(u)
                      setNewPassword('')
                    }}
                  >
                    Password
                  </Button>
                  <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleteTarget(u)}>
                    Hapus
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      />

      {/* Form buat / ubah akun */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? 'Ubah akun pengguna' : 'Tambah pengguna baru'}
        description={
          form.id
            ? 'Perbarui data akun. Perubahan peran langsung berlaku pada hak akses pengguna.'
            : 'Buat kredensial login untuk anggota, coach, atau pengurus baru.'
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" form="user-form" loading={saving}>
              {form.id ? 'Simpan perubahan' : 'Buat akun'}
            </Button>
          </>
        }
      >
        <form id="user-form" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nama lengkap"
              required
              value={form.name}
              error={errors.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              error={errors.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Peran"
              required
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            >
              <option value="anggota">Anggota</option>
              <option value="coach">Coach</option>
              <option value="pengurus">Pengurus</option>
            </Select>
            <Select
              label="Status keanggotaan"
              value={form.membershipStatus}
              onChange={(e) => setForm((f) => ({ ...f, membershipStatus: e.target.value as Membership }))}
            >
              <option value="aktif">Aktif</option>
              <option value="pending">Menunggu</option>
              <option value="nonaktif">Nonaktif</option>
            </Select>
          </div>

          {showCoachField && (
            <Select
              label={form.role === 'coach' ? 'Profil coach' : 'Coach pendamping (opsional)'}
              required={form.role === 'coach'}
              value={form.coachId}
              error={errors.coachId}
              onChange={(e) => setForm((f) => ({ ...f, coachId: e.target.value }))}
            >
              <option value="">— Tidak ditautkan —</option>
              {(coaches.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}

          <Input
            label="Nomor kontak (opsional)"
            value={form.phone}
            error={errors.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />

          {!form.id && (
            <Input
              label="Password awal"
              type="password"
              required
              helper="Minimal 8 karakter. Sampaikan kepada pengguna, lalu minta mereka menggantinya."
              value={form.password}
              error={errors.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          )}

          {form.role === 'coach' && (
            <Alert tone="info">
              Akun coach wajib ditautkan ke sebuah profil coach agar dapat melihat dan mencatat kehadiran pada jadwal
              yang diampu.
            </Alert>
          )}
        </form>
      </Modal>

      {/* Setel ulang password */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="Setel ulang password"
        description={resetTarget ? `Tetapkan password baru untuk ${resetTarget.name}.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)} disabled={resetting}>
              Batal
            </Button>
            <Button onClick={() => void confirmReset()} loading={resetting}>
              Simpan password
            </Button>
          </>
        }
      >
        <Input
          label="Password baru"
          type="password"
          required
          helper="Minimal 8 karakter. Pengguna akan diminta login ulang di semua perangkat."
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </Modal>

      {/* Detail data anggota (identitas dari pendaftaran) */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detail data anggota"
        description={detail ? `${detail.name} · ${detail.email}` : undefined}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Tutup
          </Button>
        }
      >
        {detail && (
          <div className="space-y-3">
            <dl className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['Peran', ROLE_LABEL[detail.role]],
                  ['Status keanggotaan', MEMBERSHIP_LABEL[(detail.membershipStatus ?? 'aktif') as Membership]],
                  ['Nomor kontak', detail.phone || '—'],
                  [
                    'Jenis kelamin',
                    detail.gender === 'L' ? 'Laki-laki (L)' : detail.gender === 'P' ? 'Perempuan (P)' : '—',
                  ],
                  ['NIK KTP', detail.nik || '—'],
                  ['Nama orang tua/wali', detail.parentName || '—'],
                  ['Kontak orang tua/wali', detail.parentPhone || '—'],
                  ['Bergabung', formatDateID(detail.joinedAt.slice(0, 10))],
                ] as Array<[string, string]>
              ).map(([k, v]) => (
                <div key={k} className="rounded-control border border-line bg-bg/50 p-3">
                  <dt className="text-[12px] text-muted">{k}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-control border border-line p-3">
              <p className="text-[12px] text-muted">Alamat lengkap</p>
              <p className="mt-1 text-sm text-ink">{detail.address || '—'}</p>
            </div>

            <div className="rounded-control border border-line p-3">
              <p className="text-[12px] text-muted">Riwayat penyakit</p>
              <p className="mt-1 text-sm text-ink">{detail.medicalHistory || '—'}</p>
            </div>

            {detail.role !== 'anggota' && (
              <Alert tone="info">
                Data identitas (NIK, alamat, riwayat penyakit, dan data orang tua) hanya terisi untuk akun anggota yang
                berasal dari pendaftaran.
              </Alert>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus akun pengguna"
        description={
          deleteTarget
            ? `Akun ${deleteTarget.name} (${deleteTarget.email}) akan dihapus permanen beserta data absensinya. Tindakan ini tidak dapat dibatalkan.`
            : ''
        }
        confirmLabel="Hapus akun"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  )
}
