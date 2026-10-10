import type { ReactNode } from 'react'
import { cn } from '@/lib/session'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  breadcrumb?: ReactNode
  className?: string
}

export function PageHeader({ title, description, action, breadcrumb, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-5', className)}>
      {breadcrumb && <div className="mb-2 text-[13px] text-muted">{breadcrumb}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        {action && <div className="flex flex-none flex-wrap items-center gap-2">{action}</div>}
      </div>
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  )
}
