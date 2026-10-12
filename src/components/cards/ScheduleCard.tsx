import { Link } from 'react-router-dom'
import type { Session, Coach } from '@/types'
import { cn } from '@/lib/session'
import { formatDateID, formatTimeRange, relativeDayID } from '@/lib/date'
import { sessionStatus } from '@/lib/session'
import { Icon } from '@/components/ui/Icon'
import { StatusBadge, SESSION_ICON, SESSION_LABEL, SESSION_TONE } from '@/components/ui/StatusBadge'

interface ScheduleCardProps {
  session: Session
  coach?: Coach | null
  to?: string
  className?: string
  compact?: boolean
  action?: React.ReactNode
}

export function ScheduleCard({ session, coach, to, className, compact, action }: ScheduleCardProps) {
  const status = sessionStatus(session)

  // Isi kartu (informasi sesi) — TIDAK memuat tombol aksi, supaya tombol
  // Edit/Hapus tidak berada di dalam tautan detail.
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">
            {relativeDayID(session.date)}
          </p>
          <h3 className="mt-0.5 text-[17px] font-semibold leading-snug text-ink">{session.title}</h3>
        </div>
        <StatusBadge tone={SESSION_TONE[status]} icon={SESSION_ICON[status]}>
          {SESSION_LABEL[status]}
        </StatusBadge>
      </div>

      <dl className={cn('mt-3 grid gap-x-4 gap-y-1.5 text-[13.5px] text-muted', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
        <div className="flex items-center gap-2">
          <Icon name="calendar" size={16} className="flex-none text-primary/70" />
          <dt className="sr-only">Tanggal</dt>
          <dd>{formatDateID(session.date)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="clock" size={16} className="flex-none text-primary/70" />
          <dt className="sr-only">Waktu</dt>
          <dd>{formatTimeRange(session.startTime, session.endTime)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="pin" size={16} className="flex-none text-primary/70" />
          <dt className="sr-only">Lokasi</dt>
          <dd className="truncate">{session.location}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="user" size={16} className="flex-none text-primary/70" />
          <dt className="sr-only">Coach</dt>
          <dd className="truncate">{coach ? coach.name : 'Belum ditentukan'}</dd>
        </div>
      </dl>

      {session.note && (
        <p className="mt-3 rounded-control bg-bg px-3 py-2 text-[13px] text-muted">{session.note}</p>
      )}
    </>
  )

  const detailLabel = (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
      Lihat detail
      <Icon name="chevron-right" size={16} />
    </span>
  )

  // Tanpa tautan detail: cukup kartu biasa (mis. di dasbor dengan tombol aksi).
  if (!to) {
    return (
      <div className={cn('card p-4', className)}>
        {content}
        {action && <div className="mt-4 flex items-center justify-between gap-3">{action}</div>}
      </div>
    )
  }

  // Dengan tautan detail: bagian informasi dibuat tautan, sedangkan tombol aksi
  // diletakkan DI LUAR tautan supaya klik tombol tidak ikut membuka halaman detail.
  return (
    <div className={cn('card p-4 transition-all duration-ui hover:border-primary/40 hover:shadow-soft', className)}>
      <Link to={to} className="block">
        {content}
      </Link>
      <div className="mt-4 flex items-center justify-between gap-3">
        {action}
        <Link to={to} className="ml-auto">
          {detailLabel}
        </Link>
      </div>
    </div>
  )
}
