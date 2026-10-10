import { cn } from '@/lib/session'

interface LogoProps {
  className?: string
  /** Tinggi logo dalam px. */
  size?: number
  /** Nama klub ditampilkan di samping logo. */
  withWordmark?: boolean
  variant?: 'dark' | 'light'
}

/**
 * Logo resmi klub (public/logo-wcc.png).
 * Gambar memiliki latar transparan/biru; gunakan `variant="light"` di latar gelap.
 */
export function Logo({ className, size = 40, withWordmark = true, variant = 'dark' }: LogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <img
        src="/logo-wcc.png"
        alt="Logo WISANGGENI CLIMBING CLUB"
        height={size}
        style={{ height: size, width: 'auto' }}
        className="flex-none object-contain"
        loading="eager"
      />
      {withWordmark && (
        <span className="min-w-0 leading-tight">
          <span
            className={cn(
              'block truncate text-[13px] font-bold tracking-[0.14em]',
              variant === 'light' ? 'text-white' : 'text-primary',
            )}
          >
            WISANGGENI
          </span>
          <span
            className={cn(
              'block truncate text-[10px] font-semibold tracking-[0.22em]',
              variant === 'light' ? 'text-white/70' : 'text-muted',
            )}
          >
            CLIMBING CLUB
          </span>
        </span>
      )}
    </span>
  )
}

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo-wcc.png"
      alt=""
      aria-hidden="true"
      style={{ height: size, width: 'auto' }}
      className={cn('object-contain', className)}
    />
  )
}
