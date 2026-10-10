import type {
  Announcement,
  Attendance,
  Coach,
  Database,
  Registration,
  RegistrationStatus,
  Session,
  Transaction,
  User,
} from '@/types'
import { createSeedDatabase, DB_KEY, DB_VERSION, refreshDemoDates } from '@/data/seed'
import { todayISO } from '@/lib/date'
import { canCheckIn } from '@/lib/session'
import type { AttendanceRow, AuthSession, SessionInput, TreasurySummary } from './types'

/**
 * Lapisan API tiruan (mock) untuk prototype.
 *
 * Semua fungsi di file ini sengaja dibuat menyerupai endpoint REST backend
 * (lihat README bagian "Kontrak API"). Data disimpan di localStorage sehingga
 * aplikasi bisa berjalan tanpa server. Untuk memakai API asli, jalankan
 * frontend dengan `VITE_API_MODE=live` (lihat `client.ts` dan `live.ts`).
 */

const LATENCY = 260
const TOKEN_KEY = 'wcc.token'
export const DEMO_PASSWORD = 'wcc12345'

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function fail(message: string, status = 400): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(Object.assign(new Error(message), { status })), LATENCY),
  )
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

function read(): Database {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Database
      if (parsed.version === DB_VERSION) return refreshDemoDates(parsed)
      // Versi skema berubah: bangun ulang data demo.
      const fresh = createSeedDatabase()
      write(fresh)
      return fresh
    }
  } catch {
    /* rusak -> reseed */
  }
  const fresh = createSeedDatabase()
  write(fresh)
  return fresh
}

function write(db: Database): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function mutate<T>(fn: (db: Database) => T): T {
  const db = read()
  const result = fn(db)
  write(db)
  return result
}

/* ------------------------------------------------------------------ */
/* Autentikasi                                                         */
/* ------------------------------------------------------------------ */

export const authApi = {
  async login(email: string, password: string): Promise<AuthSession> {
    const db = read()
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!user || password !== DEMO_PASSWORD) {
      return fail('Email atau password tidak sesuai. Silakan periksa kembali.', 401)
    }
    const token = `tok_${user.id}.${Date.now().toString(36)}`
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(`${TOKEN_KEY}.user`, user.id)
    return delay({ token, user })
  },

  async me(): Promise<User | null> {
    const token = localStorage.getItem(TOKEN_KEY)
    const userId = localStorage.getItem(`${TOKEN_KEY}.user`)
    if (!token || !userId) return delay(null, 60)
    const user = read().users.find((u) => u.id === userId)
    return delay(user ?? null, 60)
  },

  async logout(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(`${TOKEN_KEY}.user`)
    return delay(undefined, 80)
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    // Tidak membocorkan apakah email terdaftar.
    return delay({
      message: `Jika ${email} terdaftar, kami telah mengirim tautan pemulihan ke email tersebut.`,
    })
  },
}

/* ------------------------------------------------------------------ */
/* Pengguna & profil                                                   */
/* ------------------------------------------------------------------ */

export const userApi = {
  async list(): Promise<User[]> {
    return delay(read().users.filter((u) => u.role === 'anggota'))
  },
  async updateProfile(
    userId: string,
    patch: Partial<Pick<User, 'name' | 'phone' | 'email'>>,
  ): Promise<User> {
    return delay(
      mutate((db) => {
        const u = db.users.find((x) => x.id === userId)
        if (!u) throw new Error('Pengguna tidak ditemukan.')
        Object.assign(u, patch)
        return u
      }),
    )
  },
  async changePassword(_userId: string, current: string, next: string): Promise<void> {
    if (current !== DEMO_PASSWORD) return fail('Password saat ini tidak sesuai.')
    if (next.length < 8) return fail('Password baru minimal 8 karakter.')
    return delay(undefined)
  },
}

/* ------------------------------------------------------------------ */
/* Sesi latihan                                                        */
/* ------------------------------------------------------------------ */

