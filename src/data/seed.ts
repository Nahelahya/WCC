import type {
  Announcement,
  Attendance,
  AuditLogEntry,
  Coach,
  Database,
  Registration,
  Session,
  Transaction,
  User,
} from '@/types'
import { addDays, todayISO, toISO } from '@/lib/date'

export const DB_VERSION = 2
export const DB_KEY = 'wcc.db'

function nowHHMM(offsetMinutes: number): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + offsetMinutes)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isoMinutesAgo(minutes: number): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - minutes)
  return d.toISOString()
}

const coaches: Coach[] = [
  {
    id: 'c1',
    name: 'Rizky Ananda',
    expertise: ['Lead Climbing', 'Keselamatan & Rigging'],
    experience: '8 tahun memimpin latihan dinding tinggi dan kompetisi daerah.',
    years: 8,
    bio: 'Fokus pada teknik gerak efisien dan manajemen risiko di rute lead.',
  },
  {
    id: 'c2',
    name: 'Sari Wulandari',
    expertise: ['Bouldering', 'Latihan Fisik Dasar'],
    experience: '6 tahun membina pemula dan tim bouldering junior klub.',
    years: 6,
    bio: 'Menyusun program pemanasan dan penguatan untuk anggota baru.',
  },
  {
    id: 'c3',
    name: 'Dimas Prasetyo',
    expertise: ['Speed Climbing', 'Kompetisi'],
    experience: '7 tahun sebagai pelatih tim speed dan pendamping atlet FPTI.',
    years: 7,
    bio: 'Spesialis start, ritme, dan latihan reaksi untuk nomor speed.',
  },
  {
    id: 'c4',
    name: 'Nadia Rahmawati',
    expertise: ['Bouldering', 'Mental & Analisis Rute'],
    experience: '5 tahun menangani sesi analisis rute dan pendekatan mental.',
    years: 5,
    bio: 'Membantu anggota membaca urutan gerak dan mengelola rasa takut jatuh.',
  },
  {
    id: 'c5',
    name: 'Bayu Setiawan',
    expertise: ['Top Rope', 'Keselamatan Pemula'],
    experience: '9 tahun mengajar top rope dan pengenalan alat kepada anggota baru.',
    years: 9,
    bio: 'Pengampu sesi orientasi anggota baru serta pengecekan alat.',
  },
]

const users: User[] = [
  {
    id: 'u-anggota',
    name: 'Budi Santoso',
    email: 'anggota@wcc.id',
    role: 'anggota',
    phone: '0812-3456-7890',
    joinedAt: addDays(todayISO(), -420),
    membershipStatus: 'aktif',
  },
  {
    id: 'u-coach',
    name: 'Rizky Ananda',
    email: 'coach@wcc.id',
    role: 'coach',
    phone: '0813-2222-3333',
    joinedAt: addDays(todayISO(), -900),
    membershipStatus: 'aktif',
    coachId: 'c1',
  },
  {
    id: 'u-pengurus',
    name: 'Anisa Prameswari',
    email: 'pengurus@wcc.id',
    role: 'pengurus',
    phone: '0811-9999-0000',
    joinedAt: addDays(todayISO(), -1200),
    membershipStatus: 'aktif',
  },
  {
    id: 'u-bendahara',
    name: 'Hendra Kusuma',
    email: 'bendahara@wcc.id',
    role: 'pengurus',
    phone: '0817-5555-1212',
    joinedAt: addDays(todayISO(), -1100),
    membershipStatus: 'aktif',
  },
]

const MEMBER_NAMES = [
  'Budi Santoso',
  'Citra Lestari',
  'Eko Nugroho',
  'Fitri Handayani',
  'Gilang Ramadhan',
  'Hesti Purnama',
  'Indra Wijaya',
  'Jihan Aulia',
  'Krisna Bayu',
  'Lia Kartika',
  'Miko Saputra',
  'Nur Aini',
  'Oka Mahendra',
  'Putri Anggraini',
]

