import { pool } from './pool'
import { DEMO_PASSWORD } from '../env'
import { hashPassword } from '../lib/password'
import { addDays, isoMinutesAgo, nowHHMM, todayISO } from '../lib/time'

/**
 * Mengisi database dengan data contoh yang sama seperti versi frontend.
 * CATATAN: skrip ini mengosongkan tabel lebih dulu (hanya untuk demo).
 */

interface SeedUser {
  id: string
  name: string
  email: string
  role: 'anggota' | 'coach' | 'pengurus'
  phone?: string
  joinedAt: string
  membershipStatus: 'aktif' | 'nonaktif' | 'pending'
  coachId?: string
}

interface SeedSession {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  location: string
  coachId: string
  note?: string
  cancelled?: boolean
}

const COACHES = [
  { id: 'c1', name: 'Rizky Ananda', expertise: ['Lead Climbing', 'Keselamatan & Rigging'], experience: '8 tahun memimpin latihan dinding tinggi dan kompetisi daerah.', years: 8, bio: 'Fokus pada teknik gerak efisien dan manajemen risiko di rute lead.' },
  { id: 'c2', name: 'Sari Wulandari', expertise: ['Bouldering', 'Latihan Fisik Dasar'], experience: '6 tahun membina pemula dan tim bouldering junior klub.', years: 6, bio: 'Menyusun program pemanasan dan penguatan untuk anggota baru.' },
  { id: 'c3', name: 'Dimas Prasetyo', expertise: ['Speed Climbing', 'Kompetisi'], experience: '7 tahun sebagai pelatih tim speed dan pendamping atlet FPTI.', years: 7, bio: 'Spesialis start, ritme, dan latihan reaksi untuk nomor speed.' },
  { id: 'c4', name: 'Nadia Rahmawati', expertise: ['Bouldering', 'Mental & Analisis Rute'], experience: '5 tahun menangani sesi analisis rute dan pendekatan mental.', years: 5, bio: 'Membantu anggota membaca urutan gerak dan mengelola rasa takut jatuh.' },
  { id: 'c5', name: 'Bayu Setiawan', expertise: ['Top Rope', 'Keselamatan Pemula'], experience: '9 tahun mengajar top rope dan pengenalan alat kepada anggota baru.', years: 9, bio: 'Pengampu sesi orientasi anggota baru serta pengecekan alat.' },
]

const today = todayISO()

const BASE_USERS: SeedUser[] = [
  { id: 'u-anggota', name: 'Budi Santoso', email: 'anggota@wcc.id', role: 'anggota', phone: '0812-3456-7890', joinedAt: addDays(today, -420), membershipStatus: 'aktif' },
  { id: 'u-coach', name: 'Rizky Ananda', email: 'coach@wcc.id', role: 'coach', phone: '0813-2222-3333', joinedAt: addDays(today, -900), membershipStatus: 'aktif', coachId: 'c1' },
  { id: 'u-pengurus', name: 'Anisa Prameswari', email: 'pengurus@wcc.id', role: 'pengurus', phone: '0811-9999-0000', joinedAt: addDays(today, -1200), membershipStatus: 'aktif' },
  { id: 'u-bendahara', name: 'Hendra Kusuma', email: 'bendahara@wcc.id', role: 'pengurus', phone: '0817-5555-1212', joinedAt: addDays(today, -1100), membershipStatus: 'aktif' },
]

const MEMBER_NAMES = ['Budi Santoso', 'Citra Lestari', 'Eko Nugroho', 'Fitri Handayani', 'Gilang Ramadhan', 'Hesti Purnama', 'Indra Wijaya', 'Jihan Aulia', 'Krisna Bayu', 'Lia Kartika', 'Miko Saputra', 'Nur Aini', 'Oka Mahendra', 'Putri Anggraini']