export const sessionApi = {
  async list(): Promise<Session[]> {
    const sessions = [...read().sessions]
    sessions.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))
    return delay(sessions)
  },
  async get(id: string): Promise<Session | null> {
    return delay(read().sessions.find((s) => s.id === id) ?? null)
  },
  async create(input: SessionInput): Promise<Session> {
    if (!input.title.trim()) return fail('Nama/jenis latihan wajib diisi.')
    if (!input.date) return fail('Tanggal wajib diisi.')
    if (input.endTime <= input.startTime) return fail('Waktu selesai harus setelah waktu mulai.')
    return delay(
      mutate((db) => {
        const s: Session = { id: uid('s'), ...input }
        db.sessions.push(s)
        return s
      }),
    )
  },
  async update(id: string, patch: Partial<SessionInput>): Promise<Session> {
    if (patch.startTime && patch.endTime && patch.endTime <= patch.startTime)
      return fail('Waktu selesai harus setelah waktu mulai.')
    return delay(
      mutate((db) => {
        const s = db.sessions.find((x) => x.id === id)
        if (!s) throw new Error('Sesi tidak ditemukan.')
        Object.assign(s, patch)
        return s
      }),
    )
  },
  async remove(id: string): Promise<void> {
    return delay(
      mutate((db) => {
        db.sessions = db.sessions.filter((s) => s.id !== id)
        db.attendance = db.attendance.filter((a) => a.sessionId !== id)
      }),
    )
  },
}

/* ------------------------------------------------------------------ */
/* Absensi                                                             */
/* ------------------------------------------------------------------ */

export const attendanceApi = {
  async bySession(sessionId: string): Promise<Attendance[]> {
    return delay(read().attendance.filter((a) => a.sessionId === sessionId))
  },
  async byUser(userId: string): Promise<AttendanceRow[]> {
    const db = read()
    return delay(
      db.attendance
        .filter((a) => a.userId === userId)
        .map((a) => decorate(db, a))
        .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate)),
    )
  },
  async recap(filter?: { from?: string; to?: string; userId?: string }): Promise<AttendanceRow[]> {
    const db = read()
    let rows = db.attendance.map((a) => decorate(db, a))
    if (filter?.userId) rows = rows.filter((r) => r.userId === filter.userId)
    if (filter?.from) rows = rows.filter((r) => r.sessionDate >= filter.from!)
    if (filter?.to) rows = rows.filter((r) => r.sessionDate <= filter.to!)
    rows.sort((a, b) => (a.sessionDate === b.sessionDate ? a.userName.localeCompare(b.userName) : b.sessionDate.localeCompare(a.sessionDate)))
    return delay(rows)
  },
  async checkIn(sessionId: string, userId: string): Promise<Attendance> {
    const db = read()
    const session = db.sessions.find((s) => s.id === sessionId)
    if (!session) return fail('Sesi tidak ditemukan.', 404)
    // Selaras dengan backend: check-in hanya dalam jendela waktu sesi.
    const gate = canCheckIn(session)
    if (!gate.ok) return fail(gate.reason ?? 'Check-in belum tersedia.')
    const existing = db.attendance.find((a) => a.sessionId === sessionId && a.userId === userId)
    if (existing) return fail('Anda sudah tercatat pada sesi ini.')
    return delay(
      mutate((d) => {
        // Check-in anggota berstatus 'menunggu' hingga dikonfirmasi coach/pengurus.
        const a: Attendance = {
          id: uid('a'),
          sessionId,
          userId,
          checkInAt: new Date().toISOString(),
          status: 'menunggu',
        }
        d.attendance.push(a)
        return a
      }),
    )
  },
  async setStatus(sessionId: string, userId: string, status: Attendance['status']): Promise<Attendance> {
    return delay(
      mutate((db) => {
        const found = db.attendance.find((a) => a.sessionId === sessionId && a.userId === userId)
        if (found) {
          found.status = status
          return found
        }
        const a: Attendance = { id: uid('a'), sessionId, userId, checkInAt: new Date().toISOString(), status }
        db.attendance.push(a)
        return a
      }),
    )
  },
}

