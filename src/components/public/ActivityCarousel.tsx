import { useEffect, useRef, useState } from 'react'
import type { LandingActivityItem } from '@/types.landing'
import { Icon } from '@/components/ui/Icon'
import { activityCropStyle } from '@/lib/imageCrop'

interface ActivityCarouselProps {
  items: LandingActivityItem[]
  autoPlayMs?: number
}

/**
 * Carousel foto kegiatan klub (landing page). Menampilkan satu slide per waktu
 * dengan tombol prev/next, indikator titik, dan autoplay yang berhenti saat
 * pengguna mengarahkan kursor (hover) atau fokus ke carousel.
 */
export function ActivityCarousel({ items, autoPlayMs = 5000 }: ActivityCarouselProps) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const count = items.length
  const safeIndex = count === 0 ? 0 : ((index % count) + count) % count

  useEffect(() => {
    if (count <= 1 || paused) return
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % count)
    }, autoPlayMs)
    return () => window.clearInterval(t)
  }, [count, paused, autoPlayMs])

  // Reset indeks bila daftar berubah (mis. item dihapus).
  useEffect(() => {
    setIndex(0)
  }, [count])

  // Navigasi keyboard.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex((i) => (i - 1 + count) % count)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIndex((i) => (i + 1) % count)
      }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [count])

  if (count === 0) return null

  const go = (next: number) => setIndex(((next % count) + count) % count)

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-card border border-line bg-surface shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Foto kegiatan klub"
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${safeIndex * 100}%)` }}
      >
        {items.map((item, i) => (
          <figure
            key={item.id}
            className="relative m-0 w-full shrink-0"
            aria-hidden={i !== safeIndex}
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-bg">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title || 'Foto kegiatan'}
                  className="h-full w-full object-cover"
                  style={activityCropStyle(item)}
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted">
                  Belum ada gambar
                </div>
              )}
            </div>
            {(item.title || item.description) && (
              <figcaption className="space-y-1 p-4 sm:p-5">
                {item.title && <p className="text-[15px] font-semibold text-ink">{item.title}</p>}
                {item.description && <p className="text-[13.5px] text-muted">{item.description}</p>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(safeIndex - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-surface/80 p-2 text-ink shadow-md ring-1 ring-line/60 backdrop-blur transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="Foto sebelumnya"
          >
            <Icon name="chevron-left" size={20} />
          </button>
          <button
            type="button"
            onClick={() => go(safeIndex + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-surface/80 p-2 text-ink shadow-md ring-1 ring-line/60 backdrop-blur transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="Foto berikutnya"
          >
            <Icon name="chevron-right" size={20} />
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(i)}
                className={`h-2 rounded-full transition-all ${
                  i === safeIndex ? 'w-6 bg-brand' : 'w-2 bg-ink/25 hover:bg-ink/40'
                }`}
                aria-label={`Lihat foto ${i + 1}`}
                aria-current={i === safeIndex}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
