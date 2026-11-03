import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { userApi } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import type { Role } from '@/types'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  ROLE_LABEL,
  buildCardPdf,
  downloadBlob,
  downloadPng,
  drawBack,
  drawFront,
  loadCardAssets,
  type CardAssets,
} from '@/lib/memberCard'

interface Props {
  userId: string
  name: string
  role: Role
  /** `stacked` dipakai di dalam modal yang sempit. */
  layout?: 'grid' | 'stacked'
}

function fileSlug(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'anggota'
  )
}

export function MemberIdCard({ userId, name, role, layout = 'grid' }: Props) {
  const { toast } = useToast()
  const [assets, setAssets] = useState<CardAssets | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [downloading, setDownloading] = useState<'front' | 'back' | 'pdf' | null>(null)
  const frontRef = useRef<HTMLCanvasElement>(null)
  const backRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setAssets(null)

    userApi
      .getAttendanceToken(userId)
      .then(async (res) => {
        // QR existing dipertahankan apa adanya (token, opsi, dan isi tidak diubah).
        const qrUrl = await QRCode.toDataURL(res.token, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
        if (cancelled) return
        const loaded = await loadCardAssets(qrUrl)
        if (!cancelled) setAssets(loaded)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        toast('Gagal memuat kartu anggota.', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, toast, attempt])

  useEffect(() => {
    if (!assets) return
    if (frontRef.current) drawFront(frontRef.current, assets, { name, role })
    if (backRef.current) drawBack(backRef.current, assets)
  }, [assets, name, role])

  async function handlePng(side: 'front' | 'back') {
    const canvas = side === 'front' ? frontRef.current : backRef.current
    if (!canvas) return
    setDownloading(side)
    try {
      await downloadPng(
        canvas,
        `kartu-anggota-${fileSlug(name)}-${side === 'front' ? 'depan' : 'belakang'}.png`,
      )
    } catch {
      toast('Gagal mengunduh PNG.', 'error')
    } finally {
      setDownloading(null)
    }
  }

  function handlePdf() {
    if (!frontRef.current || !backRef.current) return
    setDownloading('pdf')
    try {
      downloadBlob(
        buildCardPdf([frontRef.current, backRef.current]),
        `kartu-anggota-${fileSlug(name)}.pdf`,
      )
    } catch {
      toast('Gagal mengunduh PDF.', 'error')
    } finally {
      setDownloading(null)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Memuat kartu anggota">
        <div className="aspect-[1600/1135] w-full animate-pulse rounded-card bg-line/40" />
        <div className="aspect-[1600/1135] w-full animate-pulse rounded-card bg-line/40" />
      </div>
    )
  }

  if (error || !assets) {
    return (
      <div className="rounded-card border border-line bg-bg/60 p-4 text-center">
        <p className="text-sm text-ink">Kartu anggota gagal dimuat.</p>
        <p className="mt-1 text-[12px] text-muted">
          QR Code tidak dapat diambil. Periksa koneksi lalu coba lagi.
        </p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>
          Coba lagi
        </Button>
      </div>
    )
  }

  const gridClass = layout === 'grid' ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'

  return (
    <div className="space-y-3">
      <div className={gridClass}>
        <figure className="min-w-0">
          <figcaption className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Sisi Depan
          </figcaption>
          <canvas
            ref={frontRef}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            role="img"
            aria-label={`Kartu anggota WCC sisi depan, ${name}, ${ROLE_LABEL[role]}`}
            className="block h-auto w-full rounded-[10px] shadow-soft ring-1 ring-black/10"
          />
        </figure>

        <figure className="min-w-0">
          <figcaption className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Sisi Belakang
          </figcaption>
          <canvas
            ref={backRef}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            role="img"
            aria-label="Kartu anggota WCC sisi belakang berisi informasi organisasi"
            className="block h-auto w-full rounded-[10px] shadow-soft ring-1 ring-black/10"
          />
        </figure>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          icon="download"
          onClick={() => void handlePng('front')}
          loading={downloading === 'front'}
          disabled={downloading !== null}
        >
          Unduh PNG Depan
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon="download"
          onClick={() => void handlePng('back')}
          loading={downloading === 'back'}
          disabled={downloading !== null}
        >
          Unduh PNG Belakang
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon="file-text"
          onClick={handlePdf}
          loading={downloading === 'pdf'}
          disabled={downloading !== null}
        >
          Unduh PDF (2 sisi)
        </Button>
      </div>

      <p className="text-[11px] text-muted">
        QR Code memakai token absensi yang sudah ada dan bersifat permanen; tidak dibuat ulang.
      </p>
    </div>
  )
}
