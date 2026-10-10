import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { attendanceApi, sessionApi, statsApi, userApi } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsync } from '@/lib/hooks'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/cards/StatCard'
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { ATTENDANCE_LABEL, ATTENDANCE_TONE, StatusBadge, SESSION_TONE, SESSION_LABEL } from '@/components/ui/StatusBadge'
import { downloadTextFile, currentMonth, formatDateID, formatMonthID, monthRange, todayISO } from '@/lib/date'
import { sessionStatus } from '@/lib/session'
import type { AttendanceRow } from '@/api/client'

const PER_PAGE = 10

export function AttendancePage() {
  const { user } = useAuth()
  if (user!.role === 'coach') return <CoachAttendanceList />
  if (user!.role === 'pengurus') return <AttendanceRecap />
  return <MyAttendance />
}

/* ------------------------- Anggota: riwayat saya ------------------------ */

function MyAttendance() {
  const { user } = useAuth()
  const [filter, setFilter] = useState('' as '' | 'menunggu' | 'hadir' | 'izin' | 'alpha')
  // Rekap direset setiap bulan; pengguna dapat memilih bulan lain.
  const [month, setMonth] = useState(currentMonth())
  const [page, setPage] = useState(1)
  const range = month ? monthRange(month) : undefined
  const rows = useAsync(() => attendanceApi.byUser(user!.id, range), [user!.id, month])

  const data = rows.data ?? []
  const filtered = filter ? data.filter((r) => r.status === filter) : data
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const current = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const hadir = data.filter((r) => r.status === 'hadir').length
  const izin = data.filter((r) => r.status === 'izin').length
  const alpha = data.filter((r) => r.status === 'alpha').length
  const menunggu = data.filter((r) => r.status === 'menunggu').length

  const columns: Column<AttendanceRow>[] = [
    {
      key: 'session',
      header: 'Sesi latihan',
      render: (r) => <span className="font-medium text-ink">{r.sessionTitle}</span>,
    },
    { key: 'date', header: 'Tanggal', render: (r) => <span className="text-muted">{formatDateID(r.sessionDate)}</span> },
    {
      key: 'time',
      header: 'Waktu check-in',
      render: (r) => (
        <span className="text-muted">
          {(r.status === 'hadir' || r.status === 'menunggu') && r.checkInTime ? r.checkInTime : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge tone={ATTENDANCE_TONE[r.status]}>{ATTENDANCE_LABEL[r.status]}</StatusBadge>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Absensi Saya"
        description="Riwayat kehadiran Anda pada sesi latihan klub."
        action={
          <Link to="/app/jadwal" className={buttonClasses('primary', 'md')}>
            <Icon name="calendar" size={17} />
            Jadwal Latihan
          </Link>
        }
      />

      <p className="mb-2 text-[12.5px] font-medium text-muted">
        {month ? `Rekap ${formatMonthID(month)}` : 'Rekap semua periode'}
      </p>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hadir" value={hadir} icon="check-circle" tone="success" hint={month ? formatMonthID(month) : 'Semua periode'} />
        <StatCard label="Izin" value={izin} icon="clock" tone="warning" />
        <StatCard label="Menunggu" value={menunggu} icon="refresh" tone="info" hint="Menunggu konfirmasi coach" />
        <StatCard label="Tidak hadir" value={alpha} icon="x" tone="danger" />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <Input
            label="Bulan"
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            label="Filter status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter)
              setPage(1)
            }}
          >
            <option value="">Semua status</option>
            <option value="hadir">Hadir</option>
            <option value="izin">Izin</option>
            <option value="menunggu">Menunggu konfirmasi</option>
            <option value="alpha">Tidak hadir</option>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={current}
        rowKey={(r) => r.id}
        loading={rows.loading}
        error={rows.error}
        onRetry={rows.reload}
        caption="Riwayat absensi saya"
        emptyIcon="check-circle"
        emptyTitle={filter ? 'Tidak ada data dengan status tersebut' : 'Belum ada riwayat absensi'}
        emptyDescription={
          filter
            ? 'Coba ubah filter status kehadiran.'
            : 'Riwayat akan muncul setelah Anda mengikuti sesi latihan dan melakukan check-in.'
        }
        emptyAction={
          !filter ? (
            <Link to="/app/jadwal" className={buttonClasses('primary')}>
              Lihat Jadwal
            </Link>
          ) : undefined
        }
        renderMobileCard={(r) => (
          <div className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{r.sessionTitle}</p>
              <p className="text-[12.5px] text-muted">
                {formatDateID(r.sessionDate)}
                {r.checkInTime ? ` · check-in ${r.checkInTime}` : ''}
              </p>
            </div>
            <StatusBadge tone={ATTENDANCE_TONE[r.status]}>{ATTENDANCE_LABEL[r.status]}</StatusBadge>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
    </>
  )
}

/* --------------------- Coach: daftar hadir per sesi --------------------- */

function CoachAttendanceList() {
  const { user } = useAuth()
  const data = useAsync(() => statsApi.coachDashboard(user!.coachId ?? ''), [user!.coachId])
  const sessions = [...(data.data?.upcoming ?? []), ...(data.data?.past ?? [])]

  return (
    <>
      <PageHeader
        title="Daftar Hadir"
        description="Pilih sesi untuk melihat daftar peserta dan status kehadiran."
      />

      {data.loading ? (
        <CardSkeleton lines={3} />
      ) : data.error ? (
        <div className="card">
          <ErrorState message={data.error} onRetry={data.reload} />
        </div>
      ) : sessions.length === 0 ? (
        <div className="card">
          <EmptyState icon="list" title="Belum ada sesi yang ditugaskan kepada Anda." />
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {sessions.map((s) => {
            const st = sessionStatus(s)
            return (
              <Link
                key={s.id}
                to={`/app/jadwal/${s.id}`}
                className="flex items-center gap-3 p-4 transition-colors hover:bg-bg/60"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-control bg-primary/10 text-primary">
                  <Icon name="list" size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{s.title}</p>
                  <p className="truncate text-[12.5px] text-muted">
                    {formatDateID(s.date)} · {s.location}
                  </p>
                </div>
                <StatusBadge tone={SESSION_TONE[st]}>{SESSION_LABEL[st]}</StatusBadge>
                <Icon name="chevron-right" size={17} className="flex-none text-muted" />
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

/* -------------------- Pengurus: rekap absensi (tabel) ------------------- */

function AttendanceRecap() {
  const { toast } = useToast()
  // Rekap direset setiap bulan; pengguna dapat memilih bulan lain.
  const [month, setMonth] = useState(currentMonth())
  const [sessionId, setSessionId] = useState('')
  const [userId, setUserId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const sessions = useAsync(() => sessionApi.list(), [])
  const members = useAsync(() => userApi.list(), [])
  const recap = useAsync(() => attendanceApi.recap(month ? monthRange(month) : undefined), [month])

  const rows = useMemo(() => {
    let data = recap.data ?? []
    if (sessionId) data = data.filter((r) => r.sessionId === sessionId)
    if (userId) data = data.filter((r) => r.userId === userId)
    if (status) data = data.filter((r) => r.status === status)
    return data
  }, [recap.data, sessionId, userId, status])

  const hadir = rows.filter((r) => r.status === 'hadir').length
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const current = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }

  function exportCsv() {
    if (rows.length === 0) {
      toast('Tidak ada data untuk diekspor.', 'warning')
      return
    }
    const header = 'Nama Anggota,Sesi,Tanggal,Waktu Check-in,Status'
    const body = rows
      .map((r) =>
        [
          r.userName,
          r.sessionTitle,
          r.sessionDate,
          r.status === 'hadir' && r.checkInTime ? r.checkInTime : '',
          ATTENDANCE_LABEL[r.status],
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n')
    downloadTextFile(`rekap-absensi-${todayISO()}.csv`, `${header}\n${body}`, 'text/csv')
    toast('Rekap absensi berhasil diekspor ke CSV.', 'success')
  }

  const columns: Column<AttendanceRow>[] = [
    {
      key: 'name',
      header: 'Nama anggota',
      render: (r) => <span className="font-medium text-ink">{r.userName}</span>,
    },
    { key: 'session', header: 'Sesi', render: (r) => <span className="text-muted">{r.sessionTitle}</span> },
    { key: 'date', header: 'Tanggal', render: (r) => <span className="text-muted">{formatDateID(r.sessionDate)}</span> },
    {
      key: 'time',
      header: 'Waktu check-in',
      render: (r) => (
        <span className="text-muted">
          {(r.status === 'hadir' || r.status === 'menunggu') && r.checkInTime ? r.checkInTime : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge tone={ATTENDANCE_TONE[r.status]}>{ATTENDANCE_LABEL[r.status]}</StatusBadge>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Rekap Absensi"
        description="Tinjau kehadiran anggota per bulan, per sesi, dan per anggota."
        action={
          <Button variant="secondary" icon="download" onClick={exportCsv}>
            Ekspor CSV
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total catatan" value={rows.length} icon="list" tone="primary" hint={month ? formatMonthID(month) : 'Semua periode'} />
        <StatCard label="Hadir" value={hadir} icon="check-circle" tone="success" />
        <StatCard label="Izin" value={rows.filter((r) => r.status === 'izin').length} icon="clock" tone="warning" />
        <StatCard
          label="Tidak hadir"
          value={rows.filter((r) => r.status === 'alpha').length}
          icon="x"
          tone="danger"
        />
      </div>

      <div className="card mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Bulan" type="month" value={month} onChange={(e) => resetPage(setMonth)(e.target.value)} />
          <Select label="Sesi" value={sessionId} onChange={(e) => resetPage(setSessionId)(e.target.value)}>
            <option value="">Semua sesi</option>
            {(sessions.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {formatDateID(s.date)} — {s.title}
              </option>
            ))}
          </Select>
          <Select label="Anggota" value={userId} onChange={(e) => resetPage(setUserId)(e.target.value)}>
            <option value="">Semua anggota</option>
            {(members.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-56">
            <Select label="Status" value={status} onChange={(e) => resetPage(setStatus)(e.target.value)}>
              <option value="">Semua status</option>
              <option value="hadir">Hadir</option>
              <option value="izin">Izin</option>
              <option value="menunggu">Menunggu konfirmasi</option>
              <option value="alpha">Tidak hadir</option>
            </Select>
          </div>
          {(sessionId || userId || status || month !== currentMonth()) && (
            <Button
              variant="ghost"
              icon="x"
              onClick={() => {
                setMonth(currentMonth())
                setSessionId('')
                setUserId('')
                setStatus('')
                setPage(1)
              }}
            >
              Reset filter
            </Button>
          )}
        </div>
      </div>

      <SectionHeader title={`${rows.length} catatan kehadiran`} description="Klik baris untuk detail sesi." />
      <DataTable
        columns={columns}
        rows={current}
        rowKey={(r) => r.id}
        loading={recap.loading}
        error={recap.error}
        onRetry={recap.reload}
        caption="Rekap absensi anggota"
        emptyIcon="check-circle"
        emptyTitle="Belum ada data absensi"
        emptyDescription="Ubah filter atau tunggu hingga ada sesi latihan yang tercatat."
        renderMobileCard={(r) => (
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{r.userName}</p>
                <p className="truncate text-[12.5px] text-muted">{r.sessionTitle}</p>
              </div>
              <StatusBadge tone={ATTENDANCE_TONE[r.status]}>{ATTENDANCE_LABEL[r.status]}</StatusBadge>
            </div>
            <p className="mt-1.5 text-[12.5px] text-muted">
              {formatDateID(r.sessionDate)}
              {r.checkInTime ? ` · check-in ${r.checkInTime}` : ''}
            </p>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} total={rows.length} perPage={PER_PAGE} onChange={setPage} />
    </>
  )
}