const additionalMembers: User[] = MEMBER_NAMES.slice(1).map((name, i) => ({
  id: `u-m${i + 1}`,
  name,
  email: `anggota${i + 1}@wcc.id`,
  role: 'anggota' as const,
  joinedAt: addDays(todayISO(), -(60 + i * 23)),
  membershipStatus: 'aktif' as const,
}))

const allUsers = [...users, ...additionalMembers]

function sessions(): Session[] {
  const today = todayISO()
  const list: Session[] = [
    {
      id: 's-ongoing',
      title: 'Latihan Rutin â€” Lead & Bouldering',
      date: today,
      startTime: nowHHMM(-25),
      endTime: nowHHMM(95),
      location: 'Dinding Panjat FPTI, GOR Utama',
      coachId: 'c1',
      note: 'Pemanasan bersama, dilanjutkan rute lead tingkat menengah.',
    },
    {
      id: 's-today-2',
      title: 'Latihan Fisik & Pemanasan',
      date: today,
      startTime: nowHHMM(200),
      endTime: nowHHMM(320),
      location: 'Area Latihan Fisik WCC',
      coachId: 'c2',
      note: 'Membawa matras pribadi bila ada.',
    },
    {
      id: 's-t1',
      title: 'Bouldering Pemula',
      date: addDays(today, 1),
      startTime: '19:00',
      endTime: '21:00',
      location: 'Dinding Bouldering WCC',
      coachId: 'c4',
    },
    {
      id: 's-t2',
      title: 'Speed Climbing â€” Sesi Reaksi',
      date: addDays(today, 2),
      startTime: '16:00',
      endTime: '18:00',
      location: 'Dinding Speed FPTI',
      coachId: 'c3',
    },
    {
      id: 's-t3',
      title: 'Orientasi Anggota Baru',
      date: addDays(today, 4),
      startTime: '09:00',
      endTime: '11:30',
      location: 'Ruang Kelas & Dinding Top Rope',
      coachId: 'c5',
      note: 'Wajib bagi anggota yang baru bergabung.',
    },
    {
      id: 's-t4',
      title: 'Latihan Rutin â€” Lead',
      date: addDays(today, 5),
      startTime: '19:00',
      endTime: '21:00',
      location: 'Dinding Panjat FPTI, GOR Utama',
      coachId: 'c1',
    },
    {
      id: 's-h1',
      title: 'Latihan Rutin â€” Bouldering',
      date: addDays(today, -2),
      startTime: '19:00',
      endTime: '21:00',
      location: 'Dinding Bouldering WCC',
      coachId: 'c4',
    },
    {
      id: 's-h2',
      title: 'Latihan Fisik',
      date: addDays(today, -4),
      startTime: '19:00',
      endTime: '20:30',
      location: 'Area Latihan Fisik WCC',
      coachId: 'c2',
    },
    {
      id: 's-h3',
      title: 'Latihan Rutin â€” Lead',
      date: addDays(today, -6),
      startTime: '19:00',
      endTime: '21:00',
      location: 'Dinding Panjat FPTI, GOR Utama',
      coachId: 'c1',
    },
    {
      id: 's-h4',
      title: 'Top Rope Pemula',
      date: addDays(today, -9),
      startTime: '08:00',
      endTime: '10:00',
      location: 'Dinding Top Rope WCC',
      coachId: 'c5',
    },
    {
      id: 's-h5',
      title: 'Latihan Rutin â€” Bouldering',
      date: addDays(today, -11),
      startTime: '19:00',
      endTime: '21:00',
      location: 'Dinding Bouldering WCC',
      coachId: 'c4',
    },
    {
      id: 's-h6',
      title: 'Latihan Rutin â€” Lead',
      date: addDays(today, -13),
      startTime: '19:00',
      endTime: '21:00',
      location: 'Dinding Panjat FPTI, GOR Utama',
      coachId: 'c1',
      cancelled: true,
      note: 'Dibatalkan karena perbaikan dinding.',
    },
  ]
  return list
}