const ADDITIONAL_MEMBERS: SeedUser[] = MEMBER_NAMES.slice(1).map((name, i) => ({
  id: `u-m${i + 1}`,
  name,
  email: `anggota${i + 1}@wcc.id`,
  role: 'anggota',
  joinedAt: addDays(today, -(60 + i * 23)),
  membershipStatus: 'aktif',
}))

const ALL_USERS = [...BASE_USERS, ...ADDITIONAL_MEMBERS]

const SESSIONS: SeedSession[] = [
  { id: 's-ongoing', title: 'Latihan Rutin — Lead & Bouldering', date: today, startTime: nowHHMM(-25), endTime: nowHHMM(95), location: 'Dinding Panjat FPTI, GOR Utama', coachId: 'c1', note: 'Pemanasan bersama, dilanjutkan rute lead tingkat menengah.' },
  { id: 's-today-2', title: 'Latihan Fisik & Pemanasan', date: today, startTime: nowHHMM(200), endTime: nowHHMM(320), location: 'Area Latihan Fisik WCC', coachId: 'c2', note: 'Membawa matras pribadi bila ada.' },
  { id: 's-t1', title: 'Bouldering Pemula', date: addDays(today, 1), startTime: '19:00', endTime: '21:00', location: 'Dinding Bouldering WCC', coachId: 'c4' },
  { id: 's-t2', title: 'Speed Climbing — Sesi Reaksi', date: addDays(today, 2), startTime: '16:00', endTime: '18:00', location: 'Dinding Speed FPTI', coachId: 'c3' },
  { id: 's-t3', title: 'Orientasi Anggota Baru', date: addDays(today, 4), startTime: '09:00', endTime: '11:30', location: 'Ruang Kelas & Dinding Top Rope', coachId: 'c5', note: 'Wajib bagi anggota yang baru bergabung.' },
  { id: 's-t4', title: 'Latihan Rutin — Lead', date: addDays(today, 5), startTime: '19:00', endTime: '21:00', location: 'Dinding Panjat FPTI, GOR Utama', coachId: 'c1' },
  { id: 's-h1', title: 'Latihan Rutin — Bouldering', date: addDays(today, -2), startTime: '19:00', endTime: '21:00', location: 'Dinding Bouldering WCC', coachId: 'c4' },
  { id: 's-h2', title: 'Latihan Fisik', date: addDays(today, -4), startTime: '19:00', endTime: '20:30', location: 'Area Latihan Fisik WCC', coachId: 'c2' },
  { id: 's-h3', title: 'Latihan Rutin — Lead', date: addDays(today, -6), startTime: '19:00', endTime: '21:00', location: 'Dinding Panjat FPTI, GOR Utama', coachId: 'c1' },
  { id: 's-h4', title: 'Top Rope Pemula', date: addDays(today, -9), startTime: '08:00', endTime: '10:00', location: 'Dinding Top Rope WCC', coachId: 'c5' },
  { id: 's-h5', title: 'Latihan Rutin — Bouldering', date: addDays(today, -11), startTime: '19:00', endTime: '21:00', location: 'Dinding Bouldering WCC', coachId: 'c4' },
  { id: 's-h6', title: 'Latihan Rutin — Lead', date: addDays(today, -13), startTime: '19:00', endTime: '21:00', location: 'Dinding Panjat FPTI, GOR Utama', coachId: 'c1', cancelled: true, note: 'Dibatalkan karena perbaikan dinding.' },
]

