import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { treasuryApi, syncApi, uploadApi, type TreasurySummary } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsync, errorMessage } from '@/lib/hooks'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/cards/StatCard'
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable'
import { Alert, ErrorState } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDateID, formatDateTimeID, formatRupiah, todayISO } from '@/lib/date'
import type { Transaction, TransactionType } from '@/types'

const INCOME_CATEGORIES = ['Iuran Anggota', 'Donasi', 'Sponsor', 'Lain-lain']
const EXPENSE_CATEGORIES = ['Sewa Gym', 'Peralatan', 'Konsumsi', 'Event', 'Operasional', 'Lain-lain']

interface FormState {
  id?: string
  type: TransactionType
  category: string
  date: string
  amount: string
  note: string
  receiptName?: string
  receiptUrl?: string
}

const EMPTY: FormState = {
  type: 'pemasukan',
  category: INCOME_CATEGORIES[0],
  date: todayISO(),
  amount: '',
  note: '',
}

function periodDefaults() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(first), to: iso(now) }
}

export function TreasuryPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  // Pengurus = kelola penuh (ubah, hapus, audit, sinkronisasi).
  // Coach = boleh melihat dan mencatat transaksi baru, tanpa ubah/hapus.
  // Anggota hanya melihat.
  const isManager = user!.role === 'pengurus'
  const canCreate = user!.role === 'pengurus' || user!.role === 'coach'
  const [period, setPeriod] = useState(periodDefaults())
  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)

  const list = useAsync(() => treasuryApi.list(), [])
  const summary = useAsync(() => treasuryApi.summary(period), [period.from, period.to])
  const sync = useAsync(() => (isManager ? syncApi.get() : Promise.resolve(null)), [isManager])

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)

  const categories = form.type === 'pemasukan' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const rows = useMemo(() => {
    let data = list.data ?? []
    if (typeFilter) data = data.filter((t) => t.type === typeFilter)
    if (categoryFilter) data = data.filter((t) => t.category === categoryFilter)
    return data
  }, [list.data, typeFilter, categoryFilter])

  const allCategories = useMemo(() => {
    const set = new Set<string>()
    ;(list.data ?? []).forEach((t) => set.add(t.category))
    return Array.from(set)
  }, [list.data])

  const pageCount = Math.max(1, Math.ceil(rows.length / 10))
  const current = rows.slice((page - 1) * 10, page * 10)

  function openCreate() {
    setForm({ ...EMPTY, date: todayISO() })
    setErrors({})
    setFormOpen(true)
  }

  function openEdit(t: Transaction) {
    setForm({
      id: t.id,
      type: t.type,
      category: t.category,
      date: t.date,
          amount: String(t.amount),
      note: t.note,
      receiptName: t.receiptName,
      receiptUrl: t.receiptUrl,
    })
    setErrors({})
    setFormOpen(true)
  }

  async function onReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingReceipt(true)
    try {
      const res = await uploadApi.upload(file)
      setForm((f) => ({ ...f, receiptName: res.name, receiptUrl: res.url }))
      toast('Bukti transaksi berhasil diunggah.', 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setUploadingReceipt(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const errs: typeof errors = {}
    const amount = Number(form.amount.replace(/[^\d]/g, ''))
    if (!amount || amount <= 0) errs.amount = 'Nominal harus lebih dari 0 dan berupa angka.'
    if (!form.category) errs.category = 'Kategori wajib dipilih.'
    if (!form.date) errs.date = 'Tanggal wajib diisi.'
    else if (form.date > todayISO()) errs.date = 'Tanggal tidak boleh melewati hari ini.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      await treasuryApi.save({
        id: form.id,
        type: form.type,
        category: form.category,
        date: form.date,
        amount,
        note: form.note,
        recordedBy: form.id ? undefined : user!.name,
        receiptName: form.receiptName,
        receiptUrl: form.receiptUrl,
      })
      toast(form.id ? 'Perubahan transaksi berhasil disimpan.' : 'Transaksi kas berhasil dicatat.', 'success')
      setFormOpen(false)
      list.reload()
      summary.reload()
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
      await treasuryApi.remove(deleteTarget.id)
      toast('Transaksi berhasil dihapus. Audit log dicatat oleh sistem.', 'success')
      setDeleteTarget(null)
      list.reload()
      summary.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const s: TreasurySummary = summary.data ?? { balance: 0, income: 0, expense: 0 }

  const columns: Column<Transaction>[] = [
    { key: 'date', header: 'Tanggal', render: (t) => <span className="text-muted">{formatDateID(t.date)}</span> },
    {
      key: 'type',
      header: 'Tipe',
      render: (t) => (
        <StatusBadge tone={t.type === 'pemasukan' ? 'success' : 'danger'} icon={t.type === 'pemasukan' ? 'plus' : 'arrow-right'}>
          {t.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
        </StatusBadge>
      ),
    },
    { key: 'category', header: 'Kategori', render: (t) => <span className="text-ink">{t.category}</span> },
    {
      key: 'amount',
      header: 'Nominal',
      align: 'right',
      render: (t) => (
        <span className={t.type === 'pemasukan' ? 'font-semibold text-success' : 'font-semibold text-danger'}>
          {t.type === 'pemasukan' ? '+' : '−'}
          {formatRupiah(t.amount)}
        </span>
      ),
    },
    {
      key: 'note',
      header: 'Keterangan',
      render: (t) => (
        <span className="text-muted">
          {t.note || '—'}
          {t.receiptUrl && (
            <>
              {t.note ? ' · ' : ''}
              <a
                href={t.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link inline-flex items-center gap-1"
              >
                <Icon name="image" size={14} /> Bukti
              </a>
            </>
          )}
        </span>
      ),
    },
    { key: 'by', header: 'Dicatat oleh', hideOnMobile: true, render: (t) => <span className="text-muted">{t.recordedBy}</span> },
    ...(isManager
      ? [
          {
            key: 'action',
            header: 'Aksi',
            align: 'right' as const,
            render: (t: Transaction) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant="secondary" icon="edit" onClick={() => openEdit(t)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleteTarget(t)}>
                  Hapus
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title={canCreate ? 'Kas & Treasury' : 'Kas Klub'}
        description={
          canCreate
            ? 'Catat transaksi pemasukan dan pengeluaran kas klub.'
            : 'Ringkasan saldo dan transaksi kas klub (hanya lihat).'
        }
        action={
          canCreate ? (
            <>
              {isManager && (
                <Button variant="secondary" icon="shield" onClick={() => navigate('/app/audit')}>
                  Jejak Audit
                </Button>
              )}
              <Button icon="plus" onClick={openCreate}>
                Catat Transaksi
              </Button>
            </>
          ) : undefined
        }
      />

      {!canCreate && (
        <Alert tone="info" className="mb-5">
          Anda dapat melihat ringkasan saldo dan daftar transaksi kas klub. Penambahan atau perubahan
          data dilakukan oleh pengurus.
        </Alert>
      )}

      <div className={`mb-5 grid gap-4 sm:grid-cols-2 ${isManager ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <StatCard label="Saldo saat ini" value={formatRupiah(s.balance)} icon="wallet" tone="primary" hint="Pemasukan − pengeluaran (seluruh waktu)" />
        <StatCard label="Pemasukan periode" value={formatRupiah(s.income)} icon="plus" tone="success" hint={`${formatDateID(period.from)} – ${formatDateID(period.to)}`} />
        <StatCard label="Pengeluaran periode" value={formatRupiah(s.expense)} icon="arrow-right" tone="danger" />
        {isManager && (
          <StatCard
            label="Sinkronisasi terakhir"
            value={sync.data?.lastSyncAt ? formatDateTimeID(sync.data.lastSyncAt) : 'Belum pernah'}
            icon="refresh"
            tone={sync.data?.status === 'success' ? 'success' : sync.data?.status === 'failed' ? 'danger' : 'neutral'}
          />
        )}
      </div>

      <div className="card mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Periode dari" type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
          <Input label="Periode sampai" type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
          <Select
            label="Tipe transaksi"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Semua tipe</option>
            <option value="pemasukan">Pemasukan</option>
            <option value="pengeluaran">Pengeluaran</option>
          </Select>
          <Select
            label="Kategori"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Semua kategori</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <SectionHeader
        title={`${rows.length} transaksi`}
        description={
          isManager
            ? 'Urut dari tanggal terbaru. Setiap perubahan transaksi dicatat sistem.'
            : 'Urut dari tanggal terbaru.'
        }
      />
      <DataTable
        columns={columns}
        rows={current}
        rowKey={(t) => t.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        caption="Daftar transaksi kas"
        emptyIcon="wallet"
        emptyTitle="Belum ada transaksi"
        emptyDescription="Catat transaksi pertama klub untuk melihat ringkasan saldo."
        renderMobileCard={(t) => (
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{t.category}</p>
                <p className="truncate text-[12.5px] text-muted">{formatDateID(t.date)} · {t.recordedBy}</p>
                {t.note && <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{t.note}</p>}
              </div>
              <p className={`flex-none text-sm font-bold ${t.type === 'pemasukan' ? 'text-success' : 'text-danger'}`}>
                {t.type === 'pemasukan' ? '+' : '−'}
                {formatRupiah(t.amount)}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <StatusBadge tone={t.type === 'pemasukan' ? 'success' : 'danger'}>
                {t.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
              </StatusBadge>
              {isManager && (
                <>
                  <Button size="sm" variant="secondary" icon="edit" onClick={() => openEdit(t)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleteTarget(t)}>
                    Hapus
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} total={rows.length} perPage={10} onChange={setPage} />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? 'Ubah Transaksi' : 'Catat Transaksi Kas'}
        description="Nominal menggunakan Rupiah tanpa titik pemisah."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button form="trx-form" type="submit" loading={saving}>
              {form.id ? 'Simpan Perubahan' : 'Simpan Transaksi'}
            </Button>
          </>
        }
      >
        <form id="trx-form" onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['pemasukan', 'pengeluaran'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    type: t,
                    category: t === 'pemasukan' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
                  })
                }
                aria-pressed={form.type === t}
                className={`flex items-center gap-3 rounded-control border p-3 text-left transition-colors ${
                  form.type === t
                    ? t === 'pemasukan'
                      ? 'border-success bg-success/10'
                      : 'border-danger bg-danger/10'
                    : 'border-line bg-surface hover:bg-bg'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-control ${
                    t === 'pemasukan' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                  }`}
                >
                  <Icon name={t === 'pemasukan' ? 'plus' : 'arrow-right'} size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold capitalize text-ink">{t}</span>
                  <span className="block text-[12px] text-muted">
                    {t === 'pemasukan' ? 'Iuran, donasi, sponsor' : 'Sewa, alat, konsumsi, event'}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <Select
            label="Kategori"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            error={errors.category}
            required
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Tanggal"
              type="date"
              max={todayISO()}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              error={errors.date}
              required
            />
            <Input
              label="Nominal"
              inputMode="numeric"
              prefix="Rp"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, '') })}
              error={errors.amount}
              placeholder="150000"
              required
            />
          </div>

          {form.amount && Number(form.amount) > 0 && (
            <p className="rounded-control bg-bg px-3 py-2 text-[13px] text-muted">
              Dibaca sebagai <span className="font-semibold text-ink">{formatRupiah(Number(form.amount))}</span>
            </p>
          )}

          <Textarea
            label="Keterangan"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Misalnya: iuran bulanan 5 anggota"
          />

          <div>
            <span className="field-label">Bukti transaksi (opsional)</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-control border border-dashed border-line bg-bg/50 px-3 py-3 text-sm text-muted hover:border-primary/40">
              <Icon name="image" size={19} />
              <span className="min-w-0 flex-1 truncate">
                {uploadingReceipt ? 'Mengunggah…' : form.receiptName || 'Pilih berkas gambar/PDF…'}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                disabled={uploadingReceipt}
                onChange={(e) => void onReceiptChange(e)}
              />
              <span className="flex-none rounded-control border border-line bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-ink">
                {uploadingReceipt ? 'Tunggu' : form.receiptName ? 'Ganti' : 'Pilih'}
              </span>
            </label>
            {form.receiptUrl && (
              <div className="mt-2 flex items-center gap-4 text-[12.5px]">
                <a
                  href={form.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link inline-flex items-center gap-1.5"
                >
                  <Icon name="eye" size={15} /> Lihat bukti terunggah
                </a>
                <button
                  type="button"
                  className="text-muted hover:text-danger"
                  onClick={() => setForm((f) => ({ ...f, receiptName: undefined, receiptUrl: undefined }))}
                >
                  Hapus
                </button>
              </div>
            )}
            <p className="field-helper">
              Berkas gambar atau PDF (maks. 5 MB) diunggah ke server dan disimpan sebagai bukti transaksi.
            </p>
          </div>

          <Alert tone="warning" title="Perhatian">
            Pastikan nominal dan tipe transaksi sudah benar. Perubahan dan penghapusan transaksi dicatat dalam
            audit log beserta waktu dan identitas pencatat.
          </Alert>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus transaksi ini?"
        description={`Transaksi ${deleteTarget?.category ?? ''} sebesar ${
          deleteTarget ? formatRupiah(deleteTarget.amount) : ''
        } pada ${deleteTarget ? formatDateID(deleteTarget.date) : ''} akan dihapus. Tindakan ini dicatat pada audit log.`}
        confirmLabel="Hapus Transaksi"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  )
}
