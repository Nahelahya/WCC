import { useState } from 'react'
import { Link } from 'react-router-dom'
import { coachApi, statsApi, attendanceApi, announcementApi } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/lib/hooks'
import { PageHeader, SectionHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/cards/StatCard'
import { ScheduleCard } from '@/components/cards/ScheduleCard'
import { AnnouncementCard } from '@/components/cards/AnnouncementCard'
import { CardSkeleton, EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { StatusBadge, SESSION_TONE, SESSION_LABEL, SESSION_ICON, ATTENDANCE_TONE, ATTENDANCE_LABEL } from '@/components/ui/StatusBadge'
import { buttonClasses } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Field'
import { currentMonth, formatDateID, formatDateTimeID, formatMonthID, formatRupiah, monthRange, relativeDayID } from '@/lib/date'
import { sessionStatus } from '@/lib/session'

export function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null
  if (user.role === 'coach') return <CoachDashboard />
  if (user.role === 'pengurus') return <AdminDashboard />
  return <MemberDashboard />
}

/* ------------------------------- Anggota ------------------------------- */

function MemberDashboard() {
  const { user } = useAuth()
  // Total kehadiran direset setiap bulan; pengguna dapat memilih bulan lain.
  const [month, setMonth] = useState(currentMonth())
  const range = month ? monthRange(month) : undefined
  const stats = useAsync(() => statsApi.memberDashboard(user!.id, range), [user!.id, month])
  const coaches = useAsync(() => coachApi.list(), [])
  const announcements = useAsync(() => announcementApi.list(), [])
  const history = useAsync(() => attendanceApi.byUser(user!.id), [user!.id])

  const next = stats.data?.upcoming?.[0]
  const nextStatus = next ? sessionStatus(next) : null

  return (
    <>
      <PageHeader
        title={`Selamat datang, ${user!.name.split(' ')[0]}`}
        description={`Ringkasan aktivitas latihan Anda. Status keanggotaan: ${
          user!.membershipStatus === 'aktif' ? 'Aktif' : 'Belum aktif'
        }.`}
        action={
          <Link to="/app/jadwal" className={buttonClasses('primary', 'md')}>
            <Icon name="calendar" size={17} />
            Lihat Jadwal
          </Link>
        }
      />

      {stats.loading ? (
        <CardSkeleton lines={2} />
      ) : stats.error ? (
        <div className="card">
          <ErrorState message={stats.error} onRetry={stats.reload} />
        </div>
      ) : next ? (
        <section className="mb-6">
          <div className="rounded-card border border-primary/25 bg-primary/[0.06] p-1">
            <ScheduleCard
              session={next}
              coach={coaches.data?.find((c) => c.id === next.coachId) ?? null}
              className="border-0 shadow-none"
              action={
                nextStatus === 'berlangsung' ? (
                  <Link to={`/app/jadwal/${next.id}`} className={buttonClasses('accent', 'md')}>
                    <Icon name="check-circle" size={18} />
                    Check-in Sekarang
                  </Link>
                ) : (
                  <Link to={`/app/jadwal/${next.id}`} className={buttonClasses('secondary', 'md')}>
                    Detail Sesi
                  </Link>
                )
              }
            />
          </div>
        </section>
      ) : (
        <div className="card mb-6">
          <EmptyState
            icon="calendar"
            title="Belum ada jadwal latihan mendatang."
            description="Jadwal baru akan tampil di sini setelah pengurus menambahkannya."
          />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Kehadiran bulanan</h2>
          <p className="text-[12.5px] text-muted">Total direset setiap bulan.</p>
        </div>
        <div className="w-full sm:w-52">
          <Input label="Bulan" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Hadir"
          value={stats.data?.hadir ?? 0}
          icon="check-circle"
          tone="success"
          hint={month ? formatMonthID(month) : 'Semua periode'}
        />
        <StatCard
          label="Persentase kehadiran"
          value={`${stats.data?.percentage ?? 0}%`}
          icon="chart"
          tone="primary"
          hint={`Dari ${stats.data?.totalSessions ?? 0} sesi`}
        />
        <StatCard
          label="Sesi berlangsung"
          value={(stats.data?.upcoming ?? []).filter((s) => sessionStatus(s) === 'berlangsung').length}
          icon="clock"
          tone="accent"
        />
        <StatCard
          label="Jadwal mendatang"
          value={(stats.data?.upcoming ?? []).length}
          icon="calendar"
          tone="info"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          <SectionHeader
            title="Pengumuman terbaru"
            action={
              <Link to="/app/pengumuman" className="link text-[13px]">
                Lihat semua
              </Link>
            }
          />
          {announcements.loading ? (
            <ListSkeleton rows={3} />
          ) : announcements.error ? (
            <div className="card">
              <ErrorState message={announcements.error} onRetry={announcements.reload} />
            </div>
          ) : (announcements.data ?? []).length === 0 ? (
            <div className="card">
              <EmptyState icon="megaphone" title="Belum ada pengumuman" />
            </div>
          ) : (
            <div className="space-y-3">
              {(announcements.data ?? []).slice(0, 3).map((a) => (
                <AnnouncementCard key={a.id} announcement={a} to={`/app/pengumuman/${a.id}`} />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader
            title="Riwayat absensi"
            action={
              <Link to="/app/absensi" className="link text-[13px]">
                Lihat semua
              </Link>
            }
          />
          {history.loading ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="card divide-y divide-line">
              {(history.data ?? []).slice(0, 5).map((h) => (
                <div key={h.id} className="flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{h.sessionTitle}</p>
                    <p className="text-[12.5px] text-muted">
                      {formatDateID(h.sessionDate)}
                      {h.checkInTime ? ` · check-in ${h.checkInTime}` : ''}
                    </p>
                  </div>
                  <StatusBadge tone={ATTENDANCE_TONE[h.status]}>{ATTENDANCE_LABEL[h.status]}</StatusBadge>
                </div>
              ))}
              {(history.data ?? []).length === 0 && (
                <EmptyState icon="check-circle" title="Belum ada riwayat absensi" />
              )}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

/* -------------------------------- Coach -------------------------------- */

function CoachDashboard() {
  const { user } = useAuth()
  const data = useAsync(() => statsApi.coachDashboard(user!.coachId ?? ''), [user!.coachId])

  const upcoming = data.data?.upcoming ?? []
  const past = data.data?.past ?? []

  return (
    <>
      <PageHeader
        title="Dashboard Coach"
        description="Sesi latihan yang Anda ampu, daftar hadir peserta, dan kas klub."
        action={
          <Link to="/app/kas" className={buttonClasses('primary', 'md')}>
            <Icon name="wallet" size={17} />
            Kas Klub
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Sesi mendatang" value={upcoming.length} icon="calendar" tone="primary" />
        <StatCard
          label="Sesi hari ini"
          value={upcoming.filter((s) => relativeDayID(s.date) === 'Hari ini').length}
          icon="clock"
          tone="accent"
        />
        <StatCard label="Total sesi diampu" value={upcoming.length + past.length} icon="list" tone="info" />
      </div>

      <SectionHeader title="Sesi yang akan diampu" description="Urut berdasarkan jadwal terdekat." />
      {data.loading ? (
        <ListSkeleton rows={3} />
      ) : data.error ? (
        <div className="card">
          <ErrorState message={data.error} onRetry={data.reload} />
        </div>
      ) : upcoming.length === 0 ? (
        <div className="card mb-8">
          <EmptyState icon="calendar" title="Belum ada sesi yang ditugaskan kepada Anda." />
        </div>
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          {upcoming.map((s) => (
            <ScheduleCard
              key={s.id}
              session={s}
              coach={null}
              to={`/app/jadwal/${s.id}`}
              action={
                <Link to={`/app/jadwal/${s.id}`} className={buttonClasses('secondary', 'sm')}>
                  <Icon name="list" size={16} />
                  Buka daftar hadir
                </Link>
              }
            />
          ))}
        </div>
      )}

      <SectionHeader title="Riwayat sesi" />
      <div className="card divide-y divide-line">
        {past.slice(0, 6).map((s) => (
          <Link key={s.id} to={`/app/jadwal/${s.id}`} className="flex items-center gap-3 p-3.5 hover:bg-bg/60">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{s.title}</p>
              <p className="text-[12.5px] text-muted">{formatDateID(s.date)}</p>
            </div>
            <StatusBadge tone={SESSION_TONE[sessionStatus(s)]} icon={SESSION_ICON[sessionStatus(s)]}>
              {SESSION_LABEL[sessionStatus(s)]}
            </StatusBadge>
            <Icon name="chevron-right" size={17} className="text-muted" />
          </Link>
        ))}
        {past.length === 0 && <EmptyState icon="list" title="Belum ada riwayat sesi" />}
      </div>
    </>
  )
}

/* ------------------------------- Pengurus ------------------------------ */

function AdminDashboard() {
  const data = useAsync(() => statsApi.adminDashboard(), [])
  const coaches = useAsync(() => coachApi.list(), [])
  const announcements = useAsync(() => announcementApi.list(true), [])
  const d = data.data

  return (
    <>
      <PageHeader
        title="Dashboard Pengurus"
        description="Ringkasan operasional klub: jadwal, absensi, pendaftaran, dan kas."
        action={
          <Link to="/app/jadwal" className={buttonClasses('primary', 'md')}>
            <Icon name="calendar-plus" size={17} />
            Kelola Jadwal
          </Link>
        }
      />

      {data.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} lines={1} />
          ))}
        </div>
      ) : data.error ? (
        <div className="card">
          <ErrorState message={data.error} onRetry={data.reload} />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Saldo kas terkini"
              value={formatRupiah(d?.balance ?? 0)}
              icon="wallet"
              tone="success"
              hint="Pemasukan dikurangi pengeluaran"
            />
            <StatCard
              label="Pendaftaran menunggu"
              value={d?.pendingRegistrations ?? 0}
              icon="inbox"
              tone="accent"
              hint="Perlu diverifikasi"
            />
            <StatCard label="Anggota terdaftar" value={d?.activeMembers ?? 0} icon="users" tone="primary" />
            <StatCard
              label="Status sinkronisasi"
              value={d?.sync.status === 'success' ? 'Berhasil' : d?.sync.status === 'failed' ? 'Gagal' : 'Menunggu'}
              icon="refresh"
              tone={d?.sync.status === 'success' ? 'success' : d?.sync.status === 'failed' ? 'danger' : 'neutral'}
              hint={d?.sync.lastSyncAt ? formatDateTimeID(d.sync.lastSyncAt) : 'Belum pernah'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section>
              <SectionHeader
                title="Jadwal latihan terdekat"
                action={
                  <Link to="/app/jadwal" className="link text-[13px]">
                    Kelola
                  </Link>
                }
              />
              <div className="space-y-3">
                {(d?.upcoming ?? []).slice(0, 3).map((s) => (
                  <ScheduleCard
                    key={s.id}
                    session={s}
                    coach={coaches.data?.find((c) => c.id === s.coachId) ?? null}
                    to={`/app/jadwal/${s.id}`}
                  />
                ))}
                {(d?.upcoming ?? []).length === 0 && (
                  <div className="card">
                    <EmptyState icon="calendar" title="Belum ada jadwal latihan mendatang." />
                  </div>
                )}
              </div>

              <SectionHeader
                className="mt-8"
                title="Absensi sesi terakhir"
                description={`${d?.recentAttendanceCount ?? 0} catatan hadir pada 3 sesi terakhir.`}
                action={
                  <Link to="/app/absensi" className="link text-[13px]">
                    Rekap
                  </Link>
                }
              />
              <div className="card divide-y divide-line">
                {(d?.recentSessions ?? []).map((s) => (
                  <Link key={s.id} to={`/app/jadwal/${s.id}`} className="flex items-center gap-3 p-3.5 hover:bg-bg/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{s.title}</p>
                      <p className="text-[12.5px] text-muted">{formatDateID(s.date)}</p>
                    </div>
                    <StatusBadge tone="neutral">{SESSION_LABEL[sessionStatus(s)]}</StatusBadge>
                    <Icon name="chevron-right" size={17} className="text-muted" />
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <SectionHeader
                title="Transaksi kas terbaru"
                action={
                  <Link to="/app/kas" className="link text-[13px]">
                    Kelola
                  </Link>
                }
              />
              <div className="card divide-y divide-line">
                {(d?.recentTransactions ?? []).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3.5">
                    <span
                      className={`flex h-9 w-9 flex-none items-center justify-center rounded-control ${
                        t.type === 'pemasukan' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                      }`}
                    >
                      <Icon name={t.type === 'pemasukan' ? 'plus' : 'arrow-right'} size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{t.category}</p>
                      <p className="truncate text-[12.5px] text-muted">{formatDateID(t.date)}</p>
                    </div>
                    <p
                      className={`flex-none text-sm font-semibold ${
                        t.type === 'pemasukan' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {t.type === 'pemasukan' ? '+' : '−'}
                      {formatRupiah(t.amount)}
                    </p>
                  </div>
                ))}
              </div>

              <SectionHeader className="mt-8" title="Status sinkronisasi spreadsheet" />
              <div className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge
                    tone={d?.sync.status === 'success' ? 'success' : d?.sync.status === 'failed' ? 'danger' : 'neutral'}
                    icon="refresh"
                  >
                    {d?.sync.status === 'success' ? 'Berhasil' : d?.sync.status === 'failed' ? 'Gagal' : 'Menunggu'}
                  </StatusBadge>
                  <span className="text-[12.5px] text-muted">
                    {d?.sync.lastSyncAt ? formatDateTimeID(d.sync.lastSyncAt) : 'Belum pernah'}
                  </span>
                </div>
                <p className="mt-3 text-[13px] text-muted">
                  Kolom spreadsheet: Tanggal | Tipe | Kategori | Nominal | Keterangan | Dicatat Oleh
                </p>
                <Link to="/app/sinkronisasi" className={buttonClasses('secondary', 'md', 'mt-4 w-full')}>
                  Buka halaman sinkronisasi
                </Link>
              </div>
            </section>
          </div>

          <SectionHeader className="mt-8" title="Pengumuman terbaru" description="Termasuk draf yang belum dipublikasikan." />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(announcements.data ?? []).slice(0, 3).map((a) => (
              <AnnouncementCard key={a.id} announcement={a} to={`/app/pengumuman/${a.id}`} showDraft />
            ))}
          </div>
        </>
      )}
    </>
  )
}