function buildAttendance() {
  const rows: Array<{ id: string; sessionId: string; userId: string; checkInAt: string; status: 'hadir' | 'izin' | 'alpha' }> = []
  let n = 0

  const history: Array<[string, 'hadir' | 'izin' | 'alpha']> = [
    ['s-h1', 'hadir'], ['s-h2', 'hadir'], ['s-h3', 'hadir'], ['s-h4', 'izin'], ['s-h5', 'hadir'], ['s-h6', 'alpha'],
  ]
  history.forEach(([sessionId, status], i) => {
    rows.push({ id: `a-${++n}`, sessionId, userId: 'u-anggota', checkInAt: isoMinutesAgo((i + 1) * 1440 + 45), status })
  })

  const pastSessions = ['s-h1', 's-h2', 's-h3', 's-h5']
  pastSessions.forEach((sessionId, si) => {
    ALL_USERS.filter((u) => u.role === 'anggota' && u.id !== 'u-anggota').forEach((u, ui) => {
      if ((ui + si) % 4 === 3) return
      rows.push({ id: `a-${++n}`, sessionId, userId: u.id, checkInAt: isoMinutesAgo((si + 1) * 1440 + 20 + ui), status: 'hadir' })
    })
  })

  return rows
}

const ANNOUNCEMENTS = [
  { id: 'an1', title: 'Perubahan Lokasi Latihan Minggu Ini', summary: 'Latihan Rabu dipindahkan ke Dinding Panjat FPTI, GOR Utama.', body: 'Sehubungan dengan perbaikan area dinding bouldering WCC, latihan rutin Rabu ini dipindahkan sementara ke Dinding Panjat FPTI, GOR Utama.\n\nAnggota diharapkan hadir 15 menit lebih awal untuk registrasi ulang di lokasi baru. Membawa alat pribadi (sepatu panjat dan harness) sangat dianjurkan.', priority: 'tinggi', publishedAt: isoMinutesAgo(180), author: 'Pengurus WCC', published: true },
  { id: 'an2', title: 'Pembayaran Iuran Bulan Ini', summary: 'Batas pembayaran iuran periode ini adalah akhir bulan.', body: 'Diingatkan kepada seluruh anggota bahwa pembayaran iuran bulanan dapat dilakukan kepada Bendahara pada jam latihan atau melalui transfer ke rekening klub.\n\nBukti transfer mohon diserahkan untuk dicatat pada kas klub.', priority: 'normal', publishedAt: isoMinutesAgo(1500), author: 'Hendra Kusuma', published: true },
  { id: 'an3', title: 'Open Recruitment Anggota Baru Dibuka', summary: 'Pendaftaran anggota baru gelombang ini dibuka untuk umum.', body: 'Klub membuka pendaftaran anggota baru. Calon anggota dapat mengisi formulir pada halaman Pendaftaran Anggota.\n\nProses verifikasi dilakukan maksimal 2 hari kerja oleh pengurus.', priority: 'normal', publishedAt: isoMinutesAgo(4320), author: 'Pengurus WCC', published: true },
  { id: 'an4', title: 'Jadwal Latihan Speed Climbing Ditambah', summary: 'Sesi speed ditambah satu kali per minggu mulai periode ini.', body: 'Menyesuaikan minat anggota, sesi speed climbing ditambah menjadi dua kali per minggu. Jadwal dapat dilihat pada halaman Jadwal Latihan.', priority: 'rendah', publishedAt: isoMinutesAgo(10000), author: 'Rizky Ananda', published: true },
  { id: 'an5', title: 'Draft Rencana Kegiatan Semester (Belum Dipublikasikan)', summary: 'Draf internal untuk pengurus.', body: 'Draf rencana kegiatan dan anggaran semester. Belum dipublikasikan ke anggota.', priority: 'normal', publishedAt: isoMinutesAgo(60), author: 'Anisa Prameswari', published: false },
]