function decorate(db: Database, a: Attendance): AttendanceRow {
  const session = db.sessions.find((s) => s.id === a.sessionId)
  const user = db.users.find((u) => u.id === a.userId)
  const d = new Date(a.checkInAt)
  return {
    ...a,
    userName: user?.name ?? 'Anggota',
    sessionTitle: session?.title ?? 'Sesi latihan',
    sessionDate: session?.date ?? '',
    checkInTime:
      a.status === 'hadir' || a.status === 'menunggu'
        ? `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
        : null,
  }
}

/* ------------------------------------------------------------------ */
/* Pengumuman                                                          */
/* ------------------------------------------------------------------ */

export const announcementApi = {
  async list(includeDrafts = false): Promise<Announcement[]> {
    const list = read()
      .announcements.filter((a) => includeDrafts || a.published)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    return delay(list)
  },
  async get(id: string): Promise<Announcement | null> {
    return delay(read().announcements.find((a) => a.id === id) ?? null)
  },
  async save(input: Partial<Announcement> & { title: string; body: string }): Promise<Announcement> {
    if (!input.title.trim()) return fail('Judul pengumuman wajib diisi.')
    if (!input.body.trim()) return fail('Isi pengumuman wajib diisi.')
    return delay(
      mutate((db) => {
        if (input.id) {
          const found = db.announcements.find((a) => a.id === input.id)
          if (!found) throw new Error('Pengumuman tidak ditemukan.')
          Object.assign(found, input)
          return found
        }
        const created: Announcement = {
          id: uid('an'),
          title: input.title,
          summary: input.summary ?? input.body.slice(0, 120),
          body: input.body,
          priority: input.priority ?? 'normal',
          published: input.published ?? true,
          publishedAt: new Date().toISOString(),
          author: input.author ?? 'Pengurus WCC',
        }
        db.announcements.push(created)
        return created
      }),
    )
  },
  async remove(id: string): Promise<void> {
    return delay(
      mutate((db) => {
        db.announcements = db.announcements.filter((a) => a.id !== id)
      }),
    )
  },
}

/* ------------------------------------------------------------------ */
/* Coach                                                               */
/* ------------------------------------------------------------------ */

export const coachApi = {
  async list(): Promise<Coach[]> {
    return delay(read().coaches)
  },
  async get(id: string): Promise<Coach | null> {
    return delay(read().coaches.find((c) => c.id === id) ?? null)
  },
  async save(input: Partial<Coach> & { name: string; expertise: string[] }): Promise<Coach> {
    if (!input.name.trim()) return fail('Nama coach wajib diisi.')
    if (input.expertise.length === 0) return fail('Minimal satu keahlian wajib diisi.')
    return delay(
      mutate((db) => {
        if (input.id) {
          const found = db.coaches.find((c) => c.id === input.id)
          if (!found) throw new Error('Coach tidak ditemukan.')
          Object.assign(found, input)
          return found
        }
        const created: Coach = {
          id: uid('c'),
          name: input.name,
          expertise: input.expertise,
          experience: input.experience ?? '',
          years: input.years ?? 0,
          bio: input.bio,
          photoUrl: input.photoUrl,
        }
        db.coaches.push(created)
        return created
      }),
    )
  },
  async remove(id: string): Promise<void> {
    return delay(
      mutate((db) => {
        db.coaches = db.coaches.filter((c) => c.id !== id)
      }),
    )
  },
}

/* ------------------------------------------------------------------ */
/* Pendaftaran anggota                                                 */
/* ------------------------------------------------------------------ */

export const registrationApi = {
  async list(): Promise<Registration[]> {
    return delay([...read().registrations].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)))
  },
  async get(id: string): Promise<Registration | null> {
    return delay(read().registrations.find((r) => r.id === id) ?? null)
  },
  async getByEmail(email: string): Promise<Registration[]> {
    return delay(read().registrations.filter((r) => r.email.toLowerCase() === email.trim().toLowerCase()))
  },
  async submit(input: {
    fullName: string
    email: string
    phone: string
    experience: string
    motivation?: string
    consent: boolean
  }): Promise<Registration> {
    if (!input.fullName.trim()) return fail('Nama lengkap wajib diisi.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return fail('Format email tidak valid.')
    if (!input.consent) return fail('Persetujuan pemrosesan data pribadi wajib dicentang.')
    return delay(
      mutate((db) => {
        const created: Registration = {
          id: uid('r'),
          ...input,
          status: 'baru',
          submittedAt: new Date().toISOString(),
        }
        db.registrations.push(created)
        return created
      }),
    )
  },
  async setStatus(id: string, status: RegistrationStatus, internalNote?: string): Promise<Registration> {
    return delay(
      mutate((db) => {
        const r = db.registrations.find((x) => x.id === id)
        if (!r) throw new Error('Pendaftaran tidak ditemukan.')
        r.status = status
        if (internalNote !== undefined) r.internalNote = internalNote
        return r
      }),
    )
  },
}

/* ------------------------------------------------------------------ */
/* Kas & Treasury                                                      */
/* ------------------------------------------------------------------ */

export const treasuryApi = {
  async list(): Promise<Transaction[]> {
    return delay([...read().transactions].sort((a, b) => b.date.localeCompare(a.date)))
  },
  async summary(period?: { from?: string; to?: string }): Promise<TreasurySummary> {
    const db = read()
    const inPeriod = db.transactions.filter(
      (t) => (!period?.from || t.date >= period.from) && (!period?.to || t.date <= period.to),
    )
    const income = inPeriod.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + t.amount, 0)
    const expense = inPeriod.filter((t) => t.type === 'pengeluaran').reduce((s, t) => s + t.amount, 0)
    const balance = db.transactions.reduce(
      (s, t) => s + (t.type === 'pemasukan' ? t.amount : -t.amount),
      0,
    )
    return delay({ balance, income, expense })
  },
  async save(input: Partial<Transaction> & { type: Transaction['type'] }): Promise<Transaction> {
    if (!input.amount || input.amount <= 0) return fail('Nominal harus lebih dari 0.')
    if (!input.category) return fail('Kategori wajib dipilih.')
    if (!input.date) return fail('Tanggal wajib diisi.')
    return delay(
      mutate((db) => {
        if (input.id) {
          const found = db.transactions.find((t) => t.id === input.id)
          if (!found) throw new Error('Transaksi tidak ditemukan.')
          Object.assign(found, input)
          return found
        }
        const created: Transaction = {
          id: uid('t'),
          date: input.date!,
          type: input.type,
          category: input.category!,
          amount: input.amount!,
          note: input.note ?? '',
          recordedBy: input.recordedBy ?? 'Pengurus',
          receiptName: input.receiptName,
          createdAt: new Date().toISOString(),
        }
        db.transactions.push(created)
        return created
      }),
    )
  },
  async remove(id: string): Promise<void> {
    return delay(
      mutate((db) => {
        db.transactions = db.transactions.filter((t) => t.id !== id)
      }),
    )
  },
}

/* ------------------------------------------------------------------ */
/* Sinkronisasi spreadsheet                                            */
/* ------------------------------------------------------------------ */

export const syncApi = {
  async get() {
    return delay(read().sync)
  },
  async run(): Promise<{ status: 'success'; rows: number }> {
    return delay(
      mutate((db) => {
        const rows = db.transactions.length
        db.sync = {
          status: 'success',
          lastSyncAt: new Date().toISOString(),
          log: [
            {
              id: uid('l'),
              at: new Date().toISOString(),
              status: 'success' as const,
              message: `Sinkronisasi selesai. ${rows} baris dikirim ke spreadsheet.`,
              rows,
            },
            ...db.sync.log,
          ].slice(0, 20),
        }
        return { status: 'success' as const, rows }
      }),
      900,
    )
  },
  async reset(): Promise<void> {
    localStorage.removeItem(DB_KEY)
    read()
    return delay(undefined, 120)
  },
}

/* ------------------------------------------------------------------ */
/* Ringkasan dashboard                                                 */
/* ------------------------------------------------------------------ */

export const statsApi = {
  async memberDashboard(userId: string) {
    const db = read()
    const today = todayISO()
    const myAttendance = db.attendance.filter((a) => a.userId === userId)
    const hadir = myAttendance.filter((a) => a.status === 'hadir').length
    const totalSessions = db.sessions.filter((s) => !s.cancelled && s.date <= today).length
    const upcoming = db.sessions
      .filter((s) => !s.cancelled && s.date >= today)
      .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))
    return delay({
      hadir,
      totalSessions,
      percentage: totalSessions ? Math.round((hadir / totalSessions) * 100) : 0,
      upcoming,
    })
  },
  async adminDashboard() {
    const db = read()
    const today = todayISO()
    const upcoming = db.sessions
      .filter((s) => !s.cancelled && s.date >= today)
      .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))
    const recentSessions = db.sessions
      .filter((s) => s.date < today)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
    const balance = db.transactions.reduce(
      (s, t) => s + (t.type === 'pemasukan' ? t.amount : -t.amount),
      0,
    )
    return delay({
      upcoming,
      recentSessions,
      recentAttendanceCount: db.attendance.filter((a) => recentSessions.some((s) => s.id === a.sessionId)).length,
      pendingRegistrations: db.registrations.filter((r) => r.status === 'baru').length,
      activeMembers: db.users.filter((u) => u.role === 'anggota').length,
      balance,
      recentTransactions: [...db.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
      sync: db.sync,
    })
  },
  async coachDashboard(coachId: string) {
    const db = read()
    const today = todayISO()
    const mine = db.sessions.filter((s) => s.coachId === coachId && !s.cancelled)
    const upcoming = mine
      .filter((s) => s.date >= today)
      .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))
    const past = mine.filter((s) => s.date < today).sort((a, b) => b.date.localeCompare(a.date))
    return delay({ upcoming, past })
  },
  async sessionAttendanceSummary(sessionId: string) {
    const db = read()
    const rows = db.attendance.filter((a) => a.sessionId === sessionId)
    return delay({
      hadir: rows.filter((r) => r.status === 'hadir').length,
      izin: rows.filter((r) => r.status === 'izin').length,
      totalMembers: db.users.filter((u) => u.role === 'anggota').length,
    })
  },
}
