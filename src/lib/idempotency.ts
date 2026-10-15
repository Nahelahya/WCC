/**
 * Kunci idempotensi untuk checkout pembayaran: satu UUID unik per niat bayar.
 * Dikirim sebagai `idempotencyKey` agar klik ganda / retry jaringan
 * mengembalikan invoice yang sama, bukan invoice baru.
 */
export function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* abaikan — pakai cadangan di bawah */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
}

/** True bila error API adalah 409 Conflict (kunci dipakai sesi kedaluwarsa). */
export function isConflictError(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 409
}
