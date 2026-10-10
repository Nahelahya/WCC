import type { Coach } from '@/types'
import { cn } from '@/lib/session'
import { Icon } from '@/components/ui/Icon'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface CoachCardProps {
  coach: Coach
  sessionsCount?: number
  className?: string
  action?: React.ReactNode
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export function CoachCard({ coach, sessionsCount, className, action }: CoachCardProps) {
  return (
    <div className={cn('card flex flex-col p-4', className)}>
      <div className="flex items-start gap-3.5">
        {coach.photoUrl ? (
          <img
            src={coach.photoUrl}
            alt={`Foto ${coach.name}`}
            className="h-14 w-14 flex-none rounded-full object-cover ring-2 ring-line"
          />
        ) : (
          <span
            className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary ring-2 ring-primary/15"
            aria-hidden="true"
          >
            {initials(coach.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16.5px] font-semibold text-ink">{coach.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
            <Icon name="clock" size={14} />
            {coach.years} tahun pengalaman
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {coach.expertise.map((e) => (
          <StatusBadge key={e} tone="primary">
            {e}
          </StatusBadge>
        ))}
        {sessionsCount !== undefined && (
          <StatusBadge tone="neutral">{sessionsCount} sesi diampu</StatusBadge>
        )}
      </div>

      {coach.bio && <p className="mt-3 text-sm text-muted">{coach.bio}</p>}
      {coach.experience && <p className="mt-2 text-[13px] text-muted">{coach.experience}</p>}

      {action && <div className="mt-4 flex gap-2 border-t border-line pt-3">{action}</div>}
    </div>
  )
}
