import { useEffect, useState } from 'react'
import { paymentApi } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { useAsync, errorMessage } from '@/lib/hooks'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Alert, CardSkeleton, ErrorState } from '@/components/ui/Feedback'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { currentMonth, formatDateID, formatMonthID } from '@/lib/date'
import type { Payment } from '@/api/client'

const rupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`

const STATUS_LABEL: Record<string, string> = {
  lunas: 'Lunas',
  sebagian: 'Bayar sebagian',
  belum: 'Belum dibayar',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  lunas: 'success',
  sebagian: 'warning',
  belum: 'danger',
}

const CHANNEL_LABEL: Record<string, string> = {
  cash: 'Tunai',
  gateway: 'Online',
}

/**
 * Panel "Iuran kas anggota" pada detail anggota (halaman Manajemen Pengguna).
 *
 * Anggota yang membayar iuran secara tunai tidak tercatat di gateway
 * pembayaran, jadi pengurus mencatatnya di sini. Catatan tunai langsung
 * terhitung lunas dan masuk sebagai pemasukan "Iuran Anggota" di Kas &
 * Treasury.
 */
export function MemberDuesPanel({ userId, userName }: { userId: string; userName: string }) {
  const { toast } = useToast()
  const [period, setPeriod] = useState(currentMonth())
  const [rawAmount, setRawAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const data = useAsync(() => paymentApi.member(userId, period), [userId, period])

  // Isi kolom nominal dengan catatan tunai terakhir setiap kali data berganti.
  useEffect(() => {
    if (data.data) {
      setRawAmount(data.data.manualAmount > 0 ? String(data.data.manualAmount) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.data])

  const amount = Number(rawAmount.replace(/\D/g, '')) || 0

  async function save(nextAmount: number) {
    setBusy(true)
    try {
      await paymentApi.saveManual({ userId, period, amount: nextAmount })
      toast(nextAmount > 0 ? 'Catatan iuran tunai tersimpan.' : 'Catatan iuran tunai dihapus.')
      data.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const view = data.data
  const dues = view?.dues ?? null
  const status = dues?.status ?? 'belum'

  return (
    <section className="rounded-card border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-ink">Iuran kas anggota</h3>
        {view && <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusBadge>}
      </div>

      {data.loading && !view && <CardSkeleton />}
      {data.error && <ErrorState className="mt-4" message={data.error} onRetry={() => data.reload()} />}

      {view && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Input
              type="month"
              label="Periode iuran"
              value={period}
              onChange={(e) => e.target.value && setPeriod(e.target.value)}
            />
            <p className="pb-2.5 text-[12.5px] text-muted">{formatMonthID(period)}</p>
          </div>

          <dl className="grid grid-cols-3 gap-2">
            <div className="rounded-control border border-line bg-bg/60 p-3">
              <dt className="text-[11.5px] text-muted">Iuran bulanan</dt>
              <dd className="mt-0.5 text-[13.5px] font-semibold text-ink">{rupiah(view.dues.monthlyAmount)}</dd>
            </div>
            <div className="rounded-control border border-line bg-bg/60 p-3">
              <dt className="text-[11.5px] text-muted">Sudah dibayar</dt>
              <dd className="mt-0.5 text-[13.5px] font-semibold text-success">{rupiah(view.dues.paidAmount)}</dd>
            </div>
            <div className="rounded-control border border-line bg-bg/60 p-3">
              <dt className="text-[11.5px] text-muted">Sisa</dt>
              <dd className="mt-0.5 text-[13.5px] font-semibold text-ink">{rupiah(view.dues.outstanding)}</dd>
            </div>
          </dl>

          <div className="rounded-control border border-accent/25 bg-accent/5 p-3">
            <p className="text-[12.5px] text-muted">
              Online {rupiah(view.onlineAmount)} · Tunai {rupiah(view.manualAmount)}
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="sm:max-w-[240px]">
                <Input
                  label="Dibayar tunai"
                  inputMode="numeric"
                  prefix="Rp"
                  value={rawAmount}
                  onChange={(e) => setRawAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  helper="Isi nominal yang sudah diterima, lalu Simpan."
                />
              </div>
              <Button
                variant="primary"
                loading={busy}
                disabled={amount <= 0}
                onClick={() => void save(amount)}
              >
                Simpan
              </Button>
              {view.manualAmount > 0 && (
                <Button variant="secondary" loading={busy} onClick={() => void save(0)}>
                  Hapus catatan
                </Button>
              )}
            </div>
            {amount > 0 && amount + view.onlineAmount > view.dues.monthlyAmount && (
              <Alert tone="warning" className="mt-3">
                Total melebihi iuran bulanan. Sisa akan tetap dianggap lunas.
              </Alert>
            )}
          </div>

          {view.payments.length > 0 && (
            <div>
              <p className="text-[12px] text-muted">Riwayat periode {formatMonthID(period)}</p>
              <ul className="mt-2 divide-y divide-line rounded-control border border-line">
                {view.payments.map((p) => (
                  <DuesPaymentRow key={p.id} payment={p} />
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11.5px] text-muted">
            Iuran tunai untuk {userName} dicatat sebagai pemasukan "Iuran Anggota" di Kas &amp;
            Treasury.
          </p>
        </div>
      )}
    </section>
  )
}

function DuesPaymentRow({ payment }: { payment: Payment }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ink">
          {payment.invoiceNumber}
          <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
            {CHANNEL_LABEL[payment.channel ?? 'gateway'] ?? payment.channel}
          </span>
        </p>
        <p className="text-[11.5px] text-muted">
          {formatDateID(payment.paidAt ? payment.paidAt.slice(0, 10) : payment.createdAt.slice(0, 10))}
        </p>
      </div>
      <p className="text-[13.5px] font-semibold text-ink">{rupiah(payment.amount)}</p>
    </li>
  )
}