const REGISTRATIONS = [
  { id: 'r1', fullName: 'Wahyu Firmansyah', email: 'wahyu.f@example.com', phone: '0852-1111-2222', experience: 'Pernah latihan bouldering 1 tahun di gym lain.', motivation: 'Ingin rutin latihan dan ikut komunitas.', consent: true, status: 'baru', submittedAt: isoMinutesAgo(120) },
  { id: 'r2', fullName: 'Dewi Anggraeni', email: 'dewi.a@example.com', phone: '0856-3333-4444', experience: 'Belum pernah, tertarik mulai dari nol.', motivation: 'Mencari olahraga baru dan komunitas yang suportif.', consent: true, status: 'baru', submittedAt: isoMinutesAgo(900) },
  { id: 'r3', fullName: 'Fajar Ramadhan', email: 'fajar.r@example.com', phone: '0812-7777-8888', experience: 'Atlet top rope tingkat daerah.', motivation: 'Melanjutkan latihan kompetitif.', consent: true, status: 'diverifikasi', submittedAt: isoMinutesAgo(4000) },
  { id: 'r4', fullName: 'Sinta Melati', email: 'sinta.m@example.com', phone: '0813-1212-3434', experience: 'Latihan speed 6 bulan.', motivation: 'Ingin ikut sesi speed.', consent: true, status: 'diverifikasi', submittedAt: isoMinutesAgo(6000) },
  { id: 'r5', fullName: 'Tidak Lengkap', email: 'tidak.lengkap@example.com', phone: '-', experience: '-', motivation: null, consent: false, status: 'ditolak', submittedAt: isoMinutesAgo(9000), internalNote: 'Data tidak lengkap dan tanpa persetujuan pemrosesan data.' },
]

const TRANSACTIONS = [
  { daysAgo: 1, type: 'pemasukan', category: 'Iuran Anggota', amount: 750000, note: 'Iuran bulanan 5 anggota', recordedBy: 'Hendra Kusuma' },
  { daysAgo: 2, type: 'pengeluaran', category: 'Konsumsi', amount: 180000, note: 'Air mineral dan buah untuk latihan', recordedBy: 'Hendra Kusuma' },
  { daysAgo: 4, type: 'pemasukan', category: 'Donasi', amount: 500000, note: 'Donasi alumni untuk perawatan dinding', recordedBy: 'Anisa Prameswari' },
  { daysAgo: 5, type: 'pengeluaran', category: 'Sewa Gym', amount: 1200000, note: 'Sewa dinding FPTI bulan ini', recordedBy: 'Hendra Kusuma' },
  { daysAgo: 7, type: 'pemasukan', category: 'Iuran Anggota', amount: 900000, note: 'Iuran bulanan 6 anggota', recordedBy: 'Hendra Kusuma' },
  { daysAgo: 9, type: 'pengeluaran', category: 'Peralatan', amount: 640000, note: 'Pembelian 2 set quickdraw', recordedBy: 'Anisa Prameswari' },
  { daysAgo: 12, type: 'pemasukan', category: 'Sponsor', amount: 2000000, note: 'Sponsor lokal untuk event internal', recordedBy: 'Anisa Prameswari' },
  { daysAgo: 14, type: 'pengeluaran', category: 'Event', amount: 850000, note: 'Biaya event fun climbing', recordedBy: 'Hendra Kusuma' },
  { daysAgo: 18, type: 'pengeluaran', category: 'Konsumsi', amount: 220000, note: 'Konsumsi rapat pengurus', recordedBy: 'Hendra Kusuma' },
  { daysAgo: 21, type: 'pemasukan', category: 'Iuran Anggota', amount: 1050000, note: 'Iuran bulanan 7 anggota', recordedBy: 'Hendra Kusuma' },
  { daysAgo: 40, type: 'pengeluaran', category: 'Peralatan', amount: 1500000, note: 'Penggantian tali utama', recordedBy: 'Anisa Prameswari' },
  { daysAgo: 45, type: 'pemasukan', category: 'Iuran Anggota', amount: 1500000, note: 'Iuran bulanan 10 anggota', recordedBy: 'Hendra Kusuma' },
]

