import * as live from './live'
import * as mock from './mock'

/**
 * Titik tukar tunggal antara data demo (mock) dan API backend asli.
 *
 * Atur lewat file `.env` di root proyek:
 *   VITE_API_MODE=live   -> memakai backend Express + PostgreSQL (folder server/)
 *   VITE_API_MODE=mock   -> memakai data demo di localStorage (tanpa server)
 *   VITE_API_URL=/api    -> URL dasar API (default)
 *
 * Karena `live.ts` harus meniru bentuk `mock.ts`, anotasi `typeof mock` di bawah
 * membuat TypeScript memastikan kedua klien tetap kompatibel.
 */

export const API_MODE: 'mock' | 'live' = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock'

const impl: typeof mock = API_MODE === 'live' ? live : mock

export const authApi = impl.authApi
export const uploadApi = impl.uploadApi
export const landingApi = impl.landingApi
export const userApi = impl.userApi
export const sessionApi = impl.sessionApi
export const attendanceApi = impl.attendanceApi
export const announcementApi = impl.announcementApi
export const coachApi = impl.coachApi
export const registrationApi = impl.registrationApi
export const treasuryApi = impl.treasuryApi
export const syncApi = impl.syncApi
export const auditApi = impl.auditApi
export const statsApi = impl.statsApi

// Password akun demo yang dipakai halaman masuk (sama untuk mock & API).
export const DEMO_PASSWORD = impl.DEMO_PASSWORD

export type { AttendanceRow, AuthSession, SessionInput, TreasurySummary, UploadResult } from './types'
