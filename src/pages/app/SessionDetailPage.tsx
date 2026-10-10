import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { attendanceApi, coachApi, sessionApi, userApi } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsync, errorMessage } from '@/lib/hooks'
import { BackLink } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, EmptyState, ErrorState, ListSkeleton, PageLoading } from '@/components/ui/Feedback'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { StatusBadge, SESSION_TONE, SESSION_LABEL, SESSION_ICON, ATTENDANCE_TONE, ATTENDANCE_LABEL } from '@/components/ui/StatusBadge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDateLongID, formatTimeRange, formatDateTimeID, relativeDayID } from '@/lib/date'
import { canCheckIn, sessionStatus } from '@/lib/session'
import type { Attendance } from '@/types'

interface Participant {
  userId: string
  name: string
  email: string
  status: Attendance['status'] | 'belum'
  checkInAt: string | null
}

export function SessionDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const session = useAsync(() => sessionApi.get(id), [id])
  const coaches = useAsync(() => coachApi.list(), [])
  const attendance = useAsync(() => attendanceApi.bySession(id), [id])
  const members = useAsync(() => userApi.list(), [])

  const [query, setQuery] = useState('')
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const s = session.data
  const coach = coaches.data?.find((c) => c.id === s?.coachId) ?? null
  const myAttendance = (attendance.data ?? []).find((a) => a.userId === user!.id) ?? null

  const participants: Participant[] = useMemo(() => {
    const rows = (members.data ?? []).map((m) => {
      const rec = (attendance.data ?? []).find((a) => a.userId === m.id)
      return {
        userId: m.id,
        name: m.name,
        email: m.email,
        status: (rec?.status ?? 'belum') as Participant['status'],
        checkInAt: rec?.checkInAt ?? null,
      }
    })
    return rows
  }, [members.data, attendance.data])

  const filteredParticipants = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return participants
    return participants.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
  }, [participants, query])

  const hadir = participants.filter((p) => p.status === 'hadir').length
  const izin = participants.filter((p) => p.status === 'izin').length
  const belum = participants.filter((p) => p.status === 'belum').length
  const menunggu = participants.filter((p) => p.status === 'menunggu').length

  if (session.loading) return <PageLoading />
  if (session.error)
    return (
      <div className="card">
        <ErrorState message={session.error} onRetry={session.reload} />
      </div>
    )
  if (!s)
    return (
      <div className="card">
        <EmptyState
          icon="calendar"
          title="Sesi tidak ditemukan"
          description="Jadwal mungkin telah dihapus pengurus."
          action={
            <Link to="/app/jadwal" className={buttonClasses('primary')}>
              Kembali ke Jadwal
            </Link>
          }
        />
      </div>
    )

  const status = sessionStatus(s)
  const checkIn = canCheckIn(s)
  const isManager = user!.role === 'pengurus'
  const isCoachOfSession = user!.role === 'coach' && user!.coachId === s.coachId
  // Pengurus dapat mengoreksi semua sesi; coach hanya sesi yang ia ampu.
  const canManage = isManager || isCoachOfSession
  const isPast = status === 'selesai'

  async function doCheckIn() {
    if (checking) return
    setChecking(true)
    try {
      const created = await attendanceApi.checkIn(s!.id, user!.id)
      const d = new Date(created.checkInAt)
      const hhmm = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
      toast(`Check-in terkirim pukul ${hhmm}. Menunggu konfirmasi coach.`, 'success')
      attendance.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setChecking(false)
    }
  }

  async function setStatus(userId: string, value: Attendance['status']) {
    setUpdating(userId)
    try {
      await attendanceApi.setStatus(s!.id, userId, value)
      toast('Status kehadiran diperbarui.', 'success')
      attendance.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setUpdating(null)
    }
  }

  const columns: Column<Participant>[] = [
    {
      key: 'name',
      header: 'Nama anggota',
      render: (p) => (
        <div>
          <p className="font-medium text-ink">{p.name}</p>
          <p className="text-[12.5px] text-muted">{p.email}</p>
        </div>
      ),
    },
    {
      key: 'checkin',
      header: 'Waktu check-in',
      render: (p) => (
        <span className="text-[13px] text-muted">
          {(p.status === 'hadir' || p.status === 'menunggu') && p.checkInAt
            ? formatDateTimeID(p.checkInAt).split(', ')[1]
            : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) =>
        p.status === 'belum' ? (
          <StatusBadge tone="neutral" icon="clock">
            Belum hadir
          </StatusBadge>
        ) : (
          <StatusBadge tone={ATTENDANCE_TONE[p.status]} icon={p.status === 'hadir' ? 'check-circle' : 'clock'}>
            {ATTENDANCE_LABEL[p.status]}
          </StatusBadge>
        ),
    },
    ...(canManage
      ? [
          {
            key: 'action',
            header: 'Kehadiran',
            align: 'right' as const,
            render: (p: Participant) => (
              <div className="flex justify-end gap-1.5">
                {(['hadir', 'izin', 'alpha'] as const).map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={p.status === v ? 'primary' : 'secondary'}
                    loading={updating === p.userId}
                    onClick={() => void setStatus(p.userId, v)}
                  >
                    {ATTENDANCE_LABEL[v]}
                  </Button>
                ))}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        breadcrumb={<BackLink to="/app/jadwal" label="Kembali ke Jadwal Latihan" />}
        title={s.title}
        description={`${formatDateLongID(s.date)} · ${relativeDayID(s.date)}`}
        action={
          <StatusBadge tone={SESSION_TONE[status]} icon={SESSION_ICON[status]} className="text-[13px]">
            {SESSION_LABEL[status]}
          </StatusBadge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Ringkasan sesi */}
          <div className="card p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold text-ink">Ringkasan sesi</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <Icon name="calendar" size={18} className="mt-0.5 flex-none text-primary/70" />
                <div>
                  <dt className="text-[12.5px] text-muted">Tanggal</dt>
                  <dd className="text-sm font-medium text-ink">{formatDateLongID(s.date)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Icon name="clock" size={18} className="mt-0.5 flex-none text-primary/70" />
                <div>
                  <dt className="text-[12.5px] text-muted">Waktu</dt>
                  <dd className="text-sm font-medium text-ink">{formatTimeRange(s.startTime, s.endTime)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Icon name="pin" size={18} className="mt-0.5 flex-none text-primary/70" />
                <div>
                  <dt className="text-[12.5px] text-muted">Lokasi</dt>
                  <dd className="text-sm font-medium text-ink">{s.location}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Icon name="user" size={18} className="mt-0.5 flex-none text-primary/70" />
                <div>
                  <dt className="text-[12.5px] text-muted">Coach penanggung jawab</dt>
                  <dd className="text-sm font-medium text-ink">{coach?.name ?? 'Belum ditentukan'}</dd>
                </div>
              </div>
            </dl>
            {s.note && (
              <p className="mt-4 rounded-control bg-bg px-3 py-2.5 text-[13px] text-muted">{s.note}</p>
            )}
          </div>

          {/* Absensi saya (anggota) */}
          {user!.role === 'anggota' && (
            <div className="card p-4 sm:p-5">
              <h2 className="text-[15px] font-semibold text-ink">Absensi saya</h2>

              {myAttendance ? (
                <Alert
                  tone={
                    myAttendance.status === 'hadir'
                      ? 'success'
                      : myAttendance.status === 'alpha'
                        ? 'error'
                        : 'warning'
                  }
                  className="mt-3"
                  title={`Status: ${ATTENDANCE_LABEL[myAttendance.status]}`}
                >
                  {myAttendance.status === 'hadir'
                    ? `Absensi terkonfirmasi pada pukul ${formatDateTimeID(myAttendance.checkInAt).split(', ')[1]}.`
                    : myAttendance.status === 'menunggu'
                      ? `Check-in tercatat pukul ${formatDateTimeID(myAttendance.checkInAt).split(', ')[1]}. Menunggu konfirmasi coach/pengurus.`
                      : 'Status kehadiran Anda pada sesi ini telah dicatat pengurus.'}
                </Alert>
              ) : status === 'dibatalkan' ? (
                <Alert tone="error" className="mt-3">
                  Sesi ini dibatalkan, sehingga check-in tidak tersedia.
                </Alert>
              ) : checkIn.ok ? (
                <>
                  <p className="mt-2 text-sm text-muted">
                    Sesi sedang berlangsung. Tekan tombol di bawah untuk mencatat kehadiran Anda.
                  </p>
                  <Button
                    size="lg"
                    variant="accent"
                    icon="check-circle"
                    className="mt-3"
                    loading={checking}
                    onClick={() => void doCheckIn()}
                  >
                    Check-in Sekarang
                  </Button>
                  <p className="mt-2 text-[12.5px] text-muted">
                    Pastikan Anda benar-benar hadir di lokasi latihan. Kehadiran akan dikonfirmasi oleh coach.
                  </p>
                </>
              ) : (
                <Alert tone="info" className="mt-3" title="Check-in belum tersedia">
                  {checkIn.reason}
                </Alert>
              )}

              {isPast && !myAttendance && (
                <p className="mt-3 text-[12.5px] text-muted">
                  Anda tidak tercatat hadir pada sesi ini. Hubungi pengurus bila perlu koreksi.
                </p>
              )}
            </div>
          )}

          {/* Daftar peserta (coach/pengurus) */}
          {(isManager || isCoachOfSession) && (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-ink">Daftar hadir peserta</h2>
                <div className="relative w-full sm:w-72">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                    <Icon name="search" size={17} />
                  </span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari nama atau email…"
                    aria-label="Cari peserta"
                    className="field-input pl-10"
                  />
                </div>
              </div>

              {menunggu > 0 && (
                <Alert tone="info" className="mb-3" title={`${menunggu} check-in menunggu konfirmasi`}>
                  Konfirmasi kehadiran anggota lewat tombol Hadir / Izin / Tidak hadir pada kolom aksi.
                </Alert>
              )}

              {members.loading || attendance.loading ? (
                <div className="card">
                  <ListSkeleton rows={5} />
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  rows={filteredParticipants}
                  rowKey={(p) => p.userId}
                  caption={`Daftar hadir ${s.title}`}
                  emptyTitle="Peserta tidak ditemukan"
                  emptyDescription={`Tidak ada peserta yang cocok dengan pencarian "${query}".`}
                  renderMobileCard={(p) => (
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{p.name}</p>
                          <p className="truncate text-[12.5px] text-muted">{p.email}</p>
                        </div>
                        {p.status === 'belum' ? (
                          <StatusBadge tone="neutral" icon="clock">
                            Belum hadir
                          </StatusBadge>
                        ) : (
                          <StatusBadge tone={ATTENDANCE_TONE[p.status]}>{ATTENDANCE_LABEL[p.status]}</StatusBadge>
                        )}
                      </div>
                      {canManage && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {(['hadir', 'izin', 'alpha'] as const).map((v) => (
                            <Button
                              key={v}
                              size="sm"
                              variant={p.status === v ? 'primary' : 'secondary'}
                              loading={updating === p.userId}
                              onClick={() => void setStatus(p.userId, v)}
                            >
                              {ATTENDANCE_LABEL[v]}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                />
              )}

              {isCoachOfSession && (
                <p className="mt-3 text-[12.5px] text-muted">
                  Sebagai coach sesi ini, Anda dapat mengonfirmasi atau mengoreksi kehadiran peserta.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Ringkasan kehadiran */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="card p-4">
            <h2 className="text-[15px] font-semibold text-ink">Ringkasan kehadiran</h2>
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted">
                  <Icon name="check-circle" size={17} className="text-success" />
                  Hadir
                </span>
                <span className="text-lg font-bold text-ink">{hadir}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted">
                  <Icon name="clock" size={17} className="text-warning" />
                  Izin
                </span>
                <span className="text-lg font-bold text-ink">{izin}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted">
                  <Icon name="refresh" size={17} className="text-info" />
                  Menunggu konfirmasi
                </span>
                <span className="text-lg font-bold text-ink">{menunggu}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted">
                  <Icon name="x" size={17} className="text-muted" />
                  Belum tercatat
                </span>
                <span className="text-lg font-bold text-ink">{belum}</span>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg">
              <div
                className="h-full bg-success"
                style={{ width: `${participants.length ? (hadir / participants.length) * 100 : 0}%` }}
              />
            </div>
            <p className="mt-2 text-[12.5px] text-muted">
              {participants.length ? Math.round((hadir / participants.length) * 100) : 0}% anggota telah hadir.
            </p>
          </div>

          <div className="card p-4">
            <h2 className="text-[15px] font-semibold text-ink">Aksi</h2>
            <div className="mt-3 space-y-2">
              <Link to="/app/jadwal" className={buttonClasses('secondary', 'md', 'w-full')}>
                <Icon name="calendar" size={17} />
                Semua Jadwal
              </Link>
              {isManager && (
                <>
                  <button
                    type="button"
                    className={buttonClasses('secondary', 'md', 'w-full')}
                    onClick={() => navigate('/app/absensi')}
                  >
                    <Icon name="chart" size={17} />
                    Rekap Absensi
                  </button>
                  <p className="text-[12.5px] text-muted">
                    Ekspor rekap tersedia pada halaman Rekap Absensi (CSV).
                  </p>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
