import { Link } from 'react-router-dom'
import { coachApi, sessionApi } from '@/api/client'
import { useAsync } from '@/lib/hooks'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { LogoMark } from '@/components/ui/Logo'
import { ScheduleCard } from '@/components/cards/ScheduleCard'
import { CoachCard } from '@/components/cards/CoachCard'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/Feedback'
import { todayISO } from '@/lib/date'
import { StatusBadge } from '@/components/ui/StatusBadge'

const STEPS = [
  { title: 'Isi formulir pendaftaran', desc: 'Lengkapi data dasar dan alasan bergabung melalui halaman pendaftaran.' },
  { title: 'Verifikasi pengurus', desc: 'Pengurus meninjau data. Proses maksimal 2 hari kerja.' },
  { title: 'Ikuti orientasi', desc: 'Sesi pengenalan alat, keselamatan, dan aturan latihan.' },
  { title: 'Mulai latihan rutin', desc: 'Lakukan absensi digital pada setiap sesi latihan.' },
]

export function LandingPage() {
  const sessions = useAsync(() => sessionApi.list(), [])
  const coaches = useAsync(() => coachApi.list(), [])
  const today = todayISO()

  const upcoming = (sessions.data ?? [])
    .filter((s) => !s.cancelled && s.date >= today)
    .slice(0, 3)

  const coachList = (coaches.data ?? []).slice(0, 3)

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #F28C28 0, transparent 42%), radial-gradient(circle at 85% 10%, #ffffff 0, transparent 38%)',
          }}
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold tracking-wide">
              <Icon name="mountain" size={15} />
              Komunitas Panjat Tebing
            </span>
            <h1 className="mt-5 text-[34px] font-bold leading-[1.12] tracking-tight sm:text-[46px]">
              Naik lebih tinggi bersama
              <span className="text-accent"> WISANGGENI CLIMBING CLUB</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/80 sm:text-base">
              Klub panjat tebing dengan latihan rutin, pembinaan berjenjang, dan pencatatan
              kehadiran digital. Satu pintu untuk jadwal, absensi, pengumuman, dan informasi klub.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/daftar" className={buttonClasses('accent', 'lg')}>
                <Icon name="plus" size={18} />
                Daftar Menjadi Anggota
              </Link>
              <Link
                to="/masuk"
                className={buttonClasses('secondary', 'lg', 'border-white/30 bg-white/10 text-white hover:bg-white/20')}
              >
                Login Anggota
              </Link>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/20 pt-6">
              {[
                { k: '150+', v: 'Anggota aktif' },
                { k: '5', v: 'Coach berlisensi' },
                { k: '4×', v: 'Latihan per minggu' },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="text-2xl font-bold text-accent">{s.k}</dt>
                  <dd className="mt-0.5 text-[12.5px] text-white/70">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Visual: memakai aset logo klub. Foto kegiatan dapat diganti pemilik produk. */}
          <div className="relative">
            <div className="rounded-card border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
              <div className="flex items-center justify-center rounded-card bg-white/95 p-6">
                <LogoMark size={104} />
              </div>
              <p className="mt-4 text-center text-[12.5px] text-white/70">
                Area foto kegiatan klub — siap diganti dengan foto dokumentasi.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
                <div className="rounded-control bg-white/10 p-3">
                  <p className="font-semibold text-white">Dinding FPTI</p>
                  <p className="mt-0.5 text-white/70">Lead · Top Rope · Speed</p>
                </div>
                <div className="rounded-control bg-white/10 p-3">
                  <p className="font-semibold text-white">Bouldering WCC</p>
                  <p className="mt-0.5 text-white/70">Latihan rutin pemula</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tentang */}
      <section id="tentang" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <StatusBadge tone="accent" icon="mountain">
              Tentang Klub
            </StatusBadge>
            <h2 className="mt-4 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">
              Wadah latihan, pembinaan, dan kebersamaan
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              WISANGGENI CLIMBING CLUB menghimpun anggota dari berbagai tingkat kemampuan, dari
              pemula yang baru mengenal panjat tebing hingga atlet yang berlatih untuk kompetisi.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Seluruh kegiatan klub — jadwal, absensi, pengumuman, hingga kas dan iuran — dikelola
              dalam satu sistem digital agar transparan dan mudah diakses anggota.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: 'calendar' as const, title: 'Latihan terjadwal', desc: 'Empat sesi per minggu dengan coach penanggung jawab.' },
              { icon: 'check-circle' as const, title: 'Absensi digital', desc: 'Check-in pada sesi berlangsung, riwayat tercatat otomatis.' },
              { icon: 'users' as const, title: 'Pembinaan berjenjang', desc: 'Pemula, menengah, dan tim kompetisi.' },
              { icon: 'shield' as const, title: 'Standar keselamatan', desc: 'Pengecekan alat dan prosedur keselamatan setiap sesi.' },
            ].map((f) => (
              <div key={f.title} className="card p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-control bg-primary/10 text-primary">
                  <Icon name={f.icon} size={20} />
                </span>
                <h3 className="mt-3 text-[15.5px] font-semibold text-ink">{f.title}</h3>
                <p className="mt-1 text-[13.5px] text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Jadwal mendatang */}
      <section id="jadwal" className="scroll-mt-20 border-y border-line bg-surface/70 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <StatusBadge tone="info" icon="calendar">
                Jadwal Mendatang
              </StatusBadge>
              <h2 className="mt-3 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">
                Aktivitas latihan terdekat
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                Jadwal publik hanya menampilkan informasi sesi. Data absensi anggota tidak dipublikasikan.
              </p>
            </div>
            <Link to="/masuk" className={buttonClasses('secondary', 'md', 'hidden sm:inline-flex')}>
              Lihat semua jadwal
              <Icon name="arrow-right" size={17} />
            </Link>
          </div>

          {sessions.loading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : sessions.error ? (
            <div className="card">
              <ErrorState message={sessions.error} onRetry={sessions.reload} />
            </div>
          ) : upcoming.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="calendar"
                title="Belum ada jadwal latihan mendatang."
                description="Jadwal baru akan tampil di sini setelah pengurus mempublikasikannya."
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((s) => (
                <ScheduleCard
                  key={s.id}
                  session={s}
                  coach={coaches.data?.find((c) => c.id === s.coachId) ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Coach */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <StatusBadge tone="primary" icon="users">
              Profil Coach
            </StatusBadge>
            <h2 className="mt-3 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">
              Dibimbing coach berpengalaman
            </h2>
          </div>
          <Link to="/coach" className={buttonClasses('secondary', 'md')}>
            Lihat semua coach
            <Icon name="arrow-right" size={17} />
          </Link>
        </div>

        {coaches.loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} lines={2} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {coachList.map((c) => (
              <CoachCard key={c.id} coach={c} />
            ))}
          </div>
        )}
      </section>

      {/* Cara bergabung */}
      <section className="border-y border-line bg-surface/70 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <StatusBadge tone="accent" icon="list">
            Cara Bergabung
          </StatusBadge>
          <h2 className="mt-3 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">
            Empat langkah menjadi anggota
          </h2>
          <ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-[15.5px] font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-[13.5px] text-muted">{s.desc}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/daftar" className={buttonClasses('primary', 'lg')}>
              Isi Formulir Pendaftaran
            </Link>
            <Link to="/daftar/status" className={buttonClasses('secondary', 'lg')}>
              Cek Status Pendaftaran
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="overflow-hidden rounded-card bg-primary px-6 py-10 text-center text-white sm:px-12 sm:py-14">
          <h2 className="text-[26px] font-bold leading-tight sm:text-[32px]">
            Siap mulai latihan bersama kami?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/80">
            Buat akun, ikuti orientasi, dan catat kehadiran latihan Anda secara digital.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/daftar" className={buttonClasses('accent', 'lg')}>
              Gabung Sekarang
            </Link>
            <Link
              to="/masuk"
              className={buttonClasses('secondary', 'lg', 'border-white/30 bg-white/10 text-white hover:bg-white/20')}
            >
              Sudah punya akun? Masuk
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
