import { useEffect, useMemo, useState } from 'react'
import { landingApi, uploadApi } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage, useAsync } from '@/lib/hooks'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import { Alert, EmptyState, ListSkeleton } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import type {
  LandingActivityItem,
  LandingContent,
} from '@/types.landing'
import { getLandingDefaults } from '@/lib/landing-defaults'
import { ACTIVITY_CROP_DEFAULT, activityCropStyle } from '@/lib/imageCrop'

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function CropSlider({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  display: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2 text-[11.5px] text-muted">
        <span>{label}</span>
        <span className="font-medium text-ink">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-primary"
      />
    </label>
  )
}

export function LandingSettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const canEdit = user?.role === 'pengurus'

  const fetcher = useAsync(() => landingApi.get(), [])
  const [draft, setDraft] = useState<LandingContent | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  useEffect(() => {
    if (fetcher.data && !draft) {
      setDraft(JSON.parse(JSON.stringify(fetcher.data)) as LandingContent)
    }
  }, [fetcher.data, draft])

  const defaults = useMemo(() => getLandingDefaults(), [])

  function update(path: (d: LandingContent) => void) {
    if (!draft) return
    const next = JSON.parse(JSON.stringify(draft)) as LandingContent
    path(next)
    setDraft(next)
  }

  async function uploadImage(file: File, apply: (url: string) => void) {
    if (!canEdit) return
    if (!file.type.startsWith('image/')) {
      toast('Format gambar tidak valid (JPG, PNG, WebP, GIF).', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Ukuran gambar maksimal 5 MB.', 'error')
      return
    }
    const key = `${Date.now()}-${file.name}`
    setUploadingKey(key)
    try {
      const { url } = await uploadApi.upload(file)
      apply(url)
      toast('Gambar berhasil diunggah.', 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setUploadingKey(null)
    }
  }

  async function handleSave() {
    if (!draft || !canEdit) return
    setSaving(true)
    try {
      const saved = await landingApi.update(draft)
      setDraft(JSON.parse(JSON.stringify(saved)) as LandingContent)
      toast('Konten landing page berhasil disimpan.', 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleResetToDefault() {
    setDraft(JSON.parse(JSON.stringify(defaults)) as LandingContent)
    setResetOpen(false)
    toast('Konten dikembalikan ke default. Simpan untuk menerapkan.', 'info')
  }

  function addActivity() {
    update((d) => {
      d.activities.items.push({
        id: uid(),
        title: 'Kegiatan Baru',
        description: 'Deskripsi singkat kegiatan klub...',
        imageUrl: '',
      })
    })
  }

  function removeActivity(id: string) {
    update((d) => {
      d.activities.items = d.activities.items.filter((x) => x.id !== id)
    })
  }

  /** Ubah pengaturan crop/zoom satu foto kegiatan (fokus X, fokus Y, zoom). */
  function setActivityCrop(
    id: string,
    patch: Partial<Pick<LandingActivityItem, 'focusX' | 'focusY' | 'zoom'>>,
  ) {
    update((d) => {
      const item = d.activities.items.find((x) => x.id === id)
      if (item) Object.assign(item, patch)
    })
  }

  function moveActivity(id: string, dir: -1 | 1) {
    update((d) => {
      const items = d.activities.items
      const i = items.findIndex((x) => x.id === id)
      if (i < 0) return
      const j = i + dir
      if (j < 0 || j >= items.length) return
      const [t] = items.splice(i, 1)
      items.splice(j, 0, t)
    })
  }

  if (fetcher.loading && !draft) return <ListSkeleton rows={6} />
  if (fetcher.error)
    return (
      <Alert tone="error" title="Gagal memuat pengaturan landing page">
        {errorMessage(fetcher.error)}
      </Alert>
    )
  if (!draft)
    return <EmptyState title="Konten landing belum tersedia" description="Tekan Muat Ulang untuk mencoba kembali." />
  if (!canEdit)
    return <Alert tone="warning" title="Akses terbatas">Hanya pengurus yang dapat mengedit konten landing page.</Alert>

  const data = fetcher.data as LandingContent | null

  return (
    <>
      <PageHeader
        title="Pengaturan Landing Page"
        description="Kelola konten beranda dari Hero section hingga Footer, termasuk foto kegiatan klub. Perubahan tampil di halaman publik setelah disimpan."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="refresh" onClick={() => { setDraft(null); fetcher.reload() }} loading={fetcher.loading}>
              Muat Ulang
            </Button>
            <Button variant="ghost" icon="undo" onClick={() => setResetOpen(true)} disabled={saving}>
              Kembalikan ke Default
            </Button>
            <Button icon="save" onClick={() => void handleSave()} loading={saving} disabled={uploadingKey !== null}>
              Simpan Perubahan
            </Button>
          </div>
        }
      />

      {data?.updatedAt && (
        <Alert tone="info" className="mb-6" title="Terakhir diperbarui">
          {new Date(data.updatedAt).toLocaleString('id-ID')}
          {data.updatedByName ? ` • oleh ${data.updatedByName}` : ''}
        </Alert>
      )}

      {/* HERO */}
      <section className="mb-8">
        <SectionHeader title="1. Hero Section" description="Judul utama, subjudul, tombol CTA, dan gambar hero." />
        <div className="card space-y-4 p-4 sm:p-5">
          <Input label="Judul Hero" value={draft.hero.title} onChange={(e) => update((d) => (d.hero.title = e.target.value))} required />
          <Textarea label="Subjudul Hero" rows={3} value={draft.hero.subtitle} onChange={(e) => update((d) => (d.hero.subtitle = e.target.value))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Label CTA Utama" value={draft.hero.ctaPrimaryLabel} onChange={(e) => update((d) => (d.hero.ctaPrimaryLabel = e.target.value))} />
            <Input label="Link CTA Utama" value={draft.hero.ctaPrimaryHref} onChange={(e) => update((d) => (d.hero.ctaPrimaryHref = e.target.value))} placeholder="/daftar" />
            <Input label="Label CTA Sekunder" value={draft.hero.ctaSecondaryLabel} onChange={(e) => update((d) => (d.hero.ctaSecondaryLabel = e.target.value))} />
            <Input label="Link CTA Sekunder" value={draft.hero.ctaSecondaryHref} onChange={(e) => update((d) => (d.hero.ctaSecondaryHref = e.target.value))} placeholder="/#jadwal" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Gambar Hero (opsional)</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {draft.hero.imageUrl ? (
                <img src={draft.hero.imageUrl} alt="Hero" className="h-28 w-auto max-w-xs rounded-card border border-line object-cover" />
              ) : (
                <div className="flex h-28 w-40 items-center justify-center rounded-card border border-dashed border-line text-xs text-muted">
                  Belum ada gambar
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-bg disabled:opacity-60">
                  <Icon name="upload" size={16} />
                  {uploadingKey ? 'Mengunggah…' : 'Unggah Gambar'}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingKey !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) void uploadImage(f, (url) => update((d) => (d.hero.imageUrl = url)))
                    }}
                  />
                </label>
                {draft.hero.imageUrl && (
                  <Button variant="ghost" size="sm" onClick={() => update((d) => (d.hero.imageUrl = ''))} disabled={uploadingKey !== null}>
                    Hapus Gambar
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted">Maks. 5 MB. JPG/PNG/WebP/GIF.</p>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="mb-8">
        <SectionHeader title="2. Tentang Kami" description="Badge, judul, deskripsi dan statistik." />
        <div className="card space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Badge" value={draft.about.badge} onChange={(e) => update((d) => (d.about.badge = e.target.value))} />
            <Input label="Judul" value={draft.about.title} onChange={(e) => update((d) => (d.about.title = e.target.value))} />
          </div>
          <Textarea label="Deskripsi" rows={4} value={draft.about.description} onChange={(e) => update((d) => (d.about.description = e.target.value))} />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Statistik</p>
              <Button size="sm" variant="secondary" icon="plus" onClick={() => update((d) => d.about.stats.push({ label: 'Label', value: '0' }))}>
                Tambah Statistik
              </Button>
            </div>
            {draft.about.stats.map((s, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr,120px,auto] sm:items-center">
                <Input label={`Statistik ${i + 1} — Label`} value={s.label} onChange={(e) => update((d) => (d.about.stats[i].label = e.target.value))} />
                <Input label={`Statistik ${i + 1} — Nilai`} value={s.value} onChange={(e) => update((d) => (d.about.stats[i].value = e.target.value))} />
                <Button variant="ghost" size="sm" icon="trash" className="text-danger" onClick={() => update((d) => d.about.stats.splice(i, 1))} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCHEDULE */}
      <section className="mb-8">
        <SectionHeader title="3. Jadwal Latihan" description="Item jadwal rutin yang tampil di beranda." />
        <div className="card space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Badge" value={draft.schedule.badge} onChange={(e) => update((d) => (d.schedule.badge = e.target.value))} />
            <Input label="Judul" value={draft.schedule.title} onChange={(e) => update((d) => (d.schedule.title = e.target.value))} />
          </div>
          <Textarea label="Deskripsi" rows={2} value={draft.schedule.description} onChange={(e) => update((d) => (d.schedule.description = e.target.value))} />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Item Jadwal</p>
              <Button size="sm" variant="secondary" icon="plus" onClick={() => update((d) => d.schedule.items.push({ day: 'Hari', time: '00.00 – 00.00 WIB', activity: 'Aktivitas' }))}>
                Tambah Jadwal
              </Button>
            </div>
            {draft.schedule.items.map((it, i) => (
              <div key={i} className="space-y-2 rounded-card border border-line p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input label={`Item ${i + 1} — Hari`} value={it.day} onChange={(e) => update((d) => (d.schedule.items[i].day = e.target.value))} />
                  <Input label={`Item ${i + 1} — Waktu`} value={it.time} onChange={(e) => update((d) => (d.schedule.items[i].time = e.target.value))} />
                  <Input label={`Item ${i + 1} — Aktivitas`} value={it.activity} onChange={(e) => update((d) => (d.schedule.items[i].activity = e.target.value))} />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <Input label={`Item ${i + 1} — Catatan`} value={it.note ?? ''} onChange={(e) => update((d) => (d.schedule.items[i].note = e.target.value))} placeholder="Opsional" />
                  <Button variant="ghost" size="sm" icon="trash" className="text-danger" onClick={() => update((d) => d.schedule.items.splice(i, 1))} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COACHES */}
      <section className="mb-8">
        <SectionHeader title="4. Tim Coach" description="Daftar coach yang tampil di beranda (opsional)." />
        <div className="card space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Badge" value={draft.coaches.badge} onChange={(e) => update((d) => (d.coaches.badge = e.target.value))} />
            <Input label="Judul" value={draft.coaches.title} onChange={(e) => update((d) => (d.coaches.title = e.target.value))} />
          </div>
          <Textarea label="Deskripsi" rows={2} value={draft.coaches.description} onChange={(e) => update((d) => (d.coaches.description = e.target.value))} />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Daftar Coach</p>
              <Button size="sm" variant="secondary" icon="plus" onClick={() => update((d) => d.coaches.items.push({ name: 'Nama Coach', expertise: ['Lead Climbing'], experience: '5 tahun' }))}>
                Tambah Coach
              </Button>
            </div>
            {draft.coaches.items.map((c, i) => (
              <div key={i} className="space-y-3 rounded-card border border-line p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input label="Nama Lengkap" value={c.name} onChange={(e) => update((d) => (d.coaches.items[i].name = e.target.value))} />
                  <Input label="Pengalaman" value={c.experience} onChange={(e) => update((d) => (d.coaches.items[i].experience = e.target.value))} />
                </div>
                <Input label="Keahlian (pisah koma)" value={c.expertise.join(', ')} onChange={(e) => update((d) => (d.coaches.items[i].expertise = e.target.value.split(',').map((x) => x.trim()).filter(Boolean)))} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-line" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg text-xs text-muted ring-2 ring-line">Foto</div>
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-bg">
                      <Icon name="upload" size={14} />
                      Unggah Foto
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadImage(f, (url) => update((d) => (d.coaches.items[i].photoUrl = url))) }} />
                    </label>
                    {c.photoUrl && (
                      <Button variant="ghost" size="sm" onClick={() => update((d) => (d.coaches.items[i].photoUrl = ''))}>Hapus</Button>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" icon="trash" className="text-danger" onClick={() => update((d) => d.coaches.items.splice(i, 1))}>
                    Hapus Coach
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="mb-8">
        <SectionHeader title="5. Cara Bergabung" description="Langkah-langkah menjadi anggota." />
        <div className="card space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Badge" value={draft.steps.badge} onChange={(e) => update((d) => (d.steps.badge = e.target.value))} />
            <Input label="Judul" value={draft.steps.title} onChange={(e) => update((d) => (d.steps.title = e.target.value))} />
          </div>
          <Textarea label="Deskripsi (opsional)" rows={2} value={draft.steps.description ?? ''} onChange={(e) => update((d) => (d.steps.description = e.target.value))} />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Langkah-langkah</p>
              <Button size="sm" variant="secondary" icon="plus" onClick={() => update((d) => d.steps.items.push({ title: 'Langkah Baru', desc: 'Penjelasan singkat...' }))}>
                Tambah Langkah
              </Button>
            </div>
            {draft.steps.items.map((s, i) => (
              <div key={i} className="space-y-2 rounded-card border border-line p-3">
                <Input label={`Langkah ${i + 1} — Judul`} value={s.title} onChange={(e) => update((d) => (d.steps.items[i].title = e.target.value))} />
                <Textarea label={`Langkah ${i + 1} — Deskripsi`} rows={2} value={s.desc} onChange={(e) => update((d) => (d.steps.items[i].desc = e.target.value))} />
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" icon="trash" className="text-danger" onClick={() => update((d) => d.steps.items.splice(i, 1))}>
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACTIVITIES (GALERI) */}
      <section className="mb-8">
        <SectionHeader title="6. Foto Kegiatan Klub (Galeri)" description="Upload foto kegiatan komunitas untuk ditampilkan di beranda." />
        <div className="card space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Badge" value={draft.activities.badge} onChange={(e) => update((d) => (d.activities.badge = e.target.value))} />
            <Input label="Judul" value={draft.activities.title} onChange={(e) => update((d) => (d.activities.title = e.target.value))} />
          </div>
          <Textarea label="Deskripsi" rows={2} value={draft.activities.description} onChange={(e) => update((d) => (d.activities.description = e.target.value))} />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">Daftar Foto Kegiatan</p>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-bg">
                  <Icon name="upload" size={16} />
                  Unggah Banyak Foto
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? [])
                      e.target.value = ''
                      for (const f of files) {
                        await uploadImage(f, (url) => {
                          update((d) => d.activities.items.push({ id: uid(), title: 'Kegiatan Klub', description: '', imageUrl: url }))
                        })
                      }
                    }}
                  />
                </label>
                <Button size="sm" variant="secondary" icon="plus" onClick={addActivity}>
                  Tambah Item Manual
                </Button>
              </div>
            </div>
            {draft.activities.items.length === 0 && (
              <EmptyState title="Belum ada foto kegiatan" description="Unggah foto atau tambah item manual untuk menampilkan galeri." />
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {draft.activities.items.map((item: LandingActivityItem) => (
                <div key={item.id} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-bg">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" style={activityCropStyle(item)} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">Belum ada gambar</div>
                    )}
                    <div className="absolute right-2 top-2 flex gap-1 rounded-card bg-surface/95 p-1 shadow-sm ring-1 ring-line/60">
                      <button type="button" className="flex h-7 w-7 items-center justify-center rounded-control hover:bg-bg" onClick={() => moveActivity(item.id, -1)} title="Pindah ke atas">
                        <Icon name="chevron-up" size={16} />
                      </button>
                      <button type="button" className="flex h-7 w-7 items-center justify-center rounded-control hover:bg-bg" onClick={() => moveActivity(item.id, 1)} title="Pindah ke bawah">
                        <Icon name="chevron-down" size={16} />
                      </button>
                      <button type="button" className="flex h-7 w-7 items-center justify-center rounded-control text-danger hover:bg-bg" onClick={() => removeActivity(item.id)} title="Hapus">
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 p-3">
                    <Input label="Judul" value={item.title} onChange={(e) => update((d) => { const it = d.activities.items.find((x) => x.id === item.id); if (it) it.title = e.target.value })} placeholder="Judul foto/kegiatan" />
                    <Textarea label="Deskripsi" rows={2} value={item.description} onChange={(e) => update((d) => { const it = d.activities.items.find((x) => x.id === item.id); if (it) it.description = e.target.value })} placeholder="Deskripsi singkat (opsional)" />
                    <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-bg">
                      <Icon name="upload" size={14} />
                      Ganti Gambar
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadImage(f, (url) => update((d) => { const it = d.activities.items.find((x) => x.id === item.id); if (it) it.imageUrl = url })) }} />
                    </label>
                    <details className="rounded-control border border-line bg-bg/50 px-2.5 py-2">
                      <summary className="cursor-pointer select-none text-xs font-medium text-ink">
                        Atur crop &amp; zoom
                      </summary>
                      <p className="mt-1 text-[11.5px] leading-snug text-muted">
                        Geser fokus dan perbesar foto agar bagian penting tidak terpotong di beranda.
                      </p>
                      <div className="mt-2 space-y-2">
                        <CropSlider
                          label="Geser kiri / kanan"
                          value={item.focusX ?? ACTIVITY_CROP_DEFAULT.focusX}
                          min={0}
                          max={100}
                          display={`${Math.round(item.focusX ?? ACTIVITY_CROP_DEFAULT.focusX)}%`}
                          onChange={(v) => setActivityCrop(item.id, { focusX: v })}
                        />
                        <CropSlider
                          label="Geser atas / bawah"
                          value={item.focusY ?? ACTIVITY_CROP_DEFAULT.focusY}
                          min={0}
                          max={100}
                          display={`${Math.round(item.focusY ?? ACTIVITY_CROP_DEFAULT.focusY)}%`}
                          onChange={(v) => setActivityCrop(item.id, { focusY: v })}
                        />
                        <CropSlider
                          label="Zoom"
                          value={item.zoom ?? ACTIVITY_CROP_DEFAULT.zoom}
                          min={1}
                          max={3}
                          step={0.05}
                          display={`${Math.round((item.zoom ?? ACTIVITY_CROP_DEFAULT.zoom) * 100)}%`}
                          onChange={(v) => setActivityCrop(item.id, { zoom: v })}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted">Pratinjau di atas memakai bingkai 16:9 (sama seperti beranda).</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="undo"
                            onClick={() => setActivityCrop(item.id, { ...ACTIVITY_CROP_DEFAULT })}
                          >
                            Reset
                          </Button>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <SectionHeader title="7. Call To Action (CTA)" description="Bagian ajakan bergabung di bawah halaman." />
        <div className="card space-y-4 p-4 sm:p-5">
          <Input label="Judul CTA" value={draft.cta.title} onChange={(e) => update((d) => (d.cta.title = e.target.value))} />
          <Textarea label="Deskripsi CTA" rows={2} value={draft.cta.description} onChange={(e) => update((d) => (d.cta.description = e.target.value))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Label CTA Utama" value={draft.cta.ctaPrimaryLabel} onChange={(e) => update((d) => (d.cta.ctaPrimaryLabel = e.target.value))} />
            <Input label="Link CTA Utama" value={draft.cta.ctaPrimaryHref} onChange={(e) => update((d) => (d.cta.ctaPrimaryHref = e.target.value))} />
            <Input label="Label CTA Sekunder" value={draft.cta.ctaSecondaryLabel} onChange={(e) => update((d) => (d.cta.ctaSecondaryLabel = e.target.value))} />
            <Input label="Link CTA Sekunder" value={draft.cta.ctaSecondaryHref} onChange={(e) => update((d) => (d.cta.ctaSecondaryHref = e.target.value))} />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <section className="mb-8">
        <SectionHeader title="8. Footer" description="Deskripsi, kontak, link navigasi dan teks copyright." />
        <div className="card space-y-6 p-4 sm:p-5">
          <Textarea label="Deskripsi Footer" rows={3} value={draft.footer.description} onChange={(e) => update((d) => (d.footer.description = e.target.value))} />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Kontak Footer</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input label="Alamat" value={draft.footer.contact.address} onChange={(e) => update((d) => (d.footer.contact.address = e.target.value))} />
              <Input label="Email" type="email" value={draft.footer.contact.email} onChange={(e) => update((d) => (d.footer.contact.email = e.target.value))} />
              <Input label="Telepon/WA" value={draft.footer.contact.phone} onChange={(e) => update((d) => (d.footer.contact.phone = e.target.value))} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Seksi Link Footer</h3>
              <Button size="sm" variant="secondary" icon="plus" onClick={() => update((d) => d.footer.sections.push({ title: 'Seksi Baru', links: [{ label: 'Link Baru', href: '#' }] }))}>
                Tambah Seksi
              </Button>
            </div>
            {draft.footer.sections.map((sec, si) => (
              <div key={si} className="space-y-3 rounded-card border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Input label="Judul Seksi" className="max-w-xs" value={sec.title} onChange={(e) => update((d) => (d.footer.sections[si].title = e.target.value))} />
                  <Button variant="ghost" size="sm" icon="trash" className="text-danger" onClick={() => update((d) => d.footer.sections.splice(si, 1))}>
                    Hapus Seksi
                  </Button>
                </div>
                <div className="space-y-2">
                  {sec.links.map((ln, li) => (
                    <div key={li} className="grid gap-2 sm:grid-cols-[1fr,1.5fr,auto,auto] sm:items-center">
                      <Input label="Label Link" value={ln.label} onChange={(e) => update((d) => (d.footer.sections[si].links[li].label = e.target.value))} />
                      <Input label="Alamat Link" value={ln.href} onChange={(e) => update((d) => (d.footer.sections[si].links[li].href = e.target.value))} />
                      <label className="inline-flex items-center gap-2 text-xs text-muted">
                        <input type="checkbox" checked={!!ln.external} onChange={(e) => update((d) => (d.footer.sections[si].links[li].external = e.target.checked))} />
                        External
                      </label>
                      <Button variant="ghost" size="sm" icon="trash" className="text-danger" onClick={() => update((d) => d.footer.sections[si].links.splice(li, 1))} />
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" icon="plus" onClick={() => update((d) => d.footer.sections[si].links.push({ label: 'Link Baru', href: '#' }))}>
                    Tambah Link
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Input label="Teks Copyright" value={draft.footer.copyright} onChange={(e) => update((d) => (d.footer.copyright = e.target.value))} />
        </div>
      </section>

      <div className="sticky bottom-4 z-20 flex justify-end">
        <Button icon="save" size="lg" onClick={() => void handleSave()} loading={saving} disabled={uploadingKey !== null}>
          Simpan Semua Perubahan
        </Button>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Kembalikan ke Default"
        description="Konten landing akan dikembalikan ke nilai bawaan. Tekan Simpan untuk menerapkan."
        confirmLabel="Kembalikan"
        cancelLabel="Batal"
        tone="primary"
        onClose={() => setResetOpen(false)}
        onConfirm={handleResetToDefault}
      />
    </>
  )
}