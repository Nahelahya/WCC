import { Link } from 'react-router-dom'
import type { Announcement } from '@/types'
import { cn } from '@/lib/session'
import { formatDateID, localDateOf } from '@/lib/date'
import { Icon } from '@/components/ui/Icon'
import { PRIORITY_TONE, StatusBadge } from '@/components/ui/StatusBadge'

interface AnnouncementCardProps {
  announcement: Announcement
  to?: string
  className?: string
  showDraft?: boolean
}

const PRIORITY_LABEL: Record<string, string> = {
  tinggi: 'Prioritas tinggi',
  normal: 'Informasi',
  rendah: 'Rendah',
}

export function AnnouncementCard({ announcement, to, className, showDraft }: AnnouncementCardProps) {
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={PRIORITY_TONE[announcement.priority]} icon={announcement.priority === 'tinggi' ? 'alert' : 'info'}>
          {PRIORITY_LABEL[announcement.priority]}
        </StatusBadge>
        {showDraft && !announcement.published && <StatusBadge tone="neutral">Draf</StatusBadge>}
        <span className="text-[12.5px] text-muted">{formatDateID(localDateOf(announcement.publishedAt))}</span>
      </div>
      <h3 className="mt-2.5 text-[17px] font-semibold leading-snug text-ink">{announcement.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted">{announcement.summary}</p>
      {announcement.imageUrl && (
        <img
          src={announcement.imageUrl}
          alt=""
          loading="lazy"
          className="mt-3 h-40 w-full rounded-control border border-line object-cover"
        />
      )}
      <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
        <Icon name="user" size={14} />
        <span>{announcement.author}</span>
        {to && (
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary">
            Baca
            <Icon name="chevron-right" size={15} />
          </span>
        )}
      </div>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className={cn('card block p-4 transition-all duration-ui hover:border-primary/40 hover:shadow-soft', className)}
      >
        {content}
      </Link>
    )
  }

  return <div className={cn('card p-4', className)}>{content}</div>
}
