import { useMemo, useState } from 'react'
import { auditApi } from '@/api/client'
import { useAsync } from '@/lib/hooks'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/cards/StatCard'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Icon, type IconName } from '@/components/ui/Icon'
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge'
import { formatDateID, formatDateTimeID, formatRupiah } from '@/lib/date'
import type { AuditAction, AuditLogEntry } from '@/types'

/**
 * Jejak audit transaksi kas (PRD 7.8 & 10).
 * Menampilkan siapa menambah/mengubah/menghapus transaksi, kapan, dan detailnya.
 */

const ACTION_META: Record<AuditAction, { label: string; tone: StatusTone; icon: IconName }> = {
  create: { label: 'Ditambahkan', tone: 'success', icon: 'plus' },
  update: { label: 'Diubah', tone: 'info', icon: 'edit' },
  delete: { label: 'Dihapus', tone: 'danger', icon: 'trash' },
}

const TONE_BG: Record<StatusTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  neutral: 'bg-bg text-muted',
  accent: 'bg-accent/15 text-[#8a4a04]',
  primary: 'bg-primary/10 text-primary',
}

interface Snapshot {
  date?: string
  type?: string
  category?: string
  amount?: number
  note?: string
}

const FIELD_LABEL: Record<keyof Snapshot, string> = {
  date: 'Tanggal',
  type: 'Tipe',
  category: 'Kategori',
  amount: 'Nominal',
  note: 'Keterangan',
}

function typeLabel(type?: string): string {
  if (type === 'pemasukan') return 'pemasukan'
  if (type === 'pengeluaran') return 'pengeluaran'
  return 'transaksi'
}

function oneLine(snap: Snapshot): string {
  return `${typeLabel(snap.type)} “${snap.category ?? '—'}” ${formatRupiah(snap.amount ?? 0)}`
}

function fieldValue(key: keyof Snapshot, snap: Snapshot): string {
  const value = snap[key]
  if (key === 'amount') return formatRupiah((value as number) ?? 0)
  if (key === 'date') return typeof value === 'string' && value ? formatDateID(value) : '—'
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}

interface Change {
  label: string
  from: string
  to: string
}

/** Daftar kolom yang berubah antara snapshot `before` dan `after`. */
function changeList(detail: Record<string, unknown> | null | undefined): Change[] {
  const before = ((detail?.before ?? {}) as Snapshot) ?? {}
  const after = ((detail?.after ?? {}) as Snapshot) ?? {}
  const keys: (keyof Snapshot)[] = ['date', 'type', 'category', 'amount', 'note']
  return keys
    .filter((k) => String(before[k] ?? '') !== String(after[k] ?? ''))
    .map((k) => ({ label: FIELD_LABEL[k], from: fieldValue(k, before), to: fieldValue(k, after) }))
}

function describe(entry: AuditLogEntry): string {
  const snap = (entry.detail ?? {}) as Snapshot
  if (entry.action === 'create') return `Menambahkan ${oneLine(snap)}`
  if (entry.action === 'delete') return `Menghapus ${oneLine(snap)}`
  const after = ((entry.detail?.after ?? {}) as Snapshot) ?? {}
  const changes = changeList(entry.detail)
  if (changes.length === 0) return 'Menyimpan ulang tanpa perubahan nilai.'
  return `Mengubah ${changes.length} kolom pada ${oneLine(after)}`
}

const FILTERS: Array<{ value: 'semua' | AuditAction; label: string }> = [
  { value: 'semua', label: 'Semua' },
  { value: 'create', label: 'Ditambahkan' },
  { value: 'update', label: 'Diubah' },
  { value: 'delete', label: 'Dihapus' },
]

export function AuditLogPage() {
  const [filter, setFilter] = useState<'semua' | AuditAction>('semua')
  const data = useAsync(
    () => auditApi.list(filter === 'semua' ? undefined : { action: filter }),
    [filter],
  )
  const entries = data.data ?? []

  const counts = useMemo(() => {
    const c: Record<AuditAction, number> = { create: 0, update: 0, delete: 0 }
    for (const e of entries) c[e.action] += 1
    return c
  }, [entries])

  return (
    <>
      <PageHeader
        title="Jejak Audit Kas"
        description="Catatan siapa menambah, mengubah, atau menghapus transaksi kas beserta waktunya. Hanya dapat dilihat pengurus (PRD 10 — Auditability)."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Catatan tampil"
          value={entries.length}
          icon="shield"
          tone="primary"
          hint="Terbaru di atas"
        />
        <StatCard label="Perubahan data" value={counts.update + counts.create} icon="edit" tone="info" />
        <StatCard label="Penghapusan" value={counts.delete} icon="trash" tone="danger" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-control border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary text-white'
                  : 'border-line bg-surface text-muted hover:border-primary/40 hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <SectionHeader title="Riwayat aktivitas" description="100 catatan terakhir untuk transaksi kas." />

      {data.loading ? (
        <div className="card p-6 text-center text-sm text-muted">Memuat jejak audit…</div>
      ) : data.error ? (
        <div className="card">
          <ErrorState message={data.error} onRetry={data.reload} />
        </div>
      ) : entries.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="shield"
            title="Belum ada catatan audit"
            description="Jejak akan muncul setelah ada penambahan, perubahan, atau penghapusan transaksi kas."
          />
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {entries.map((entry) => {
            const meta = ACTION_META[entry.action]
            const changes = entry.action === 'update' ? changeList(entry.detail) : []
            return (
              <div key={entry.id} className="flex items-start gap-3 p-4">
                <span
                  className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-control ${TONE_BG[meta.tone]}`}
                >
                  <Icon name={meta.icon} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={meta.tone} icon={meta.icon}>
                      {meta.label}
                    </StatusBadge>
                    <span className="text-[13px] font-medium text-ink">{entry.userName}</span>
                    <span className="text-[12.5px] text-muted">· {formatDateTimeID(entry.at)}</span>
                  </div>
                  <p className="mt-1.5 text-[13.5px] text-ink/85">{describe(entry)}</p>
                  {changes.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {changes.map((c) => (
                        <li key={c.label} className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                          <span className="font-medium text-muted">{c.label}:</span>
                          <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger line-through">
                            {c.from}
                          </span>
                          <Icon name="arrow-right" size={13} className="text-muted" />
                          <span className="rounded bg-success/10 px-1.5 py-0.5 font-medium text-success">
                            {c.to}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card mt-6 p-4">
        <h2 className="text-[15px] font-semibold text-ink">Kenapa jejak ini penting</h2>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-muted">
          <li className="flex items-start gap-2">
            <Icon name="check" size={16} className="mt-0.5 flex-none text-success" />
            Mencegah kesalahan input kas: setiap perubahan terekam dengan waktu dan identitas pencatat.
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check" size={16} className="mt-0.5 flex-none text-success" />
            Transparansi pengurus: nilai sebelum dan sesudah ditampilkan saat sebuah transaksi diubah.
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check" size={16} className="mt-0.5 flex-none text-success" />
            Catatan tidak dapat diubah dari antarmuka ini — jejak audit bersifat hanya-baca.
          </li>
        </ul>
      </div>
    </>
  )
}
