import type { CSSProperties } from 'react'
import type { LandingActivityItem } from '@/types.landing'

/** Nilai default crop: fokus di tengah tanpa zoom (sama seperti `object-cover` biasa). */
export const ACTIVITY_CROP_DEFAULT = { focusX: 50, focusY: 50, zoom: 1 } as const

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * Gaya CSS untuk menampilkan foto kegiatan pada bingkai 16:9.
 * `focusX`/`focusY` (0–100%) menggeser bagian foto yang terlihat,
 * `zoom` (1–3) memperbesar foto di dalam bingkai.
 */
export function activityCropStyle(
  item: Pick<LandingActivityItem, 'focusX' | 'focusY' | 'zoom'>,
): CSSProperties {
  const focusX = clamp(item.focusX ?? ACTIVITY_CROP_DEFAULT.focusX, 0, 100)
  const focusY = clamp(item.focusY ?? ACTIVITY_CROP_DEFAULT.focusY, 0, 100)
  const zoom = clamp(item.zoom ?? ACTIVITY_CROP_DEFAULT.zoom, 1, 3)

  return {
    objectPosition: `${focusX}% ${focusY}%`,
    transform: zoom === 1 ? undefined : `scale(${zoom})`,
  }
}
