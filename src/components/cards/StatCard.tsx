import type { ReactNode } from 'react'
import { cn } from '@/lib/session'
import { Icon, type IconName } from '@/components/ui/Icon'

type StatTone = 'primary' | 'success' | 'danger' | 'accent' | 'info' | 'neutral' | 'warning'

const ICON_TONES: Record<StatTone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  accent: 'bg-accent/15 text-accent-ink',
  info: 'bg-info/10 text-info',
  neutral: 'bg-bg text-muted',
  warning: 'bg-warning/10 text-warning',
}

interface StatCardProps {
  label: string
  value: ReactNode
  icon?: IconName
  tone?: StatTone
  hint?: ReactNode
  className?: string
}

export function StatCard({ label, value, icon, tone = 'primary', hint, className }: StatCardProps) {
  return (
    <div className={cn('card flex items-start gap-3.5 p-4', className)}>
      {icon && (
        <span className={cn('flex h-10 w-10 flex-none items-center justify-center rounded-control', ICON_TONES[tone])}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <p className="mt-0.5 truncate text-[22px] font-bold leading-tight text-ink">{value}</p>
        {hint && <div className="mt-1 text-[12.5px] text-muted">{hint}</div>}
      </div>
    </div>
  )
}
