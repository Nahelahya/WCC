import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { userApi } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/context/ToastContext'

interface Props {
  userId: string
  name: string
  photoUrl?: string
  memberNumber?: string
}

/** Escape HTML supaya nilai pengguna (name, photoUrl, memberNumber) tidak
 *  bisa mengexekusi markup saat disisipkan ke dokumen cetak. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Hanya izinkan skema aman untuk `photoUrl` pada data cetak (H-03).
 *  `data:` diperbolehkan karena QR card di-generate server-side. */
function isSafeUrl(value: string): boolean {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'data:'
  } catch {
    return false
  }
}

export function MemberIdCard({ userId, name, photoUrl, memberNumber }: Props) {
  const { toast } = useToast()
  const [token, setToken] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    userApi
      .getAttendanceToken(userId)
      .then(async (res) => {
        if (cancelled) return
        setToken(res.token)
        const url = await QRCode.toDataURL(res.token, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
        if (!cancelled) setQrUrl(url)
      })
      .catch(() => {
        if (!cancelled) toast('Gagal memuat QR ID card.', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, toast])

  async function download() {
    if (!qrUrl) return
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = `id-card-qr-${userId}.png`
    a.click()
  }

  function printCard() {
    if (!cardRef.current) return
    const w = window.open('', '_blank', 'width=420,height=620')
    if (!w) return
    const photoSrc = isSafeUrl(photoUrl ?? '') ? escapeHtml(photoUrl ?? '') : ''
    const body = `
      <div class="card">
        ${photoSrc ? `<img class="photo" src="${photoSrc}" alt="" />` : ''}
        <div class="name">${escapeHtml(name)}</div>
        <div class="num">${escapeHtml(memberNumber ?? userId)}</div>
        ${qrUrl ? `<img class="qr" src="${escapeHtml(qrUrl)}" alt="QR" />` : ''}
        <div class="num">WISANGGENI CLIMBING CLUB</div>
      </div>
    `
    // Semua nilai tersisip sudah di-escape; tidak ada markup pengguna yang
    // bersifat mentah. `photoUrl` hanya boleh dari skema http(s)/data.
    w.document.write(`
      <html><head><title>ID Card ${escapeHtml(name)}</title>
      <style>
        body { font-family: system-ui, sans-serif; display:flex; justify-content:center; padding:24px; }
        .card { width: 320px; border:1px solid #ddd; border-radius:16px; padding:20px; text-align:center; }
        .name { font-size:18px; font-weight:700; margin:8px 0 2px; }
        .num { font-size:12px; color:#666; }
        img.qr { width:200px; height:200px; margin:12px auto; }
        .photo { width:72px; height:72px; border-radius:50%; object-fit:cover; margin:0 auto 8px; }
      </style></head><body>${body}</body></html>
    `)
    w.document.close()
    // Cetak setelah isi halaman siap (tanpa inline <script> yang blokir CSP).
    w.addEventListener('load', () => {
      setTimeout(() => {
        try { w.print() } catch {
          // ignore jika jendela sudah ditutup / diblokir
        }
      }, 500)
    })
  }

  if (loading) {
    return <p className="text-sm text-muted">Memuat QR Code…</p>
  }

  return (
    <div className="space-y-3">
      <div ref={cardRef} className="mx-auto w-full max-w-xs rounded-2xl border border-line bg-surface p-5 text-center shadow-sm">
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <Icon name="user" size={28} />
          )}
        </div>
        <p className="text-base font-bold text-ink">{name}</p>
        <p className="text-[12px] text-muted">{memberNumber ?? userId}</p>
        {qrUrl && <img src={qrUrl} alt="QR Code ID Card" className="mx-auto mt-3 h-44 w-44" />}
        <p className="mt-2 text-[11px] font-semibold tracking-wide text-muted">WISANGGENI CLIMBING CLUB</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon="download" onClick={download} disabled={!qrUrl}>
          Unduh QR
        </Button>
        <Button size="sm" variant="secondary" icon="download" onClick={printCard} disabled={!qrUrl}>
          Cetak ID Card
        </Button>
      </div>
      <p className="text-[11px] text-muted">QR Code bersifat permanen dan tidak dapat dibuat ulang.</p>
      {token && <p className="text-[11px] text-muted">Token: {token.slice(0, 8)}…</p>}
    </div>
  )
}
