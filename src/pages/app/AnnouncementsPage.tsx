import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { announcementApi, uploadApi } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsync, errorMessage } from '@/lib/hooks'
import { BackLink } from '@/components/layout/AppShell'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { AnnouncementCard } from '@/components/cards/AnnouncementCard'
import { EmptyState, ErrorState, ListSkeleton, PageLoading } from '@/components/ui/Feedback'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { StatusBadge, PRIORITY_TONE } from '@/components/ui/StatusBadge'
import { formatDateID, formatDateTimeID, localDateOf } from '@/lib/date'
import type { Announcement, AnnouncementPriority } from '@/types'

const PRIORITY_OPTIONS: Array<{ value: AnnouncementPriority; label: string }> = [
  { value: 'tinggi', label: 'Tinggi — perlu perhatian segera' },
  { value: 'normal', label: 'Normal — informasi umum' },
  { value: 'rendah', label: 'Rendah — informasi tambahan' },
]

interface FormState {
  id?: string
  title: string
  summary: string
  body: string
  priority: AnnouncementPriority
  published: boolean
  imageUrl: string
}

const EMPTY: FormState = { title: '', summary: '', body: '', priority: 'normal', published: true, imageUrl: '' }

export function AnnouncementsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user!.role === 'pengurus'

  const list = useAsync(() => announcementApi.list(isAdmin), [isAdmin])
  const [priority, setPriority] = useState('')
  const [query, setQuery] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const [deleting, setDeleting] = useState(false)

  const rows = useMemo(() => {
    let data = list.data ?? []
    if (priority) data = data.filter((a) => a.priority === priority)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      data = data.filter((a) => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q))
    }
    return data
  }, [list.data, priority, query])

  const drafts = (list.data ?? []).filter((a) => !a.published).length

  function openCreate() {
    setForm(EMPTY)
    setErrors({})
    setFormOpen(true)
  }

  function openEdit(a: Announcement) {
    setForm({
      id: a.id,
      title: a.title,
      summary: a.summary,
      body: a.body,
      priority: a.priority,
      published: a.published,
      imageUrl: a.imageUrl ?? '',
    })
    setErrors({})
    setFormOpen(true)
  }

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingImage(true)
    try {
      const res = await uploadApi.upload(file)
      setForm((f) => ({ ...f, imageUrl: res.url }))
      toast('Gambar pengumuman berhasil diunggah.', 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setUploadingImage(false)
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (saving) return
    const e: typeof errors = {}
    if (!form.title.trim()) e.title = 'Judul pengumuman wajib diisi.'
    if (!form.body.trim()) e.body = 'Isi pengumuman wajib diisi.'
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    try {
      await announcementApi.save({
        ...form,
        author: form.id ? undefined : user!.name,
      })
      toast(form.id ? 'Perubahan pengumuman berhasil disimpan.' : 'Pengumuman berhasil dibuat.', 'success')
      setFormOpen(false)
      list.reload()
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
      await announcementApi.remove(deleteTarget.id)
      toast('Pengumuman berhasil dihapus.', 'success')
      setDeleteTarget(null)
      list.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Pengumuman"
        description={
          isAdmin
            ? 'Kelola pengumuman resmi klub dan tingkat prioritasnya.'
            : 'Informasi dan pengumuman resmi dari pengurus klub.'
        }
        action={isAdmin ? <Button icon="plus" onClick={openCreate}>Buat Pengumuman</Button> : undefined}
      />

      {isAdmin && drafts > 0 && (
        <p className="mb-4 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-[13px] text-ink">
          <span className="font-semibold">{drafts} draf</span> belum dipublikasikan ke anggota.
        </p>
      )}

      <div className="card mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-[42px] text-muted">
              <Icon name="search" size={17} />
            </span>
            <Input
              label="Cari pengumuman"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul atau ringkasan…"
              className="pl-10"
            />
          </div>
          <Select label="Prioritas" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Semua prioritas</option>
            <option value="tinggi">Tinggi</option>
            <option value="normal">Normal</option>
            <option value="rendah">Rendah</option>
          </Select>
        </div>
      </div>

      {list.loading ? (
        <ListSkeleton rows={4} />
      ) : list.error ? (
        <div className="card">
          <ErrorState message={list.error} onRetry={list.reload} />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="megaphone"
            title="Belum ada pengumuman"
            description={priority || query ? 'Ubah filter pencarian Anda.' : 'Pengumuman baru akan tampil di sini.'}
            action={isAdmin ? <Button icon="plus" onClick={openCreate}>Buat Pengumuman</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((a) => (
            <div key={a.id} className="flex flex-col gap-2">
              <AnnouncementCard announcement={a} to={`/app/pengumuman/${a.id}`} showDraft={isAdmin} />
              {isAdmin && (
                <div className="flex gap-2 px-1">
                  <Button variant="secondary" size="sm" icon="edit" onClick={() => openEdit(a)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" icon="trash" onClick={() => setDeleteTarget(a)}>
                    Hapus
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <>
          <Modal
            open={formOpen}
            onClose={() => setFormOpen(false)}
            title={form.id ? 'Ubah Pengumuman' : 'Buat Pengumuman'}
            description="Pengumuman dipublikasikan ke seluruh anggota sesuai prioritasnya."
            size="lg"
            footer={
              <>
                <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
                  Batal
                </Button>
                <Button form="announcement-form" type="submit" loading={saving}>
                  {form.published ? 'Publikasikan' : 'Simpan sebagai Draf'}
                </Button>
              </>
            }
          >
            <form id="announcement-form" onSubmit={submit} className="space-y-4" noValidate>
              <Input
                label="Judul"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                error={errors.title}
                placeholder="Judul pengumuman"
                required
              />
              <Textarea
                label="Ringkasan (opsional)"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="Ditampilkan pada daftar pengumuman. Dikosongkan = dipotong otomatis dari isi."
              />
              <Textarea
                label="Isi pengumuman"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                error={errors.body}
                className="min-h-[180px]"
                required
              />
              <div>
                <span className="field-label">Gambar pengumuman (opsional)</span>
                <label className="flex cursor-pointer items-center gap-3 rounded-control border border-dashed border-line bg-bg/50 px-3 py-3 text-sm text-muted hover:border-primary/40">
                  <Icon name="image" size={19} />
                  <span className="min-w-0 flex-1 truncate">
                    {uploadingImage
                      ? 'Mengunggah…'
                      : form.imageUrl
                        ? 'Gambar siap dipakai'
                        : 'Pilih gambar (PNG/JPG/WebP)…'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingImage}
                    onChange={(e) => void onImageChange(e)}
                  />
                  <span className="flex-none rounded-control border border-line bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-ink">
                    {uploadingImage ? 'Tunggu' : form.imageUrl ? 'Ganti' : 'Pilih'}
                  </span>
                </label>
                {form.imageUrl && (
                  <div className="mt-2">
                    <img
                      src={form.imageUrl}
                      alt="Pratinjau gambar pengumuman"
                      className="max-h-52 w-full rounded-control border border-line object-cover"
                    />
                    <button
                      type="button"
                      className="mt-2 text-[12.5px] text-muted hover:text-danger"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                    >
                      Hapus gambar
                    </button>
                  </div>
                )}
                <p className="field-helper">
                  Gambar akan tampil pada kartu dan halaman pengumuman.
                </p>
              </div>
              <Select
                label="Prioritas"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as AnnouncementPriority })}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <label className="flex items-start gap-2.5 rounded-control border border-line p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 accent-primary"
                  checked={form.published}
                  onChange={(e) => setForm({ ...form, published: e.target.checked })}
                />
                <span>
                  Publikasikan sekarang
                  <span className="mt-0.5 block text-[12.5px] text-muted">
                    Jika tidak dicentang, pengumuman disimpan sebagai draf dan hanya terlihat pengurus.
                  </span>
                </span>
              </label>
            </form>
          </Modal>

          <ConfirmDialog
            open={Boolean(deleteTarget)}
            title="Hapus pengumuman ini?"
            description={`Pengumuman "${deleteTarget?.title ?? ''}" akan dihapus permanen dan tidak dapat dibatalkan.`}
            confirmLabel="Hapus Pengumuman"
            loading={deleting}
            onConfirm={confirmDelete}
            onClose={() => setDeleteTarget(null)}
          />
        </>
      )}
    </>
  )
}

export function AnnouncementDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const item = useAsync(() => announcementApi.get(id), [id])

  if (item.loading) return <PageLoading />
  if (item.error)
    return (
      <div className="card">
        <ErrorState message={item.error} onRetry={item.reload} />
      </div>
    )

  const a = item.data
  if (!a)
    return (
      <div className="card">
        <EmptyState
          icon="megaphone"
          title="Pengumuman tidak ditemukan"
          action={
            <Link to="/app/pengumuman" className={buttonClasses('primary')}>
              Kembali
            </Link>
          }
        />
      </div>
    )

  if (!a.published && user!.role !== 'pengurus') {
    return (
      <div className="card">
        <EmptyState
          icon="lock"
          title="Pengumuman belum dipublikasikan"
          description="Pengumuman ini masih berupa draf internal pengurus."
          action={
            <Link to="/app/pengumuman" className={buttonClasses('secondary')}>
              Kembali
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <article className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumb={<BackLink to="/app/pengumuman" label="Kembali ke Pengumuman" />}
        title={a.title}
        action={<Button variant="secondary" icon="chevron-left" onClick={() => navigate(-1)}>Sebelumnya</Button>}
      />

      <div className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
          <StatusBadge tone={PRIORITY_TONE[a.priority]} icon={a.priority === 'tinggi' ? 'alert' : 'info'}>
            Prioritas {a.priority}
          </StatusBadge>
          {!a.published && <StatusBadge tone="neutral">Draf</StatusBadge>}
          <span className="text-[13px] text-muted">{formatDateTimeID(a.publishedAt)}</span>
          <span className="ml-auto flex items-center gap-1.5 text-[13px] text-muted">
            <Icon name="user" size={15} />
            {a.author}
          </span>
        </div>

        <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink/90">
          {a.imageUrl && (
            <img
              src={a.imageUrl}
              alt=""
              className="w-full rounded-card border border-line object-cover"
            />
          )}
          {a.body.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <p className="mt-6 border-t border-line pt-4 text-[12.5px] text-muted">
          Diterbitkan {formatDateID(localDateOf(a.publishedAt))} · Pengumuman resmi WISANGGENI CLIMBING CLUB
        </p>
      </div>
    </article>
  )
}
