import { useState } from 'react'
import { syncApi } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { useAsync, errorMessage } from '@/lib/hooks'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/cards/StatCard'
import { Alert, EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDateTimeID, localDateOf, relativeDayID } from '@/lib/date'

const COLUMNS = ['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Keterangan', 'Dicatat Oleh']

export function SyncPage() {
  const { toast } = useToast()
  const data = useAsync(() => syncApi.get(), [])
  const [running, setRunning] = useState(false)

  async function run() {
    if (running) return
    setRunning(true)
    try {
      const res = await syncApi.run()
      toast(`Sinkronisasi berhasil. ${res.rows} baris dikirim ke spreadsheet.`, 'success')
      data.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
      data.reload()
    } finally {
      setRunning(false)
    }
  }

  const s = data.data
  const status = s?.status ?? 'idle'
  const tone = status === 'success' ? 'success' : status === 'failed' ? 'danger' : status === 'running' ? 'warning' : 'neutral'
  const label = status === 'success' ? 'Berhasil' : status === 'failed' ? 'Gagal' : status === 'running' ? 'Berjalan' : 'Menunggu'

  return (
    <>
      <PageHeader
        title="Sinkronisasi Spreadsheet"
        description="Pantau status dan log sinkronisasi kas klub ke Google Sheets."
        action={
          <Button icon="refresh" loading={running} onClick={() => void run()}>
            Sinkronkan Sekarang
          </Button>
        }
      />

      {s && s.configured === false && (
        <Alert tone="warning" className="mb-5" title="Google Sheets belum dikonfigurasi">
          <p>Server belum memiliki kredensial Google Sheets. Pilih salah satu cara:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            <li>
              <strong>Apps Script (mudah)</strong> — deploy Web App dari spreadsheet, lalu isi{' '}
              <code>GOOGLE_APPS_SCRIPT_URL</code> pada <code>server/.env</code>.
            </li>
            <li>
              <strong>Service Account</strong> — isi <code>GOOGLE_SERVICE_ACCOUNT_FILE</code> /{' '}
              <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>, lalu bagikan spreadsheet ke{' '}
              <strong>{s.serviceAccountEmail ?? 'email service account'}</strong> sebagai Editor.
            </li>
            <li>
              <strong>OAuth 2.0</strong> — isi <code>GOOGLE_OAUTH_CLIENT_ID</code>,{' '}
              <code>GOOGLE_OAUTH_CLIENT_SECRET</code>, dan <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> pada{' '}
              <code>server/.env</code>.
            </li>
          </ul>
          {s.reason ? <p className="mt-1.5 text-[12.5px] text-muted">Penyebab: {s.reason}</p> : null}
        </Alert>
      )}

      {s && s.configured && (
        <Alert tone="success" className="mb-5" title="Terhubung ke Google Sheets">
          Mode:{' '}
          <strong>
            {s.mode === 'apps-script' ? 'Google Apps Script' : s.mode === 'oauth' ? 'OAuth 2.0' : 'Service Account'}
          </strong>
          {' · '}Tab: <code>{s.tab ?? 'Kas'}</code>
          {s.spreadsheetId ? (
            <>
              {' · '}ID: <code>{s.spreadsheetId}</code>
            </>
          ) : null}
        </Alert>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Status sinkronisasi" value={label} icon="refresh" tone={tone as never} />
        <StatCard
          label="Sinkronisasi terakhir"
          value={s?.lastSyncAt ? formatDateTimeID(s.lastSyncAt) : 'Belum pernah'}
          icon="clock"
          tone="neutral"
          hint={s?.lastSyncAt ? relativeDayID(localDateOf(s.lastSyncAt)) : undefined}
        />
        <StatCard label="Total baris terkirim (terakhir)" value={s?.log?.[0]?.rows ?? 0} icon="list" tone="primary" />
      </div>

      {running && (
        <Alert tone="info" className="mb-5" title="Sinkronisasi sedang berjalan">
          Mohon tunggu. Jangan menutup halaman hingga proses selesai. Status akan diperbarui setelah backend
          mengonfirmasi hasil proses.
        </Alert>
      )}

      <div className="card mb-6 p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold text-ink">Struktur kolom spreadsheet</h2>
        <p className="mt-1 text-[13px] text-muted">
          Urutan kolom berikut digunakan saat sinkronisasi berhasil. Perubahan struktur harus disepakati pengurus.
        </p>
        <ol className="mt-3 flex flex-wrap gap-2">
          {(s?.columns ?? COLUMNS).map((c, i) => (
            <li
              key={c}
              className="flex items-center gap-2 rounded-control border border-line bg-bg/60 px-3 py-2 text-[13px] font-medium text-ink"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                {i + 1}
              </span>
              {c}
            </li>
          ))}
        </ol>

        <div className="mt-4 flex items-start gap-2.5 rounded-control border border-warning/30 bg-warning/10 p-3">
          <Icon name="shield" size={18} className="mt-0.5 flex-none text-warning" />
          <p className="text-[12.5px] text-ink/80">
            Kredensial dan token akses Google Sheets disimpan di sisi server dan tidak pernah ditampilkan pada
            antarmuka. Integrasi dua arah terbatas (tulis otomatis, baca untuk rekonsiliasi) dijalankan backend.
          </p>
        </div>
      </div>

      <SectionHeader title="Log sinkronisasi" description="20 catatan terakhir." />
      {data.loading ? (
        <div className="card p-6 text-center text-sm text-muted">Memuat log…</div>
      ) : data.error ? (
        <div className="card">
          <ErrorState message={data.error} onRetry={data.reload} />
        </div>
      ) : (s?.log ?? []).length === 0 ? (
        <div className="card">
          <EmptyState icon="refresh" title="Belum ada log sinkronisasi" description="Jalankan sinkronisasi untuk membuat catatan log." />
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {(s?.log ?? []).map((l) => (
            <div key={l.id} className="flex items-start gap-3 p-4">
              <span
                className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-control ${
                  l.status === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                }`}
              >
                <Icon name={l.status === 'success' ? 'check' : 'alert'} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={l.status === 'success' ? 'success' : 'danger'}>
                    {l.status === 'success' ? 'Berhasil' : 'Gagal'}
                  </StatusBadge>
                  <span className="text-[12.5px] text-muted">{formatDateTimeID(l.at)}</span>
                  {l.rows > 0 && <span className="text-[12.5px] text-muted">· {l.rows} baris</span>}
                </div>
                <p className="mt-1.5 text-[13.5px] text-ink/85">{l.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card mt-6 p-4">
        <h2 className="text-[15px] font-semibold text-ink">Penanganan kegagalan</h2>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-muted">
          <li className="flex items-start gap-2">
            <Icon name="check" size={16} className="mt-0.5 flex-none text-success" />
            Jika kuota API terlampaui, sistem mencoba ulang secara otomatis pada jadwal berikutnya.
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check" size={16} className="mt-0.5 flex-none text-success" />
            Pesan kegagalan ditulis dengan bahasa yang mudah dipahami; detail teknis hanya masuk ke log pengembang.
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check" size={16} className="mt-0.5 flex-none text-success" />
            Status berhasil hanya ditampilkan setelah backend mengonfirmasi keberhasilan penulisan.
          </li>
        </ul>
      </div>
    </>
  )
}