async function seed(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `truncate table attendance, refresh_tokens, audit_logs, registrations, transactions,
       announcements, sessions, users, coaches, sync_logs, sync_state
       restart identity cascade`,
    )

    // 1) Coach
    for (const c of COACHES) {
      await client.query(
        `insert into coaches (id, name, expertise, experience, years, bio)
         values ($1,$2,$3,$4,$5,$6)`,
        [c.id, c.name, c.expertise, c.experience, c.years, c.bio],
      )
    }

    // 2) Pengguna (semua memakai password demo yang sama, di-hash sekali)
    const passwordHash = await hashPassword(DEMO_PASSWORD)
    for (const u of ALL_USERS) {
      await client.query(
        `insert into users (id, name, email, role, phone, joined_at, membership_status, coach_id, password_hash)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [u.id, u.name, u.email, u.role, u.phone ?? null, u.joinedAt, u.membershipStatus, u.coachId ?? null, passwordHash],
      )
    }

    // 3) Jadwal latihan
    for (const s of SESSIONS) {
      await client.query(
        `insert into sessions (id, title, date, start_time, end_time, location, coach_id, note, cancelled)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [s.id, s.title, s.date, s.startTime, s.endTime, s.location, s.coachId, s.note ?? null, s.cancelled ?? false],
      )
    }

    // 4) Absensi
    for (const a of buildAttendance()) {
      await client.query(
        `insert into attendance (id, session_id, user_id, check_in_at, status)
         values ($1,$2,$3,$4,$5)`,
        [a.id, a.sessionId, a.userId, a.checkInAt, a.status],
      )
    }

    // 5) Pengumuman
    for (const an of ANNOUNCEMENTS) {
      await client.query(
        `insert into announcements (id, title, summary, body, priority, published_at, author, published)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [an.id, an.title, an.summary, an.body, an.priority, an.publishedAt, an.author, an.published],
      )
    }

    // 6) Pendaftaran anggota
    for (const r of REGISTRATIONS) {
      await client.query(
        `insert into registrations (id, full_name, email, phone, experience, motivation, consent, status, submitted_at, internal_note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [r.id, r.fullName, r.email, r.phone, r.experience, r.motivation, r.consent, r.status, r.submittedAt, r.internalNote ?? null],
      )
    }

    // 7) Transaksi kas
    for (const t of TRANSACTIONS) {
      await client.query(
        `insert into transactions (id, date, type, category, amount, note, recorded_by, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [`t-${t.daysAgo}`, addDays(today, -t.daysAgo), t.type, t.category, t.amount, t.note, t.recordedBy, isoMinutesAgo(t.daysAgo * 1440)],
      )
    }

    // 8) Riwayat sinkronisasi
    const logs = [
      { id: 'l3', at: isoMinutesAgo(240), status: 'success', message: 'Sinkronisasi selesai. 12 baris dikirim.', rows: 12 },
      { id: 'l2', at: isoMinutesAgo(1680), status: 'failed', message: 'Kuota Google Sheets API terlampaui. Dicoba ulang otomatis.', rows: 0 },
      { id: 'l1', at: isoMinutesAgo(3120), status: 'success', message: 'Sinkronisasi selesai. 11 baris dikirim.', rows: 11 },
    ]
    for (const l of logs) {
      await client.query(
        `insert into sync_logs (id, at, status, message, rows) values ($1,$2,$3,$4,$5)`,
        [l.id, l.at, l.status, l.message, l.rows],
      )
    }
    await client.query(
      `insert into sync_state (id, status, last_sync_at)
       values (1, 'success', $1)
       on conflict (id) do update set status = excluded.status, last_sync_at = excluded.last_sync_at`,
      [isoMinutesAgo(240)],
    )

    await client.query('COMMIT')
    console.log(`Seed selesai: ${ALL_USERS.length} pengguna, ${SESSIONS.length} sesi, ${TRANSACTIONS.length} transaksi.`)
    console.log(`Akun demo — anggota@wcc.id / coach@wcc.id / pengurus@wcc.id (password: ${DEMO_PASSWORD})`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

seed()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error('Seed gagal:', error)
    await pool.end()
    process.exit(1)
  })
