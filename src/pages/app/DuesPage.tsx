import { useState } from 'react'
import { paymentApi } from '@/api/client'
import { useAsync, errorMessage } from '@/lib/hooks'
import { useToast } from '@/context/ToastContext'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Alert, CardSkeleton, EmptyState, ErrorState } from '@/components/ui/Feedback'
import { PAYMENT_LABEL, PAYMENT_TONE, StatusBadge } from '@/components/ui/StatusBadge'
import { formatDateID, localDateOf } from '@/lib/date'

const rupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`

const DUES_STATUS_LABEL: Record<string, string> = {
  lunas: 'Lunas',
  sebagian: 'Bayar sebagian',
  belum: 'Belum dibayar',
}

const DUES_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  lunas: 'success',
  sebagian: 'warning',
  belum: 'danger',
}

/**
 * Halaman "Iuran Saya" — anggota dapat membayar iuran kas bulanan
 * (Rp 60.000) secara penuh atau dicicil melalui DOKU.
 */
export function DuesPage() {
  const { toast } = useToast()
  const mine = useAsync(() => paymentApi.mine(), [])
  const config = useAsync(() => paymentApi.config(), [])

  const dues = mine.data?.dues
  const outstanding = dues?.outstanding ?? 0
  const payments = mine.data?.payments ?? []

  const [rawAmount, setRawAmount] = useState('')
  const [paying, setPaying] = useState(false)

  const digits = rawAmount.replace(/\D/g, '')
  const requested = rawAmount.trim() === '' ? outstanding : Math.floor(Number(digits))
  const configured = config.data?.configured ?? false

  async function pay(amount: number) {
    if (paying || !dues) return
    if (amount <= 0) {
      toast('Nominal pembayaran harus lebih dari 0.', 'warning')
      return
    }
    if (amount > outstanding) {
      toast(`Sisa iuran periode ini hanya ${rupiah(outstanding)}.`, 'warning')
      return
    }
    setPaying(true)
    try {
      const res = await paymentApi.checkout({ purpose: 'iuran', period: dues.period, amount })
      if (res.url) {
        window.location.href = res.url // lanjut ke halaman pembayaran DOKU
        return
      }
      toast('Pembayaran dicatat sebagai lunas.', 'success')
      mine.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Iuran Saya"
        description="Iuran kas klub Rp 60.000 per bulan. Boleh dibayar bertahap sampai lunas."
      />

      {/* Ringkasan periode berjalan */}
      {mine.loading ? (
        <CardSkeleton lines={2} />
      ) : mine.error ? (
        <ErrorState message={mine.error} onRetry={mine.reload} />
      ) : dues ? (
        <div className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12.5px] uppercase tracking-wide text-muted">Periode</p>
              <p className="text-[20px] font-bold text-ink">{dues.period}</p>
            </div>
            <StatusBadge
              tone={DUES_STATUS_TONE[dues.status] ?? 'info'}
              icon={dues.status === 'lunas' ? 'check-circle' : dues.status === 'sebagian' ? 'clock' : 'alert'}
            >
              {DUES_STATUS_LABEL[dues.status] ?? dues.status}
            </StatusBadge>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-line bg-bg/60 p-4">
              <dt className="text-[12.5px] text-muted">Iuran bulanan</dt>
              <dd className="mt-1 text-[17px] font-semibold text-ink">{rupiah(dues.monthlyAmount)}</dd>
            </div>
            <div className="rounded-card border border-line bg-bg/60 p-4">
              <dt className="text-[12.5px] text-muted">Sudah dibayar</dt>
              <dd className="mt-1 text-[17px] font-semibold text-success">{rupiah(dues.paidAmount)}</dd>
            </div>
            <div className="rounded-card border border-line bg-bg/60 p-4">
              <dt className="text-[12.5px] text-muted">Sisa</dt>
              <dd className="mt-1 text-[17px] font-semibold text-ink">{rupiah(dues.outstanding)}</dd>
            </div>
          </dl>

          {dues.outstanding <= 0 ? (
            <Alert tone="success" className="mt-5">
              Iuran periode {dues.period} sudah lunas. Terima kasih!
            </Alert>
          ) : !configured ? (
            <Alert tone="warning" className="mt-5" title="Pembayaran online belum aktif">
              Belum bisa membayar lewat DOKU. Silakan bayar {rupiah(dues.outstanding)} secara tunai
              kepada pengurus.
            </Alert>
          ) : (
            <div className="mt-5 rounded-card border border-line p-4">
              <h2 className="text-[15px] font-semibold text-ink">Bayar iuran</h2>
              <p className="mt-1 text-[13px] text-muted">
                Isi nominal bila ingin mencicil, atau kosongkan untuk melunasi sisanya (
                {rupiah(dues.outstanding)}). Anda akan diarahkan ke halaman pembayaran DOKU.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="sm:max-w-[220px]">
                  <Input
                    label="Nominal pembayaran"
                    inputMode="numeric"
                    prefix="Rp"
                    value={rawAmount}
                    onChange={(e) => setRawAmount(e.target.value.replace(/\D/g, ''))}
                    placeholder={String(dues.outstanding)}
                    helper={`Maksimal ${rupiah(dues.outstanding)}`}
                  />
                </div>
                <Button
                  size="lg"
                  loading={paying}
                  onClick={() => void pay(requested)}
                  className="sm:mb-6"
                >
                  <Icon name="wallet" size={18} />
                  Bayar {rupiah(Math.max(0, Math.min(requested || dues.outstanding, dues.outstanding)))}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Riwayat pembayaran */}
      <section>
        <SectionHeader title="Riwayat pembayaran" description="Termasuk iuran dan biaya administrasi." />
        {mine.loading ? (
          <CardSkeleton lines={3} />
        ) : payments.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="wallet"
              title="Belum ada pembayaran"
              description="Pembayaran Anda akan tampil di sini setelah tercatat."
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {payments.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {p.purpose === 'iuran' ? `Iuran ${p.period ?? ''}` : 'Biaya administrasi pendaftaran'}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {p.invoiceNumber}
                    {p.paidAt ? ` · ${formatDateID(localDateOf(p.paidAt))}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink">{rupiah(p.amount)}</span>
                  <StatusBadge tone={PAYMENT_TONE[p.status] ?? 'info'}>
                    {PAYMENT_LABEL[p.status] ?? p.status}
                  </StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
