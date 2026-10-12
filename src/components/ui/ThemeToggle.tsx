import { cn } from '@/lib/session'
import { useTheme } from '@/context/ThemeContext'
import { Icon } from './Icon'

interface ThemeToggleProps {
  className?: string
  /** Tampilkan teks label di samping ikon (mis. di sidebar). */
  withLabel?: boolean
  /** Buat tombol selebar penuh (dipakai di sidebar). */
  block?: boolean
}

/** Tombol pengalih mode terang/gelap. Pilihan disimpan di localStorage. */
export function ThemeToggle({ className, withLabel = false, block = false }: ThemeToggleProps) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Mode terang' : 'Mode gelap'

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control border border-line text-ink transition-colors duration-ui hover:bg-bg',
        withLabel ? 'min-h-[44px] px-4 text-sm font-semibold' : 'h-10 w-10',
        block && 'w-full justify-start',
        className,
      )}
      aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      aria-pressed={isDark}
      title={isDark ? 'Mode terang' : 'Mode gelap'}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={withLabel ? 18 : 19} />
      {withLabel && <span>{isDark ? 'Mode terang' : 'Mode gelap'}</span>}
    </button>
  )
}
