import { useMemo, useState } from 'react'
import { registrationApi } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { useAsync, errorMessage } from '@/lib/hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/cards/StatCard'
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable'
import { Alert, EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { StatusBadge, REGISTRATION_LABEL, REGISTRATION_TONE } from '@/components/ui/StatusBadge'
import { formatDateID, formatDateTimeID, localDateOf } from '@/lib/date'
import type { Registration, RegistrationStatus } from '@/types'

const PER_PAGE = 8

export function RegistrationsPage() {
  const { toast } = useToast()
  const list = useAsync(() => registrationApi.list(), [])
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Registration | null>(null)
  const [note, setNote] = useState('')
  const [working, setWorking] = useState(false)
  const [pending, setPending] = useState<RegistrationStatus | null>(null)

  const rows = useMemo(() => {
    let data = list.data ?? []
    if (status) data = data.filter((r) => r.status === status)
    return data
  }, [list.data, status])

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const current = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const all = list.data ?? []

  // Keputusan verifikasi/tolak bersifat final: begitu dipilih tidak bisa diubah.
  const locked = detail?.status === 'diverifikasi' || detail?.status === 'ditolak'

  async function setRegStatus(r: Registration, next: RegistrationStatus) {
    setWorking(true)
    setPending(next)
    try {
      await registrationApi.setStatus(r.id, next, note || undefined)
      toast(
        next === 'diverifikasi'
          ? `Pendaftaran ${r.fullName} berhasil diverifikasi.`
          : `Pendaftaran ${r.fullName} ditolak.`,
        next === 'diverifikasi' ? 'success' : 'info',
      )
      setDetail(null)
      setNote('')
      list.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setWorking(false)
      setPending(null)
    }
  }

  const columns: Column<Registration>[] = [
    {
      key: 'name',
      header: 'Calon anggota',
      render: (r) => (
        <div>
          <p className="font-medium text-ink">{r.fullName}</p>
          <p className="text-[12.5px] text-muted">{r.email}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Kontak', render: (r) => <span className="text-muted">{r.phone}</span> },
    {
      key: 'date',
      header: 'Diajukan',
      render: (r) => <span className="text-muted">{formatDateID(localDateOf(r.submittedAt))}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <StatusBadge
          tone={REGISTRATION_TONE[r.status]}
          icon={r.status === 'diverifikasi' ? 'check-circle' : r.status === 'ditolak' ? 'x' : 'clock'}
        >
          {REGISTRATION_LABEL[r.status]}
        </StatusBadge>
      ),
    },
    {
      key: 'action',
      header: 'Aksi',
      align: 'right',
      render: (r) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setDetail(r)
            setNote(r.internalNote ?? '')
          }}
        >
          Tinjau
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Pendaftaran Anggota"
        description="Tinjau dan verifikasi pendaftaran anggota baru (target maksimal 2 hari kerja)."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Menunggu verifikasi" value={all.filter((r) => r.status === 'baru').length} icon="clock" tone="warning" />
        <StatCard label="Diverifikasi" value={all.filter((r) => r.status === 'diverifikasi').length} icon="check-circle" tone="success" />
        <StatCard label="Ditolak" value={all.filter((r) => r.status === 'ditolak').length} icon="x" tone="danger" />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <Select
            label="Filter status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Semua status</option>
            <option value="baru">Baru</option>
            <option value="diverifikasi">Diverifikasi</option>
            <option value="ditolak">Ditolak</option>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={current}
        rowKey={(r) => r.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        caption="Daftar pendaftar anggota baru"
        emptyIcon="inbox"
        emptyTitle="Belum ada pendaftaran"
        emptyDescription="Pendaftaran baru dari calon anggota akan muncul di sini."
        renderMobileCard={(r) => (
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{r.fullName}</p>
                <p className="truncate text-[12.5px] text-muted">{r.email}</p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {r.phone} · {formatDateID(localDateOf(r.submittedAt))}
                </p>
              </div>
              <StatusBadge tone={REGISTRATION_TONE[r.status]}>{REGISTRATION_LABEL[r.status]}</StatusBadge>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => {
                setDetail(r)
                setNote(r.internalNote ?? '')
              }}
            >
              Tinjau pendaftaran
            </Button>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} total={rows.length} perPage={PER_PAGE} onChange={setPage} />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detail pendaftaran"
        description="Periksa data sebelum memverifikasi. Catatan internal tidak ditampilkan kepada calon anggota."
        footer={
          detail ? (
            <>
              <Button variant="secondary" onClick={() => setDetail(null)} disabled={working}>
                Tutup
              </Button>
              {!locked && (
                <>
                  <Button
                    variant="danger"
                    loading={working && pending === 'ditolak'}
                    onClick={() => void setRegStatus(detail, 'ditolak')}
                    disabled={working}
                  >
                    Tolak
                  </Button>
                  <Button
                    loading={working && pending === 'diverifikasi'}
                    onClick={() => void setRegStatus(detail, 'diverifikasi')}
                    disabled={working}
                  >
                    Verifikasi
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={REGISTRATION_TONE[detail.status]}>{REGISTRATION_LABEL[detail.status]}</StatusBadge>
              <span className="text-[12.5px] text-muted">
                Diajukan {formatDateTimeID(detail.submittedAt)} · {detail.id.toUpperCase()}
              </span>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Nama lengkap', detail.fullName],
                ['Email', detail.email],
                ['Nomor kontak', detail.phone],
                [
                  'Jenis kelamin',
                  detail.gender === 'L' ? 'Laki-laki' : detail.gender === 'P' ? 'Perempuan' : '—',
                ],
                ['NIK KTP', detail.nik || '—'],
                ['Nama orang tua/wali', detail.parentName || '—'],
                ['Kontak orang tua/wali', detail.parentPhone || '—'],
                ['Persetujuan data', detail.consent ? 'Disetujui' : 'Belum disetujui'],
                [
                  'Verifikasi email',
                  detail.emailVerifiedAt
                    ? `Terverifikasi (${formatDateTimeID(detail.emailVerifiedAt)})`
                    : 'Belum terverifikasi',
                ],
              ].map(([k, v]) => (
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

            <div className="rounded-control border border-line p-3">
              <p className="text-[12px] text-muted">Pengalaman panjat tebing</p>
              <p className="mt-1 text-sm text-ink">{detail.experience || '—'}</p>
            </div>

            {detail.motivation && (
              <div className="rounded-control border border-line p-3">
                <p className="text-[12px] text-muted">Alasan bergabung</p>
                <p className="mt-1 text-sm text-ink">{detail.motivation}</p>
              </div>
            )}

            <Textarea
              label="Catatan internal (opsional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={locked}
              helper={locked ? 'Keputusan sudah final — catatan hanya dapat dilihat.' : undefined}
              placeholder="Hanya terlihat pengurus. Tidak dikirim ke calon anggota."
            />

            {locked ? (
              <Alert tone="info">
                Pendaftaran ini sudah{' '}
                <strong>{detail.status === 'diverifikasi' ? 'diverifikasi' : 'ditolak'}</strong>. Keputusan bersifat{' '}
                <strong>final</strong> dan tidak dapat diubah lagi.
              </Alert>
            ) : (
              <Alert tone="warning">
                Pastikan data sudah benar. Setelah memilih <strong>Verifikasi</strong> atau <strong>Tolak</strong>,
                keputusan <strong>tidak dapat diubah</strong> lagi.
              </Alert>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
