import type { ReactNode } from 'react'
import { cn } from '@/lib/session'
import { Icon, type IconName } from './Icon'
import { Spinner } from './Button'

type AlertTone = 'success' | 'error' | 'warning' | 'info'

const TONES: Record<AlertTone, { box: string; icon: string }> = {
  success: { box: 'border-success/30 bg-success/10', icon: 'text-success' },
  error: { box: 'border-danger/30 bg-danger/10', icon: 'text-danger' },
  warning: { box: 'border-warning/30 bg-warning/10', icon: 'text-warning' },
  info: { box: 'border-info/30 bg-info/10', icon: 'text-info' },
}

const ICONS: Record<AlertTone, IconName> = {
  success: 'check-circle',
  error: 'alert',
  warning: 'alert',
  info: 'info',
}

interface AlertProps {
  tone?: AlertTone
  title?: string
  children?: ReactNode
  className?: string
  action?: ReactNode
}

export function Alert({ tone = 'info', title, children, className, action }: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-card border p-3.5', TONES[tone].box, className)}
    >
      <Icon name={ICONS[tone]} size={19} className={cn('mt-0.5 flex-none', TONES[tone].icon)} />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold text-ink">{title}</p>}
        {children && <div className={cn('text-sm text-ink/80', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  )
}

interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon = 'inbox', title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-bg text-muted ring-1 ring-line">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger ring-1 ring-danger/20">
        <Icon name="alert" size={26} />
      </span>
      <h3 className="text-base font-semibold text-ink">Gagal memuat data</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="link mt-4 text-sm">
          Coba lagi
        </button>
      )}
    </div>
  )
}

function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-control bg-line/60', className)} aria-hidden="true" />
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-5" aria-hidden="true">
      <LoadingSkeleton className="h-5 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <LoadingSkeleton key={i} className={cn('h-4', i % 2 ? 'w-4/5' : 'w-full')} />
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4 p-4">
          <LoadingSkeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <LoadingSkeleton className="h-4 w-2/5" />
            <LoadingSkeleton className="h-3.5 w-3/5" />
          </div>
          <LoadingSkeleton className="hidden h-7 w-24 rounded-full sm:block" />
        </div>
      ))}
      <span className="sr-only">Memuat data…</span>
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface" role="status" aria-label="Memuat data">
      <div className="flex gap-4 border-b border-line bg-bg/70 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-line px-4 py-4 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <LoadingSkeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PageLoading({ label = 'Memuat halaman…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted">
      <Spinner className="h-7 w-7 text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
