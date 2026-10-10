import { randomUUID } from 'node:crypto'

/** Membuat id pendek berprefiks, mis. `s-3f9a1c2b`. */
export function newId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 8)}`
}
