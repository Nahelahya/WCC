import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { paymentApi } from '@/api/client'
import { errorMessage } from '@/lib/hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, Spinner, buttonClasses } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { Icon, type IconName } from '@/components/ui/Icon'
import type { PaymentStatusView } from '@/api/types'

/**
 * Halaman tujuan setelah pembeli kembali dari DOKU
 * (`/pembayaran?invoice=…`). Status diambil dari server dan di-polling selama
 * masih `pending`, karena webhook DOKU bisa datang beberapa detik kemudian.
 */

interface StatusPresentation {
  label: string
  description: string
  tone: 'info' | 'success' | 'warning' | 'error'
  icon: IconName
}

function presentation(status: PaymentStatusView['status']): StatusPresentation {
  switch (status) {
    case 'paid':
      return {
        label: 'Pembayaran berhasil',
        description: 'Terima kasih! Pembayaran Anda sudah kami terima.',
        tone: 'success',
        icon: 'check-circle',
      }
    case 'expired':
      return {
        label: 'Tautan kedaluwarsa',
        description: 'Waktu pembayaran habis. Silakan ulangi proses pembayaran.',
        tone: 'warning',
        icon: 'clock',
      }
    case 'failed':
      return {
        label: 'Pembayaran gagal',
        description: 'Pembayaran tidak berhasil. Silakan coba lagi.',
        tone: 'error',
        icon: 'alert',
      }
    default:
      return {
        label: 'Menunggu pembayaran',
        description: 'Kami sedang menunggu konfirmasi dari penyedia pembayaran.',
        tone: 'info',
        icon: 'clock',
      }
  }
}

const PURPOSE_LABEL: Record<string, string> = {
  pendaftaran: 'Biaya administrasi pendaftaran',
  iuran: 'Iuran kas anggota',
}

export function PaymentStatusPage() {
  const [params] = useSearchParams()
  const invoice = params.get('invoice') ?? params.get('invoice_number') ?? params.get('order_id') ?? ''
  const [state, setState] = useState<PaymentStatusView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(invoice))

  const load = useCallback(async () => {
    if (!invoice) return
    try {
      const view = await paymentApi.status(invoice)
      setState(view)
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [invoice])

  useEffect(() => {
    if (!invoice) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      if (!active) return
      await load()
      if (!active) return
      timer = setTimeout(() => void tick(), 5000)
    }
    void tick()

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [invoice, load])

  // Berhenti polling saat status final.
  useEffect(() => {
    if (state && state.status !== 'pending') setLoading(false)
  }, [state])

  const view = state ? presentation(state.status) : null

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        title="Status Pembayaran"
        description="Halaman ini menampilkan status pembayaran yang Anda lakukan melalui DOKU."
        breadcrumb={
          <Link to="/" className="hover:text-primary">
            Beranda
          </Link>
        }
      />

      <div className="card p-6 sm:p-8">
        {!invoice ? (
          <Alert tone="warning" title="Tautan tidak lengkap">
            Nomor pembayaran (invoice) tidak ditemukan pada tautan ini. Silakan kembali ke halaman
            sebelumnya atau hubungi pengurus.
          </Alert>
        ) : error ? (
          <Alert tone="error" title="Gagal memuat status">
            {error}
          </Alert>
        ) : loading || !state || !view ? (
          <div className="flex items-center gap-3 text-sm text-muted">
            <Spinner className="h-5 w-5 text-primary" />
            Memuat status pembayaran…
          </div>
        ) : (
          <>
            <span
              className={
                view.tone === 'success'
                  ? 'flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success'
                  : view.tone === 'error'
                    ? 'flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger'
                    : view.tone === 'warning'
                      ? 'flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent'
                      : 'flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary'
              }
            >
              <Icon name={view.icon} size={26} />
            </span>

            <h1 className="mt-4 text-[22px] font-bold text-ink">{view.label}</h1>
            <p className="mt-2 text-sm text-muted">{view.description}</p>

            {state.status === 'pending' && (
              <p className="mt-3 text-[12.5px] text-muted">
                Halaman ini menyegarkan otomatis. Bila pembayaran Anda sudah berhasil, status akan
                berubah menjadi &ldquo;Pembayaran berhasil&rdquo;.
              </p>
            )}

            <dl className="mt-6 grid gap-3 rounded-card border border-line bg-bg/60 p-4 sm:grid-cols-2">
              <div>
                <dt className="text-[12.5px] text-muted">Nomor invoice</dt>
                <dd className="mt-0.5 break-all text-sm font-semibold text-ink">{state.invoiceNumber}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-muted">Jenis pembayaran</dt>
                <dd className="mt-0.5 text-sm font-semibold text-ink">
                  {PURPOSE_LABEL[state.purpose] ?? state.purpose}
                  {state.period ? ` · ${state.period}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-muted">Nominal</dt>
                <dd className="mt-0.5 text-sm font-semibold text-ink">
                  Rp {state.amount.toLocaleString('id-ID')}
                </dd>
              </div>
              {state.channel && (
                <div>
                  <dt className="text-[12.5px] text-muted">Metode</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">{state.channel}</dd>
                </div>
              )}
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="secondary" size="lg" onClick={() => void load()}>
                Perbarui Status
              </Button>
              <Link to="/" className={buttonClasses('primary', 'lg')}>
                Kembali ke Beranda
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
