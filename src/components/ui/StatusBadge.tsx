import { cn } from '@/lib/session'
import { Icon, type IconName } from './Icon'

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent' | 'primary'

const TONES: Record<StatusTone, string> = {
  success: 'border-success/25 bg-success/10 text-success',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  danger: 'border-danger/25 bg-danger/10 text-danger',
  info: 'border-info/25 bg-info/10 text-info',
  neutral: 'border-line bg-bg text-muted',
  accent: 'border-accent/35 bg-accent/15 text-[#8a4a04]',
  primary: 'border-primary/25 bg-primary/10 text-primary',
}

interface StatusBadgeProps {
  tone?: StatusTone
  icon?: IconName
  children: React.ReactNode
  className?: string
}

/** Status selalu memakai teks + ikon, bukan warna saja (sesuai spesifikasi aksesibilitas). */
export function StatusBadge({ tone = 'neutral', icon, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-none',
        TONES[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  )
}

export const SESSION_TONE: Record<string, StatusTone> = {
  'akan-datang': 'info',
  berlangsung: 'success',
  selesai: 'neutral',
  dibatalkan: 'danger',
}

export const SESSION_LABEL: Record<string, string> = {
  'akan-datang': 'Akan datang',
  berlangsung: 'Sedang berlangsung',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

export const SESSION_ICON: Record<string, IconName> = {
  'akan-datang': 'calendar',
  berlangsung: 'check-circle',
  selesai: 'check',
  dibatalkan: 'x',
}

export const ATTENDANCE_TONE: Record<string, StatusTone> = {
  hadir: 'success',
  izin: 'warning',
  alpha: 'danger',
}

export const ATTENDANCE_LABEL: Record<string, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  alpha: 'Tidak hadir',
}

export const PRIORITY_TONE: Record<string, StatusTone> = {
  tinggi: 'danger',
  normal: 'info',
  rendah: 'neutral',
}

export const REGISTRATION_TONE: Record<string, StatusTone> = {
  baru: 'warning',
  diverifikasi: 'success',
  ditolak: 'danger',
}

export const REGISTRATION_LABEL: Record<string, string> = {
  baru: 'Baru',
  diverifikasi: 'Diverifikasi',
  ditolak: 'Ditolak',
}
