import { useMemo, useState } from 'react'
import { paymentApi } from '@/api/client'
import type { Payment, PaymentPurpose } from '@/api/client'
import { useAsync } from '@/lib/hooks'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Feedback'
import { PAYMENT_LABEL, PAYMENT_TONE, StatusBadge } from '@/components/ui/StatusBadge'
import { formatDateTimeID } from '@/lib/date'

const rupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`

const PURPOSE_FILTER: Array<{ value: string; label: string }> = [
  { value: '', label: 'Semua jenis' },
  { value: 'pendaftaran', label: 'Biaya administrasi pendaftaran' },
  { value: 'iuran', label: 'Iuran kas anggota' },
]

const STATUS_FILTER: Array<{ value: string; label: string }> = [
  { value: '', label: 'Semua status' },
  { value: 'pending', label: 'Menunggu pembayaran' },
  { value: 'paid', label: 'Lunas' },
  { value: 'expired', label: 'Kedaluwarsa' },
  { value: 'failed', label: 'Gagal' },
]

function purposeLabel(purpose: PaymentPurpose, period?: string): string {
  if (purpose === 'pendaftaran') return 'Biaya administrasi pendaftaran'
  return period ? `Iuran kas ${period}` : 'Iuran kas anggota'
}

/** Halaman pengurus: memantau pembayaran online (DOKU). */
export function PaymentsPage() {
  const [purpose, setPurpose] = useState('')
  const [status, setStatus] = useState('')

  const list = useAsync(
    () =>
      paymentApi.adminList({
        purpose: (purpose || undefined) as PaymentPurpose | undefined,
        status: status || undefined,
      }),
    [purpose, status],
  )

  const payments = list.data?.payments ?? []
  const totals = list.data?.totals ?? { paid: 0, pending: 0 }

  const columns: Column<Payment>[] = useMemo(
    () => [
      {
        key: 'invoice',
        header: 'Invoice',
        render: (p) => (
          <span className="font-mono text-[12.5px] text-muted">{p.invoiceNumber}</span>
        ),
      },
      {
        key: 'purpose',
        header: 'Jenis',
        render: (p) => (
          <span className="text-ink">{purposeLabel(p.purpose, p.period)}</span>
        ),
      },
      {
        key: 'payer',
        header: 'Pembayar',
        render: (p) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{p.payerName || '—'}</p>
            <p className="truncate text-[12.5px] text-muted">{p.payerEmail || '—'}</p>
          </div>
        ),
      },
      {
        key: 'amount',
        header: 'Nominal',
        align: 'right',
        render: (p) => <span className="font-semibold text-ink">{rupiah(p.amount)}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        render: (p) => (
          <StatusBadge tone={PAYMENT_TONE[p.status] ?? 'info'}>{PAYMENT_LABEL[p.status] ?? p.status}</StatusBadge>
        ),
      },
      {
        key: 'created',
        header: 'Dibuat',
        hideOnMobile: true,
        render: (p) => <span className="text-muted">{formatDateTimeID(p.createdAt)}</span>,
      },
      {
        key: 'paidAt',
        header: 'Dibayar',
        hideOnMobile: true,
        render: (p) => <span className="text-muted">{p.paidAt ? formatDateTimeID(p.paidAt) : '—'}</span>,
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pembayaran Online"
        description="Pantau pembayaran biaya administrasi pendaftaran dan iuran kas anggota."
        action={
          <Button variant="secondary" onClick={() => list.reload()}>
            Muat ulang
          </Button>
        }
      />

      <Alert tone="info">
        Iuran yang lunas otomatis tercatat sebagai pemasukan <strong>Iuran Anggota</strong> pada halaman
        Kas &amp; Treasury.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-[12.5px] text-muted">Total dibayar</p>
          <p className="mt-1 text-[22px] font-bold text-success">{rupiah(totals.paid)}</p>
        </div>
        <div className="card p-5">
          <p className="text-[12.5px] text-muted">Menunggu pembayaran</p>
          <p className="mt-1 text-[22px] font-bold text-ink">{rupiah(totals.pending)}</p>
        </div>
      </div>

      <section>
        <SectionHeader
          title="Daftar transaksi"
          description={`${payments.length} transaksi ditampilkan.`}
        />

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Select label="Jenis pembayaran" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {PURPOSE_FILTER.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_FILTER.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>

        <DataTable
          columns={columns}
          rows={payments}
          rowKey={(p) => p.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          emptyIcon="wallet"
          emptyTitle="Belum ada pembayaran"
          emptyDescription="Transaksi online akan tampil di sini setelah pendaftar atau anggota membayar."
        />
      </section>
    </div>
  )
}