function attendance(): Attendance[] {
  const rows: Attendance[] = []
  let n = 0

  // Riwayat anggota demo pada sesi lampau.
  const history: Array<[string, string]> = [
    ['s-h1', 'hadir'],
    ['s-h2', 'hadir'],
    ['s-h3', 'hadir'],
    ['s-h4', 'izin'],
    ['s-h5', 'hadir'],
    ['s-h6', 'alpha'],
  ]
  history.forEach(([sessionId, status], i) => {
    rows.push({
      id: `a-${++n}`,
      sessionId,
      userId: 'u-anggota',
      checkInAt: isoMinutesAgo((i + 1) * 1440 + 45),
      status: status as Attendance['status'],
    })
  })

  // Peserta pada sesi lampau untuk rekap pengurus.
  const pastSessions = ['s-h1', 's-h2', 's-h3', 's-h5']
  pastSessions.forEach((sessionId, si) => {
    allUsers
      .filter((u) => u.role === 'anggota' && u.id !== 'u-anggota')
      .forEach((u, ui) => {
        if ((ui + si) % 4 === 3) return // sebagian tidak hadir
        rows.push({
          id: `a-${++n}`,
          sessionId,
          userId: u.id,
          checkInAt: isoMinutesAgo((si + 1) * 1440 + 20 + ui),
          status: 'hadir',
        })
      })
  })

  return rows
}

const announcements: Announcement[] = [
  {
    id: 'an1',
    title: 'Perubahan Lokasi Latihan Minggu Ini',
    summary: 'Latihan Rabu dipindahkan ke Dinding Panjat FPTI, GOR Utama.',
    body: 'Sehubungan dengan perbaikan area dinding bouldering WCC, latihan rutin Rabu ini dipindahkan sementara ke Dinding Panjat FPTI, GOR Utama.\n\nAnggota diharapkan hadir 15 menit lebih awal untuk registrasi ulang di lokasi baru. Membawa alat pribadi (sepatu panjat dan harness) sangat dianjurkan.',
    priority: 'tinggi',
    publishedAt: isoMinutesAgo(180),
    author: 'Pengurus WCC',
    published: true,
  },
  {
    id: 'an2',
    title: 'Pembayaran Iuran Bulan Ini',
    summary: 'Batas pembayaran iuran periode ini adalah akhir bulan.',
    body: 'Diingatkan kepada seluruh anggota bahwa pembayaran iuran bulanan dapat dilakukan kepada Bendahara pada jam latihan atau melalui transfer ke rekening klub.\n\nBukti transfer mohon diserahkan untuk dicatat pada kas klub.',
    priority: 'normal',
    publishedAt: isoMinutesAgo(1500),
    author: 'Hendra Kusuma',
    published: true,
  },
  {
    id: 'an3',
    title: 'Open Recruitment Anggota Baru Dibuka',
    summary: 'Pendaftaran anggota baru gelombang ini dibuka untuk umum.',
    body: 'Klub membuka pendaftaran anggota baru. Calon anggota dapat mengisi formulir pada halaman Pendaftaran Anggota.\n\nProses verifikasi dilakukan maksimal 2 hari kerja oleh pengurus.',
    priority: 'normal',
    publishedAt: isoMinutesAgo(4320),
    author: 'Pengurus WCC',
    published: true,
  },
  {
    id: 'an4',
    title: 'Jadwal Latihan Speed Climbing Ditambah',
    summary: 'Sesi speed ditambah satu kali per minggu mulai periode ini.',
    body: 'Menyesuaikan minat anggota, sesi speed climbing ditambah menjadi dua kali per minggu. Jadwal dapat dilihat pada halaman Jadwal Latihan.',
    priority: 'rendah',
    publishedAt: isoMinutesAgo(10000),
    author: 'Rizky Ananda',
    published: true,
  },
  {
    id: 'an5',
    title: 'Draft Rencana Kegiatan Semester (Belum Dipublikasikan)',
    summary: 'Draf internal untuk pengurus.',
    body: 'Draf rencana kegiatan dan anggaran semester. Belum dipublikasikan ke anggota.',
    priority: 'normal',
    publishedAt: isoMinutesAgo(60),
    author: 'Anisa Prameswari',
    published: false,
  },
]

