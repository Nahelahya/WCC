import { useMemo, useState } from 'react'
import { treasuryApi } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { useAsync } from '@/lib/hooks'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/cards/StatCard'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ErrorState } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { downloadTextFile, formatDateID, formatRupiah, todayISO } from '@/lib/date'
import type { Transaction } from '@/types'

function isoFrom(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function presetRange(preset: 'bulan-ini' | 'bulan-lalu' | 'tahun-ini') {
  const now = new Date()
  if (preset === 'bulan-ini')
    return { from: isoFrom(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoFrom(now) }
  if (preset === 'bulan-lalu')
    return {
      from: isoFrom(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: isoFrom(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
  return { from: isoFrom(new Date(now.getFullYear(), 0, 1)), to: isoFrom(now) }
}

export function ReportsPage() {
  const { toast } = useToast()
  const [period, setPeriod] = useState(presetRange('bulan-ini'))
  const list = useAsync(() => treasuryApi.list(), [])

  const rows = useMemo(
    () => (list.data ?? []).filter((t) => t.date >= period.from && t.date <= period.to),
    [list.data, period],
  )

  const income = rows.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + t.amount, 0)
  const expense = rows.filter((t) => t.type === 'pengeluaran').reduce((s, t) => s + t.amount, 0)
  const balance = (list.data ?? []).reduce((s, t) => s + (t.type === 'pemasukan' ? t.amount : -t.amount), 0)

  const byCategory = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    rows.forEach((t) => {
      const entry = map.get(t.category) ?? { income: 0, expense: 0 }
      if (t.type === 'pemasukan') entry.income += t.amount
      else entry.expense += t.amount
      map.set(t.category, entry)
    })
    return Array.from(map.entries()).sort((a, b) => Math.max(b[1].income, b[1].expense) - Math.max(a[1].income, a[1].expense))
  }, [rows])

  const columns: Column<Transaction>[] = [
    { key: 'date', header: 'Tanggal', render: (t) => <span className="text-muted">{formatDateID(t.date)}</span> },
    {
      key: 'type',
      header: 'Tipe',
      render: (t) => (
        <StatusBadge tone={t.type === 'pemasukan' ? 'success' : 'danger'}>
          {t.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
        </StatusBadge>
      ),
    },
    { key: 'category', header: 'Kategori', render: (t) => <span className="text-ink">{t.category}</span> },
    { key: 'note', header: 'Keterangan', render: (t) => <span className="text-muted">{t.note || '—'}</span> },
    { key: 'by', header: 'Dicatat Oleh', render: (t) => <span className="text-muted">{t.recordedBy}</span> },
    {
      key: 'amount',
      header: 'Nominal',
      align: 'right',
      render: (t) => (
        <span className={t.type === 'pemasukan' ? 'font-semibold text-success' : 'font-semibold text-danger'}>
          {formatRupiah(t.amount)}
        </span>
      ),
    },
  ]

  function exportCsv() {
    if (rows.length === 0) {
      toast('Tidak ada data pada periode ini untuk diekspor.', 'warning')
      return
    }
    const header = 'Tanggal,Tipe,Kategori,Nominal,Keterangan,Dicatat Oleh'
    const body = rows
      .map((t) =>
        [t.date, t.type, t.category, t.amount, t.note, t.recordedBy]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n')
    downloadTextFile(`laporan-kas-${period.from}_${period.to}.csv`, `${header}\n${body}`, 'text/csv')
    toast('Laporan kas berhasil diekspor ke CSV.', 'success')
  }

  function exportPdf() {
    if (rows.length === 0) {
      toast('Tidak ada data pada periode ini untuk diekspor.', 'warning')
      return
    }
    const w = window.open('', '_blank', 'width=900,height=1000')
    if (!w) {
      toast('Peramban memblokir jendela cetak. Izinkan pop-up lalu coba lagi.', 'error')
      return
    }
    const trs = rows
      .map(
        (t) => `<tr>
          <td>${formatDateID(t.date)}</td>
          <td>${t.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</td>
          <td>${t.category}</td>
          <td class="r">${formatRupiah(t.amount)}</td>
          <td>${t.note || '-'}</td>
          <td>${t.recordedBy}</td>
        </tr>`,
      )
      .join('')
    w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8" />
      <title>Laporan Kas WCC</title>
      <style>
        body{font-family:Inter,system-ui,sans-serif;color:#17211D;padding:32px}
        h1{font-size:20px;margin:0 0 4px}
        p.meta{color:#66736C;font-size:12px;margin:0 0 18px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border-bottom:1px solid #DCE3DD;padding:8px;text-align:left}
        th{background:#F5F6F2;color:#66736C}
        td.r{text-align:right}
        .sum{margin:18px 0;font-size:13px}
        .sum strong{display:inline-block;min-width:150px}
      </style></head><body>
      <h1>WISANGGENI CLIMBING CLUB — Laporan Kas</h1>
      <p class="meta">Periode ${formatDateID(period.from)} – ${formatDateID(period.to)} · Dicetak ${formatDateID(todayISO())}</p>
      <div class="sum">
        <div><strong>Total Pemasukan</strong> ${formatRupiah(income)}</div>
        <div><strong>Total Pengeluaran</strong> ${formatRupiah(expense)}</div>
        <div><strong>Selisih Periode</strong> ${formatRupiah(income - expense)}</div>
        <div><strong>Saldo Kas Saat Ini</strong> ${formatRupiah(balance)}</div>
      </div>
      <table><thead><tr>
        <th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Nominal</th><th>Keterangan</th><th>Dicatat Oleh</th>
      </tr></thead><tbody>${trs}</tbody></table>
      </body></html>`)
    w.document.close()
    w.focus()
    w.print()
    toast('Jendela cetak PDF dibuka. Pilih "Simpan sebagai PDF".', 'info')
  }

  return (
    <>
      <PageHeader
        title="Laporan Kas"
        description="Ringkasan pemasukan, pengeluaran, dan saldo per periode."
        action={
          <>
            <Button variant="secondary" icon="download" onClick={exportCsv}>
              Ekspor CSV
            </Button>
            <Button variant="secondary" icon="file-text" onClick={exportPdf}>
              Ekspor PDF
            </Button>
          </>
        }
      />

      <div className="card mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Periode dari" type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
          <Input label="Periode sampai" type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
          <Select
            label="Pilih cepat"
            value=""
            onChange={(e) => {
              if (e.target.value) setPeriod(presetRange(e.target.value as 'bulan-ini' | 'bulan-lalu' | 'tahun-ini'))
            }}
          >
            <option value="">Pilih periode…</option>
            <option value="bulan-ini">Bulan ini</option>
            <option value="bulan-lalu">Bulan lalu</option>
            <option value="tahun-ini">Tahun ini</option>
          </Select>
          <div className="flex items-end">
            <p className="w-full rounded-control bg-bg px-3 py-2.5 text-[13px] text-muted">
              {rows.length} transaksi pada periode ini
            </p>
          </div>
        </div>
      </div>

      {list.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-line/40" />
          ))}
        </div>
      ) : list.error ? (
        <div className="card">
          <ErrorState message={list.error} onRetry={list.reload} />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total pemasukan" value={formatRupiah(income)} icon="plus" tone="success" />
            <StatCard label="Total pengeluaran" value={formatRupiah(expense)} icon="arrow-right" tone="danger" />
            <StatCard
              label="Selisih periode"
              value={formatRupiah(income - expense)}
              icon="chart"
              tone={income - expense >= 0 ? 'primary' : 'danger'}
            />
            <StatCard label="Saldo kas saat ini" value={formatRupiah(balance)} icon="wallet" tone="accent" />
          </div>

          <SectionHeader title="Rincian per kategori" description={`Periode ${formatDateID(period.from)} – ${formatDateID(period.to)}`} />
          <div className="card mb-6 overflow-hidden">
            {byCategory.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Tidak ada transaksi pada periode ini.</p>
            ) : (
              <ul className="divide-y divide-line">
                {byCategory.map(([category, val]) => {
                  const max = Math.max(val.income, val.expense, 1)
                  return (
                    <li key={category} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{category}</p>
                        <p className="text-[13px] text-muted">
                          {val.income > 0 && <span className="text-success">Masuk {formatRupiah(val.income)}</span>}
                          {val.income > 0 && val.expense > 0 && ' · '}
                          {val.expense > 0 && <span className="text-danger">Keluar {formatRupiah(val.expense)}</span>}
                        </p>
                      </div>
                      <div className="mt-2.5 space-y-1.5">
                        {val.income > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                              <div className="h-full bg-success" style={{ width: `${(val.income / max) * 100}%` }} />
                            </div>
                            <span className="w-24 flex-none text-right text-[12px] text-muted">Pemasukan</span>
                          </div>
                        )}
                        {val.expense > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                              <div className="h-full bg-danger" style={{ width: `${(val.expense / max) * 100}%` }} />
                            </div>
                            <span className="w-24 flex-none text-right text-[12px] text-muted">Pengeluaran</span>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <SectionHeader title="Rincian transaksi" description={`${rows.length} baris · format kolom sesuai spreadsheet`} />
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(t) => t.id}
            caption="Rincian transaksi kas pada periode laporan"
            emptyIcon="chart"
            emptyTitle="Tidak ada transaksi pada periode ini"
            emptyDescription="Ubah rentang periode untuk melihat data lain."
          />
        </>
      )}
    </>
  )
}
