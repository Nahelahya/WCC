import { useMemo, useState } from 'react'
import { coachApi, sessionApi } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { useAsync, errorMessage } from '@/lib/hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { CoachCard } from '@/components/cards/CoachCard'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import type { Coach } from '@/types'

interface FormState {
  id?: string
  name: string
  expertise: string
  experience: string
  years: string
  bio: string
}

const EMPTY: FormState = { name: '', expertise: '', experience: '', years: '1', bio: '' }

export function CoachAdminPage() {
  const { toast } = useToast()
  const coaches = useAsync(() => coachApi.list(), [])
  const sessions = useAsync(() => sessionApi.list(), [])

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Coach | null>(null)
  const [deleting, setDeleting] = useState(false)

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    ;(sessions.data ?? []).forEach((s) => {
      map[s.coachId] = (map[s.coachId] ?? 0) + 1
    })
    return map
  }, [sessions.data])

  function openCreate() {
    setForm(EMPTY)
    setErrors({})
    setFormOpen(true)
  }

  function openEdit(c: Coach) {
    setForm({
      id: c.id,
      name: c.name,
      expertise: c.expertise.join(', '),
      experience: c.experience,
      years: String(c.years),
      bio: c.bio ?? '',
    })
    setErrors({})
    setFormOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const errs: typeof errors = {}
    const expertise = form.expertise
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!form.name.trim()) errs.name = 'Nama coach wajib diisi.'
    if (expertise.length === 0) errs.expertise = 'Minimal satu keahlian wajib diisi.'
    if (!form.years || Number(form.years) < 0) errs.years = 'Lama pengalaman tidak valid.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      await coachApi.save({
        id: form.id,
        name: form.name,
        expertise,
        experience: form.experience,
        years: Number(form.years),
        bio: form.bio,
      })
      toast(form.id ? 'Data coach berhasil diperbarui.' : 'Coach baru berhasil ditambahkan.', 'success')
      setFormOpen(false)
      coaches.reload()
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
      await coachApi.remove(deleteTarget.id)
      toast('Data coach berhasil dihapus.', 'success')
      setDeleteTarget(null)
      coaches.reload()
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
        title="Data Coach"
        description="Kelola profil coach beserta keahlian dan pengalaman."
        action={<Button icon="plus" onClick={openCreate}>Tambah Coach</Button>}
      />

      {coaches.loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} lines={2} />
          ))}
        </div>
      ) : coaches.error ? (
        <div className="card">
          <ErrorState message={coaches.error} onRetry={coaches.reload} />
        </div>
      ) : (coaches.data ?? []).length === 0 ? (
        <div className="card">
          <EmptyState
            icon="users"
            title="Belum ada data coach"
            description="Tambahkan coach agar dapat ditugaskan pada jadwal latihan."
            action={<Button icon="plus" onClick={openCreate}>Tambah Coach</Button>}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(coaches.data ?? []).map((c) => (
            <CoachCard
              key={c.id}
              coach={c}
              sessionsCount={counts[c.id] ?? 0}
              action={
                <>
                  <Button variant="secondary" size="sm" icon="edit" onClick={() => openEdit(c)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" icon="trash" onClick={() => setDeleteTarget(c)}>
                    Hapus
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? 'Ubah Data Coach' : 'Tambah Coach'}
        description="Isi profil coach. Bidang yang kosong tidak ditampilkan pada halaman publik."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button form="coach-form" type="submit" loading={saving}>
              {form.id ? 'Simpan Perubahan' : 'Simpan'}
            </Button>
          </>
        }
      >
        <form id="coach-form" onSubmit={submit} className="space-y-4" noValidate>
          <Input
            label="Nama coach"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
            required
          />
          <Input
            label="Keahlian"
            value={form.expertise}
            onChange={(e) => setForm({ ...form, expertise: e.target.value })}
            error={errors.expertise}
            helper="Pisahkan dengan koma. Contoh: Lead Climbing, Keselamatan & Rigging"
            required
          />
          <Input
            label="Lama pengalaman (tahun)"
            type="number"
            min={0}
            value={form.years}
            onChange={(e) => setForm({ ...form, years: e.target.value })}
            error={errors.years}
            required
          />
          <Textarea
            label="Pengalaman"
            value={form.experience}
            onChange={(e) => setForm({ ...form, experience: e.target.value })}
            placeholder="Ringkasan pengalaman melatih (opsional)."
          />
          <Textarea
            label="Catatan singkat"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Fokus pembinaan atau spesialisasi (opsional)."
          />
          <div className="flex items-start gap-2.5 rounded-control border border-line bg-bg/60 p-3">
            <Icon name="info" size={17} className="mt-0.5 flex-none text-info" />
            <p className="text-[12.5px] text-muted">
              Unggah foto coach belum diaktifkan pada prototype ini karena penyimpanan berkas belum tersedia.
              Bidang foto akan ditambahkan setelah API penyimpanan gambar siap.
            </p>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus data coach?"
        description={`Data coach "${deleteTarget?.name ?? ''}" akan dihapus. Sesi yang masih menunjuk coach ini perlu ditugaskan ulang.`}
        confirmLabel="Hapus Coach"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  )
}
