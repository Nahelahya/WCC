import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { coachApi, sessionApi, type SessionInput } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsync, errorMessage } from '@/lib/hooks'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { ScheduleCard } from '@/components/cards/ScheduleCard'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { StatusBadge, SESSION_TONE, SESSION_LABEL, SESSION_ICON } from '@/components/ui/StatusBadge'
import { formatDateID, todayISO } from '@/lib/date'
import { sessionStatus } from '@/lib/session'
import type { Session } from '@/types'

const EMPTY_FORM: SessionInput = {
  title: '',
  date: todayISO(),
  startTime: '19:00',
  endTime: '21:00',
  location: '',
  coachId: '',
  note: '',
}

export function SchedulePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user!.role === 'pengurus'
  const isCoach = user!.role === 'coach'

  const sessions = useAsync(() => sessionApi.list(), [])
  const coaches = useAsync(() => coachApi.list(), [])

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [scope, setScope] = useState<'mendatang' | 'semua' | 'lampau'>('mendatang')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Session | null>(null)
  const [form, setForm] = useState<SessionInput>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof SessionInput, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)

  const today = todayISO()

  const filtered = useMemo(() => {
    let rows = [...(sessions.data ?? [])]
    if (isCoach && user!.coachId) rows = rows.filter((s) => s.coachId === user!.coachId)
    if (scope === 'mendatang') rows = rows.filter((s) => s.date >= today && !s.cancelled)
    if (scope === 'lampau') rows = rows.filter((s) => s.date < today)
    if (from) rows = rows.filter((s) => s.date >= from)
    if (to) rows = rows.filter((s) => s.date <= to)
    if (statusFilter) rows = rows.filter((s) => sessionStatus(s) === statusFilter)
    if (scope === 'mendatang') rows.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))
    else rows.sort((a, b) => (a.date === b.date ? b.startTime.localeCompare(a.startTime) : b.date.localeCompare(a.date)))
    return rows
  }, [sessions.data, from, to, statusFilter, scope, isCoach, user, today])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, coachId: coaches.data?.[0]?.id ?? '' })
    setFormErrors({})
    setFormOpen(true)
  }

  function openEdit(s: Session) {
    setEditing(s)
    setForm({
      title: s.title,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location,
      coachId: s.coachId,
      note: s.note ?? '',
    })
    setFormErrors({})
    setFormOpen(true)
  }

  function validate() {
    const e: typeof formErrors = {}
    if (!form.title.trim()) e.title = 'Nama/jenis latihan wajib diisi.'
    if (!form.date) e.date = 'Tanggal wajib diisi.'
    if (!form.location.trim()) e.location = 'Lokasi wajib diisi.'
    if (!form.coachId) e.coachId = 'Coach penanggung jawab wajib dipilih.'
    if (form.endTime <= form.startTime) e.endTime = 'Waktu selesai harus setelah waktu mulai.'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  async function submitForm(ev: React.FormEvent) {
    ev.preventDefault()
    if (saving || !validate()) return
    setSaving(true)
    try {
      if (editing) {
        await sessionApi.update(editing.id, form)
        toast('Perubahan jadwal berhasil disimpan.', 'success')
      } else {
        await sessionApi.create(form)
        toast('Jadwal latihan baru berhasil ditambahkan.', 'success')
      }
      setFormOpen(false)
      sessions.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await sessionApi.remove(deleteTarget.id)
      toast('Jadwal berhasil dihapus.', 'success')
      setDeleteTarget(null)
      sessions.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHeader
        title={isCoach ? 'Jadwal yang Diampu' : 'Jadwal Latihan'}
        description={
          isAdmin
            ? 'Buat, ubah, dan hapus jadwal latihan klub.'
            : isCoach
              ? 'Sesi latihan yang menjadi tanggung jawab Anda.'
              : 'Jadwal latihan mendatang beserta status sesi.'
        }
        action={isAdmin || isCoach ? <Button icon="calendar-plus" onClick={openCreate}>Tambah Jadwal</Button> : undefined}
      />

      {/* Filter */}
      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex rounded-control border border-line p-0.5" role="group" aria-label="Rentang waktu">
            {([
              ['mendatang', 'Mendatang'],
              ['semua', 'Semua'],
              ['lampau', 'Lampau'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                aria-pressed={scope === value}
                className={`min-h-[38px] rounded-[7px] px-3.5 text-[13px] font-semibold transition-colors ${
                  scope === value ? 'bg-brand text-white' : 'text-muted hover:bg-bg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:min-w-[260px] sm:flex-1 sm:max-w-md">
            <Input
              label="Dari tanggal"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input label="Sampai tanggal" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="w-full sm:w-48">
            <Select label="Status sesi" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Semua status</option>
              <option value="akan-datang">Akan datang</option>
              <option value="berlangsung">Sedang berlangsung</option>
              <option value="selesai">Selesai</option>
              <option value="dibatalkan">Dibatalkan</option>
            </Select>
          </div>

          {(from || to || statusFilter || scope !== 'mendatang') && (
            <Button
              variant="ghost"
              icon="x"
              onClick={() => {
                setFrom('')
                setTo('')
                setStatusFilter('')
                setScope('mendatang')
              }}
            >
              Reset filter
            </Button>
          )}
        </div>
      </div>

      {sessions.loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : sessions.error ? (
        <div className="card">
          <ErrorState message={sessions.error} onRetry={sessions.reload} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="calendar"
            title="Belum ada jadwal latihan mendatang."
            description="Ubah filter atau tambahkan jadwal baru."
            action={isAdmin || isCoach ? <Button icon="plus" onClick={openCreate}>Tambah Jadwal</Button> : undefined}
          />
        </div>
      ) : (
        <>
          <SectionHeader
            title={`${filtered.length} sesi`}
            description={scope === 'mendatang' ? 'Diurutkan dari jadwal terdekat.' : 'Diurutkan dari yang terbaru.'}
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <ScheduleCard
                key={s.id}
                session={s}
                coach={coaches.data?.find((c) => c.id === s.coachId) ?? null}
                to={`/app/jadwal/${s.id}`}
                action={
                  isAdmin || isCoach ? (
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" icon="edit" onClick={() => openEdit(s)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" icon="trash" onClick={() => setDeleteTarget(s)}>
                        Hapus
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            ))}
          </div>
        </>
      )}

      {(isAdmin || isCoach) && (
        <>
          <Modal
            open={formOpen}
            onClose={() => setFormOpen(false)}
            title={editing ? 'Ubah Jadwal Latihan' : 'Tambah Jadwal Latihan'}
            description="Isi informasi sesi. Waktu menggunakan format 24 jam."
            footer={
              <>
                <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
                  Batal
                </Button>
                <Button form="session-form" type="submit" loading={saving}>
                  {editing ? 'Simpan Perubahan' : 'Simpan Jadwal'}
                </Button>
              </>
            }
          >
            <form id="session-form" onSubmit={submitForm} className="space-y-4" noValidate>
              <Input
                label="Nama / jenis latihan"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                error={formErrors.title}
                placeholder="Misalnya: Latihan Rutin — Lead"
                required
              />
              <Input
                label="Tanggal"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                error={formErrors.date}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Waktu mulai"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  required
                />
                <Input
                  label="Waktu selesai"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  error={formErrors.endTime}
                  required
                />
              </div>
              <Input
                label="Lokasi"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                error={formErrors.location}
                placeholder="Misalnya: Dinding Panjat FPTI, GOR Utama"
                required
              />
              <Select
                label="Coach penanggung jawab"
                value={form.coachId}
                onChange={(e) => setForm({ ...form, coachId: e.target.value })}
                error={formErrors.coachId}
                required
              >
                <option value="">Pilih coach</option>
                {(coaches.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Textarea
                label="Informasi tambahan (opsional)"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Catatan untuk anggota, misalnya barang bawaan."
              />
              {editing && (
                <label className="flex items-start gap-2.5 rounded-control border border-line p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 accent-primary"
                    checked={Boolean(editing.cancelled)}
                    onChange={(e) => setEditing({ ...editing, cancelled: e.target.checked })}
                  />
                  <span>
                    Tandai sesi sebagai <span className="font-semibold">dibatalkan</span> (anggota tidak dapat
                    melakukan check-in).
                    <button
                      type="button"
                      className="link ml-1 text-[13px]"
                      onClick={async (e) => {
                        e.preventDefault()
                        const next = !editing.cancelled
                        setEditing({ ...editing, cancelled: next })
                        await sessionApi.update(editing.id, { cancelled: next })
                        sessions.reload()
                        toast(next ? 'Sesi ditandai dibatalkan.' : 'Sesi diaktifkan kembali.', 'info')
                      }}
                    >
                      Terapkan status sekarang
                    </button>
                  </span>
                </label>
              )}
            </form>
          </Modal>

          <ConfirmDialog
            open={Boolean(deleteTarget)}
            title="Hapus jadwal ini?"
            description={`Jadwal "${deleteTarget?.title ?? ''}" pada ${
              deleteTarget ? formatDateID(deleteTarget.date) : ''
            } akan dihapus beserta data absensinya. Tindakan ini tidak dapat dibatalkan.`}
            confirmLabel="Hapus Jadwal"
            loading={deleting}
            onConfirm={confirmDelete}
            onClose={() => setDeleteTarget(null)}
          />
        </>
      )}

      {!isAdmin && filtered.length > 0 && (
        <p className="mt-5 text-[12.5px] text-muted">
          Menampilkan {filtered.length} sesi. Klik kartu untuk melihat detail
          {isCoach ? ' dan daftar hadir.' : ' dan melakukan check-in.'}
        </p>
      )}

      <div className="card mt-6 flex items-start gap-3 p-4">
        <Icon name="info" size={18} className="mt-0.5 flex-none text-info" />
        <p className="text-[13px] text-muted">
          Check-in hanya dapat dilakukan selama sesi berlangsung (dibuka 30 menit sebelum waktu mulai dan
          ditutup saat sesi berakhir). Status kehadiran selalu berasal dari data tersimpan, bukan dari
          tampilan tombol.
        </p>
      </div>
    </>
  )
}
