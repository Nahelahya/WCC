import { Link } from 'react-router-dom'
import { buttonClasses } from '@/components/ui/Button'

const SECTIONS = [
  {
    title: '1. Data yang Kami Kumpulkan',
    items: [
      'Data akun: nama lengkap, alamat email, nomor telepon, dan peran Anda di klub (anggota, coach, atau pengurus).',
      'Data pendaftaran: pengalaman panjat, asal informasi klub, serta data lain yang Anda isikan pada formulir pendaftaran.',
      'Data kehadiran: riwayat check-in pada sesi latihan beserta status kehadiran.',
      'Data keuangan: riwayat pembayaran iuran dan donasi yang tercatat pada sistem kas klub.',
      'Konten yang Anda kirim: misalnya foto profil, foto kegiatan, pengumuman, dan catatan internal.',
    ],
  },
  {
    title: '2. Cara Kami Menggunakan Data',
    items: [
      'Mengelola akun, verifikasi pendaftaran, dan kehadiran latihan anggota.',
      'Mengirim kode OTP (One-Time Password) untuk verifikasi email saat pendaftaran dan untuk pemulihan kata sandi.',
      'Mengelola administrasi klub: jadwal, coach, pendaftaran, kas, laporan, dan audit aktivitas.',
      'Menampilkan informasi publik di beranda (landing page), termasuk foto kegiatan yang diunggah pengurus.',
      'Mengoperasikan dan meningkatkan sistem, termasuk pemecahan masalah teknis.',
    ],
  },
  {
    title: '3. Kode OTP dan Keamanan Akun',
    items: [
      'Saat mendaftar, kami mengirimkan kode OTP (8 karakter alfanumerik) ke alamat email Anda untuk memverifikasi bahwa email tersebut benar milik Anda.',
      'Saat Anda lupa kata sandi, kami mengirimkan kode OTP untuk memastikan hanya pemilik email yang dapat mengganti kata sandi.',
      'Kode OTP hanya berlaku sekali pakai dan kedaluwarsa dalam waktu singkat. Kode dikirim melalui layanan email SMTP Gmail yang dikonfigurasi oleh pengurus klub.',
      'Jika kode tidak terkirim (misalnya email masuk ke folder Spam), sistem dapat menampilkan kode pada log server sebagai pengganti sementara untuk keperluan pengembangan.',
    ],
  },
  {
    title: '4. Unggahan Foto dan File',
    items: [
      'Anda dapat mengunggah foto profil pada halaman pengaturan akun.',
      'Pengurus dapat mengunggah foto kegiatan klub yang kemudian ditampilkan pada beranda (landing page).',
      'File yang diunggah disimpan pada server aplikasi dan diakses melalui URL publik. Harap hanya mengunggah foto yang menjadi hak Anda atau yang sudah diizinkan untuk dipublikasikan.',
    ],
  },
  {
    title: '5. Penyimpanan Data',
    items: [
      'Data Anda disimpan pada database PostgreSQL yang dikelola untuk aplikasi WISANGGENI CLIMBING CLUB.',
      'Kata sandi disimpan dalam bentuk ter-hash (bukan teks biasa), sehingga tidak dapat dibaca langsung oleh siapa pun.',
      'Kode OTP disimpan hanya dalam bentuk hash dan dihapus setelah digunakan atau kedaluwarsa.',
      'File unggahan disimpan pada direktori penyimpanan server.',
    ],
  },
  {
    title: '6. Sesi, Cookie, dan Perangkat',
    items: [
      'Sistem menggunakan cookie sesi yang aman agar Anda tetap masuk (login) saat menggunakan aplikasi.',
      'Cookie sesi tidak digunakan untuk pelacakan iklan atau pihak ketiga.',
      'Layanan email pihak ketiga (SMTP Gmail) menerima alamat email tujuan dan isi pesan hanya untuk mengirimkan kode OTP atas nama aplikasi.',
    ],
  },
  {
    title: '7. Pembagian Data kepada Pihak Lain',
    items: [
      'Kami tidak menjual data anggota kepada pihak mana pun.',
      'Data hanya dapat diakses oleh pengurus klub yang berwenang untuk keperluan administrasi, dan oleh coach untuk keperluan pembinaan serta kehadiran.',
      'Data dapat dibagikan bila diwajibkan oleh hukum yang berlaku.',
    ],
  },
  {
    title: '8. Hak Anda',
    items: [
      'Meminta salinan data pribadi yang tersimpan.',
      'Memperbarui atau mengoreksi data akun Anda kapan saja melalui halaman profil.',
      'Menghapus foto profil atau meminta penghapusan data melalui pengurus klub.',
      'Menarik persetujuan pemrosesan data dengan menghubungi pengurus klub.',
    ],
  },
  {
    title: '9. Kontak',
    items: [
      'Untuk pertanyaan seputar kebijakan privasi ini, silakan hubungi pengurus klub melalui email kontak yang tercantum pada footer situs.',
    ],
  },
]

export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold tracking-wide text-muted">
        Informasi
      </span>
      <h1 className="mt-4 text-[28px] font-bold leading-tight text-ink sm:text-[34px]">Kebijakan Privasi</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        WISANGGENI CLIMBING CLUB menghargai privasi Anda. Kebijakan ini menjelaskan data apa saja yang kami
        kumpulkan pada aplikasi ini, bagaimana data digunakan, dan hak Anda atas data tersebut. Berlaku bagi
        pengunjung situs, calon anggota, anggota, coach, dan pengurus klub.
      </p>
      <p className="mt-2 text-sm italic text-muted">Terakhir diperbarui: Oktober 2026.</p>

      <div className="mt-8 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-bold text-ink">{s.title}</h2>
            <ul className="mt-3 space-y-2.5">
              {s.items.map((t) => (
                <li key={t} className="flex gap-2.5 text-[14.5px] leading-relaxed text-muted">
                  <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-primary/60" aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-card border border-line bg-surface p-5 text-sm text-muted">
        Aplikasi ini adalah prototype yang dikembangkan sesuai dokumen desain v1.0. Data yang dikumpulkan
        dikelola oleh pengurus klub untuk keperluan administrasi dan pembinaan anggota semata.
      </div>

      <div className="mt-8">
        <Link to="/" className={buttonClasses('primary', 'md')}>
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  )
}