const registrations: Registration[] = [
  {
    id: 'r1',
    fullName: 'Wahyu Firmansyah',
    email: 'wahyu.f@example.com',
    phone: '0852-1111-2222',
    gender: 'L',
    nik: '3201234567890001',
    address: 'Jl. Merdeka No. 12, RT 01/RW 02, Bandung, Jawa Barat.',
    medicalHistory: '-',
    parentName: 'Budi Firmansyah',
    parentPhone: '0852-9999-0000',
    experience: 'Pernah latihan bouldering 1 tahun di gym lain.',
    motivation: 'Ingin rutin latihan dan ikut komunitas.',
    consent: true,
    status: 'baru',
    submittedAt: isoMinutesAgo(120),
  },
  {
    id: 'r2',
    fullName: 'Dewi Anggraeni',
    email: 'dewi.a@example.com',
    phone: '0856-3333-4444',
    gender: 'P',
    nik: '3273010101990002',
    address: 'Jl. Merdeka No. 10, Bandung.',
    medicalHistory: 'Asma ringan.',
    parentName: 'Budi Santoso',
    parentPhone: '0856-3333-4444',
    experience: 'Belum pernah, tertarik mulai dari nol.',
    motivation: 'Mencari olahraga baru dan komunitas yang suportif.',
    consent: true,
    status: 'baru',
    submittedAt: isoMinutesAgo(900),
  },
  {
    id: 'r3',
    fullName: 'Fajar Ramadhan',
    email: 'fajar.r@example.com',
    phone: '0812-7777-8888',
    gender: 'L',
    nik: '3273020202980003',
    address: 'Jl. Asia Afrika No. 5, Bandung.',
    medicalHistory: '-',
    parentName: 'Hendra Ramadhan',
    parentPhone: '0812-7777-9999',
    experience: 'Atlet top rope tingkat daerah.',
    motivation: 'Melanjutkan latihan kompetitif.',
    consent: true,
    status: 'diverifikasi',
    submittedAt: isoMinutesAgo(4000),
  },
  {
    id: 'r4',
    fullName: 'Sinta Melati',
    email: 'sinta.m@example.com',
    phone: '0813-1212-3434',
    gender: 'P',
    nik: '3273030303000004',
    address: 'Jl. Dago No. 20, Bandung.',
    medicalHistory: 'Cedera pergelangan kaki (sembuh).',
    parentName: 'Rina Melati',
    parentPhone: '0813-1212-5555',
    experience: 'Latihan speed 6 bulan.',
    motivation: 'Ingin ikut sesi speed.',
    consent: true,
    status: 'diverifikasi',
    submittedAt: isoMinutesAgo(6000),
  },
  {
    id: 'r5',
    fullName: 'Tidak Lengkap',
    email: 'tidak.lengkap@example.com',
    phone: '-',
    gender: 'L',
    nik: '',
    address: '-',
    medicalHistory: '-',
    parentName: '-',
    parentPhone: '-',
    experience: '-',
    consent: false,
    status: 'ditolak',
    submittedAt: isoMinutesAgo(9000),
    internalNote: 'Data tidak lengkap dan tanpa persetujuan pemrosesan data.',
  },
]

