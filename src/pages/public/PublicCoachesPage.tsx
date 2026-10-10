import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { coachApi, sessionApi } from '@/api/client'
import { useAsync } from '@/lib/hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { CoachCard } from '@/components/cards/CoachCard'
import { CardSkeleton, ErrorState, EmptyState } from '@/components/ui/Feedback'
import { buttonClasses } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

export function PublicCoachesPage() {
  const coaches = useAsync(() => coachApi.list(), [])
  const sessions = useAsync(() => sessionApi.list(), [])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    ;(sessions.data ?? []).forEach((s) => {
      map[s.coachId] = (map[s.coachId] ?? 0) + 1
    })
    return map
  }, [sessions.data])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        title="Profil Coach"
        description="Coach WISANGGENI CLIMBING CLUB beserta keahlian dan pengalaman mendampingi anggota."
        breadcrumb={
          <Link to="/" className="hover:text-primary">
            Beranda
          </Link>
        }
        action={
          <Link to="/daftar" className={buttonClasses('accent', 'md')}>
            <Icon name="plus" size={17} />
            Gabung
          </Link>
        }
      />

      {coaches.loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <CardSkeleton key={i} lines={2} />
          ))}
        </div>
      ) : coaches.error ? (
        <div className="card">
          <ErrorState message={coaches.error} onRetry={coaches.reload} />
        </div>
      ) : (coaches.data ?? []).length === 0 ? (
        <div className="card">
          <EmptyState icon="users" title="Belum ada data coach" description="Data coach belum dipublikasikan pengurus." />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(coaches.data ?? []).map((c) => (
            <CoachCard key={c.id} coach={c} sessionsCount={counts[c.id] ?? 0} />
          ))}
        </div>
      )}
    </div>
  )
}

const STEPS = [
  {
    title: 'Isi formulir pendaftaran',
    desc: 'Sediakan nama lengkap, email aktif, dan nomor kontak. Ceritakan pengalaman panjat tebing Anda bila ada.',
  },
  {
    title: 'Setujui pemrosesan data',
    desc: 'Data pribadi hanya digunakan untuk administrasi keanggotaan klub dan tidak dibagikan ke pihak lain.',
  },
  {
    title: 'Tunggu verifikasi pengurus',
    desc: 'Pengurus meninjau pendaftaran maksimal 2 hari kerja. Status dapat dipantau pada halaman cek status.',
  },
  {
    title: 'Ikuti sesi orientasi',
    desc: 'Pengenalan alat, prosedur keselamatan, dan aturan latihan bersama coach.',
  },
  {
    title: 'Terima akses akun',
    desc: 'Setelah diverifikasi, Anda menerima akses login untuk melihat jadwal dan melakukan absensi.',
  },
]

export function HowToJoinPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        title="Cara Bergabung"
        description="Ikuti langkah berikut untuk menjadi anggota WISANGGENI CLIMBING CLUB."
        breadcrumb={
          <Link to="/" className="hover:text-primary">
            Beranda
          </Link>
        }
      />

      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card flex gap-4 p-4">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {i + 1}
            </span>
            <div>
              <h2 className="text-[15.5px] font-semibold text-ink">{s.title}</h2>
              <p className="mt-1 text-[13.5px] text-muted">{s.desc}</p>
            </div>
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
  )
}
