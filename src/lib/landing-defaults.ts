import type { LandingContent } from '@/types.landing'

export function getLandingDefaults(): LandingContent {
  return {
    hero: {
      title: 'WISANGGENI CLIMBING CLUB',
      subtitle: 'Komunitas panjat tebing yang mengedepankan semangat kebersamaan, pembinaan berkelanjutan, dan keselamatan untuk semua level kemampuan.',
      ctaPrimaryLabel: 'Gabung Sekarang',
      ctaPrimaryHref: '/daftar',
      ctaSecondaryLabel: 'Lihat Jadwal',
      ctaSecondaryHref: '/#jadwal',
    },
    about: {
      badge: 'Tentang Kami',
      title: 'Wujudkan potensi panjat tebing Anda bersama komunitas yang solid',
      description: 'WISANGGENI CLIMBING CLUB dibentuk untuk menghubungkan pecinta panjat tebing dari berbagai latar belakang. Kami fokus pada pembinaan teknis, keselamatan, dan budaya saling mendukung antar anggota.',
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
      description: 'Ikuti sesi latihan terjadwal bersama coach untuk terus mengembangkan teknik dan kekuatan.',
      items: [
        { day: 'Selasa', time: '19.00 – 21.00 WIB', activity: 'Latihan Teknik & Bouldering' },
        { day: 'Kamis', time: '19.00 – 21.00 WIB', activity: 'Lead Climbing & Safety' },
        { day: 'Sabtu', time: '09.00 – 12.00 WIB', activity: 'Open Wall & Sparing Session' },
      ],
    },
    coaches: {
      badge: 'Tim Coach',
      title: 'Dibimbing oleh coach berpengalaman',
      description: 'Tim pelatih kami siap membantu Anda berkembang dari pemula hingga level kompetitif dengan pendekatan yang aman dan menyenangkan.',
      items: [],
    },
    steps: {
      badge: 'Cara Bergabung',
      title: 'Empat langkah menjadi anggota',
      description: '',
      items: [
        { title: 'Isi Formulir Pendaftaran', desc: 'Lengkapi data diri Anda melalui halaman pendaftaran.' },
        { title: 'Verifikasi Email', desc: 'Periksa email Anda dan masukkan kode OTP yang kami kirimkan.' },
        { title: 'Pembayaran & Verifikasi', desc: 'Lakukan konfirmasi pendaftaran sesuai arahan pengurus.' },
        { title: 'Mulai Latihan', desc: 'Gabung sesi latihan rutin dan kenali komunitas kami.' },
      ],
    },
    activities: {
      badge: 'Kegiatan Klub',
      title: 'Foto kegiatan komunitas',
      description: 'Lihat momen kebersamaan, latihan dan kegiatan WISANGGENI CLIMBING CLUB.',
      items: [],
    },
    cta: {
      title: 'Siap mulai latihan bersama kami?',
      description: 'Buat akun, ikuti orientasi, dan catat kehadiran latihan Anda secara digital.',
      ctaPrimaryLabel: 'Gabung Sekarang',
      ctaPrimaryHref: '/daftar',
      ctaSecondaryLabel: 'Sudah punya akun? Masuk',
      ctaSecondaryHref: '/masuk',
    },
    footer: {
      description: 'Komunitas panjat tebing yang mewadahi latihan rutin, pembinaan atlet, dan kegiatan bersama anggota di lingkungan klub.',
      contact: {
        address: 'Dinding Panjat FPTI, GOR Utama',
        email: 'halo@wisanggeniclub.id',
        phone: '0812-0000-0000',
      },
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
        {
          title: 'Anggota',
          links: [
            { label: 'Login Anggota', href: '/masuk' },
            { label: 'Daftar Anggota Baru', href: '/daftar' },
            { label: 'Cek Status Pendaftaran', href: '/daftar/status' },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} WISANGGENI CLIMBING CLUB. Prototype UI sesuai dokumen desain v1.0.`,
    },
  }
}