function transactions(): Transaction[] {
  const today = todayISO()
  const rows: Array<Partial<Transaction> & { daysAgo: number }> = [
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
  return rows.map((r, i) => ({
    id: `t${i + 1}`,
    date: addDays(today, -r.daysAgo),
    type: r.type!,
    category: r.category!,
    amount: r.amount!,
    note: r.note!,
    recordedBy: r.recordedBy!,
    createdAt: isoMinutesAgo(r.daysAgo * 1440),
  }))
}

function auditLogs(): AuditLogEntry[] {
  const today = todayISO()
  const mk = (
    id: string,
    minutesAgo: number,
    userName: string,
    action: AuditLogEntry['action'],
    detail: Record<string, unknown>,
  ): AuditLogEntry => ({
    id,
    at: isoMinutesAgo(minutesAgo),
    userName,
    action,
    entity: 'transaction',
    detail,
  })

  return [
    mk('al4', 3 * 1440, 'Anisa Prameswari', 'update', {
      before: { date: addDays(today, -9), type: 'pengeluaran', category: 'Peralatan', amount: 620000, note: 'Pembelian 2 set quickdraw' },
      after: { date: addDays(today, -9), type: 'pengeluaran', category: 'Peralatan', amount: 640000, note: 'Pembelian 2 set quickdraw' },
    }),
    mk('al3', 5 * 1440, 'Hendra Kusuma', 'create', {
      date: addDays(today, -5), type: 'pengeluaran', category: 'Sewa Gym', amount: 1200000, note: 'Sewa dinding FPTI bulan ini',
    }),
    mk('al2', 9 * 1440, 'Anisa Prameswari', 'delete', {
      date: addDays(today, -10), type: 'pengeluaran', category: 'Konsumsi', amount: 150000, note: 'Konsumsi rapat (koreksi pencatatan ganda)',
    }),
    mk('al1', 12 * 1440, 'Hendra Kusuma', 'create', {
      date: addDays(today, -12), type: 'pemasukan', category: 'Sponsor', amount: 2000000, note: 'Sponsor lokal untuk event internal',
    }),
  ]
}

export function createSeedDatabase(): Database {
  return {
    version: DB_VERSION,
    seededDay: todayISO(),
    users: allUsers,
    sessions: sessions(),
    attendance: attendance(),
    announcements,
    coaches,
    registrations,
    transactions: transactions(),
    auditLogs: auditLogs(),
    landing: defaultLandingMock(),
    sync: {
      status: 'success',
      lastSyncAt: isoMinutesAgo(240),
      log: [
        { id: 'l3', at: isoMinutesAgo(240), status: 'success', message: 'Sinkronisasi selesai. 12 baris dikirim.', rows: 12 },
        { id: 'l2', at: isoMinutesAgo(1680), status: 'failed', message: 'Kuota Google Sheets API terlampaui. Dicoba ulang otomatis.', rows: 0 },
        { id: 'l1', at: isoMinutesAgo(3120), status: 'success', message: 'Sinkronisasi selesai. 11 baris dikirim.', rows: 11 },
      ],
    },
  }
}

/**
 * Menjaga data demo tetap relevan: menggeser tanggal seed agar "hari ini"
 * selalu punya sesi berlangsung dan riwayat tetap wajar.
 */
export function refreshDemoDates(db: Database): Database {
  const today = todayISO()
  if (db.seededDay === today) {
    // Pastikan sesi berlangsung selalu punya jendela waktu yang masuk akal.
    const ongoing = db.sessions.find((s) => s.id === 's-ongoing')
    if (ongoing) {
      ongoing.date = today
      ongoing.startTime = nowHHMM(-25)
      ongoing.endTime = nowHHMM(95)
    }
    return db
  }

  const [y1, m1, d1] = db.seededDay.split('-').map(Number)
  const [y2, m2, d2] = today.split('-').map(Number)
  const delta = Math.round(
    (new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000,
  )

  const shift = (iso: string) => addDays(iso, delta)
  const shiftStamp = (iso: string) => {
    const d = new Date(iso)
    d.setDate(d.getDate() + delta)
    return d.toISOString()
  }

  db.sessions = db.sessions.map((s) => ({ ...s, date: shift(s.date) }))
  db.attendance = db.attendance.map((a) => ({ ...a, checkInAt: shiftStamp(a.checkInAt) }))
  db.transactions = db.transactions.map((t) => ({
    ...t,
    date: shift(t.date),
    createdAt: shiftStamp(t.createdAt),
  }))
  db.announcements = db.announcements.map((a) => ({ ...a, publishedAt: shiftStamp(a.publishedAt) }))
  db.registrations = db.registrations.map((r) => ({ ...r, submittedAt: shiftStamp(r.submittedAt) }))
  db.auditLogs = (db.auditLogs ?? []).map((l) => ({ ...l, at: shiftStamp(l.at) }))
  db.sync = {
    ...db.sync,
    lastSyncAt: db.sync.lastSyncAt ? shiftStamp(db.sync.lastSyncAt) : null,
    log: db.sync.log.map((l) => ({ ...l, at: shiftStamp(l.at) })),
  }

  const ongoing = db.sessions.find((s) => s.id === 's-ongoing')
  if (ongoing) {
    ongoing.date = today
    ongoing.startTime = nowHHMM(-25)
    ongoing.endTime = nowHHMM(95)
  }

  db.seededDay = today
  return db
}

export function isSameDay(a: string, b: string): boolean {
  return toISO(new Date(a)) === toISO(new Date(b))
}

function defaultLandingMock(): any {
  return {
    hero: {
      title: 'WISANGGENI CLIMBING CLUB',
      subtitle: 'Komunitas panjat tebing yang mengedepankan kebersamaan, pembinaan berkelanjutan dan keselamatan.',
      ctaPrimaryLabel: 'Gabung Sekarang',
      ctaPrimaryHref: '/daftar',
      ctaSecondaryLabel: 'Lihat Jadwal',
      ctaSecondaryHref: '/#jadwal',
    },
    about: {
      badge: 'Tentang Kami',
      title: 'Wujudkan potensi panjat tebing Anda bersama komunitas solid',
      description: 'WISANGGENI CLIMBING CLUB fokus pada pembinaan teknis, keselamatan dan budaya saling mendukung.',
      stats: [
        { label: 'Anggota Aktif', value: '50+' },
        { label: 'Sesi Latihan/Bulan', value: '12+' },
        { label: 'Coach Bersertifikasi', value: '3' },
        { label: 'Tahun Berdiri', value: '5+' },
      ],
    },
    schedule: {
      badge: 'Jadwal Latihan',
      title: 'Latihan rutin setiap minggu',
      description: 'Ikuti sesi latihan terjadwal bersama coach.',
      items: [
        { day: 'Selasa', time: '19.00 – 21.00 WIB', activity: 'Latihan Teknik & Bouldering' },
        { day: 'Kamis', time: '19.00 – 21.00 WIB', activity: 'Lead Climbing & Safety' },
        { day: 'Sabtu', time: '09.00 – 12.00 WIB', activity: 'Open Wall & Sparing Session' },
      ],
    },
    coaches: { badge: 'Tim Coach', title: 'Dibimbing coach berpengalaman', description: '', items: [] },
    steps: {
      badge: 'Cara Bergabung',
      title: 'Empat langkah menjadi anggota',
      description: '',
      items: [
        { title: 'Isi Formulir', desc: 'Lengkapi data diri.' },
        { title: 'Verifikasi Email', desc: 'Masukkan kode OTP.' },
        { title: 'Verifikasi Pendaftaran', desc: 'Konfirmasi oleh pengurus.' },
        { title: 'Mulai Latihan', desc: 'Gabung sesi rutin.' },
      ],
    },
    activities: { badge: 'Kegiatan Klub', title: 'Foto kegiatan komunitas', description: '', items: [] },
    cta: {
      title: 'Siap mulai latihan bersama kami?',
      description: 'Buat akun dan catat kehadiran digital.',
      ctaPrimaryLabel: 'Gabung Sekarang',
      ctaPrimaryHref: '/daftar',
      ctaSecondaryLabel: 'Sudah punya akun? Masuk',
      ctaSecondaryHref: '/masuk',
    },
    footer: {
      description: 'Komunitas panjat tebing untuk latihan rutin, pembinaan dan kebersamaan.',
      contact: { address: 'Dinding Panjat FPTI, GOR Utama', email: 'halo@wisanggeniclub.id', phone: '0812-0000-0000' },
      sections: [
        {
          title: 'Informasi',
          links: [
            { label: 'Tentang Klub', href: '/#tentang' },
            { label: 'Jadwal Latihan', href: '/#jadwal' },
            { label: 'Profil Coach', href: '/coach' },
            { label: 'Cara Bergabung', href: '/cara-bergabung' },
            { label: 'Kebijakan Privasi', href: '/kebijakan-privasi' },
          ],
        },
        { title: 'Anggota', links: [{ label: 'Login', href: '/masuk' }, { label: 'Daftar', href: '/daftar' }, { label: 'Cek Status', href: '/daftar/status' }] },
      ],
      copyright: "© 2026 WISANGGENI CLIMBING CLUB. Prototype UI sesuai dokumen desain v1.0.",
    },
  }
}






