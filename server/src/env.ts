import 'dotenv/config'

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Environment variable ${name} wajib diisi (lihat .env.example).`)
  return value
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgres://wcc:wcc@localhost:5432/wcc'),
  jwtSecret: required('JWT_SECRET'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS ?? 30),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE === 'true',

  // ---- URL aplikasi publik (dipakai pada tautan email, mis. reset password) ----
  publicAppUrl: (process.env.PUBLIC_APP_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),

  // ---- Email (SMTP). Bila SMTP_HOST kosong, email ditulis ke log server. ----
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpSecure: process.env.SMTP_SECURE === 'true',
  mailFrom: process.env.MAIL_FROM ?? 'WISANGGENI CLIMBING CLUB <no-reply@wcc.id>',
  /** Email pengurus yang menerima notifikasi pendaftaran baru (opsional). */
  registrationNotifyEmail: process.env.REGISTRATION_NOTIFY_EMAIL ?? '',

  /**
   * Alternatif pengiriman email lewat Hostinger Mail API (HTTP) alih-alih SMTP.
   * Bila `HOSTINGER_MAIL_API_TOKEN` diisi, mode ini dipakai (lihat lib/mailer.ts).
   * Token dibuat di hPanel → Email → Agentic Mail → API access.
   */
  hostingerMailApiToken: process.env.HOSTINGER_MAIL_API_TOKEN ?? '',
  hostingerMailApiUrl: (process.env.HOSTINGER_MAIL_API_URL ?? 'https://api.mail.hostinger.com').replace(
    /\/+$/,
    '',
  ),
  /** Resource ID kotak surat (mis. `AC…`). Bila kosong, diambil otomatis dari `GET /api/v1/me`. */
  hostingerMailMailboxId: process.env.HOSTINGER_MAIL_MAILBOX_ID ?? '',

  // ---- WhatsApp (Fonnte) ----
  // Token device dari dashboard Fonnte (https://fonnte.com → Device → Token).
  // Kosong = pengiriman WhatsApp nonaktif; pengurus tetap dapat mengirim link
  // grup secara manual dari halaman Pendaftaran Anggota.
  fonnteToken: process.env.FONNTE_TOKEN ?? '',
  fonnteApiUrl: (process.env.FONNTE_API_URL ?? 'https://api.fonnte.com').replace(/\/+$/, ''),
  /** Tautan undangan grup WhatsApp klub (mis. https://chat.whatsapp.com/xxxx). */
  waGroupLink: process.env.WA_GROUP_LINK ?? 'https://chat.whatsapp.com/CkncDVy2Ly3ILLlfbWnCPE',
  /** Nama grup, dipakai pada pesan WhatsApp. */
  waGroupName: process.env.WA_GROUP_NAME ?? 'Grup WhatsApp WISANGGENI CLIMBING CLUB',

  // ---- Pembayaran online (DOKU Checkout) ----
  // Client-Id & Secret Key dari dashboard DOKU (Jokul). Kosong = pembayaran
  // online nonaktif; aplikasi tetap berjalan dengan pembayaran tunai.
  dokuClientId: process.env.DOKU_CLIENT_ID ?? '',
  dokuSecretKey: process.env.DOKU_SECRET_KEY ?? '',
  /** https://api.doku.com (produksi) atau https://api-sandbox.doku.com (uji). */
  dokuBaseUrl: (process.env.DOKU_BASE_URL ?? 'https://api.doku.com').replace(/\/+$/, ''),
  /** Path URL notifikasi webhook yang juga didaftarkan di dashboard DOKU. */
  dokuNotificationPath: process.env.DOKU_NOTIFICATION_PATH ?? '/api/payments/doku/notification',
  /**
   * URL publik lengkap yang dipakai DOKU untuk mengirim notifikasi webhook.
   * Bila kosong, diturunkan dari PUBLIC_APP_URL + DOKU_NOTIFICATION_PATH.
   */
  dokuNotificationUrl: process.env.DOKU_NOTIFICATION_URL ?? '',
  /** Biaya administrasi pendaftaran (sekali bayar), dalam Rupiah. */
  registrationFee: Number(process.env.PAYMENT_REGISTRATION_FEE ?? 50000),
  /** Iuran kas per bulan, dalam Rupiah. Anggota boleh mencicil. */
  monthlyDues: Number(process.env.PAYMENT_DUES_MONTHLY ?? 60000),

  // ---- Penyimpanan berkas (unggahan) ----
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  uploadMaxMb: Number(process.env.UPLOAD_MAX_MB ?? 5),

  // ---- Pembatasan laju permintaan (rate limit) ----
  // 0 = NONAKTIF untuk API umum & reset password. Khusus login, proteksi
  // selalu aktif dengan default 5 percobaan gagal / 15 menit bila 0/kosong.
  rateLimitWindowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES ?? 15),
  apiRateLimit: Number(process.env.API_RATE_LIMIT ?? 0),
  loginRateLimit: Number(process.env.LOGIN_RATE_LIMIT ?? 5),
  passwordResetRateLimit: Number(process.env.PASSWORD_RESET_RATE_LIMIT ?? 0),

  // ---- Google Sheets (poin 3) ----
  googleSheetsId: process.env.GOOGLE_SHEETS_ID ?? '',
  googleSheetsTab: process.env.GOOGLE_SHEETS_TAB ?? 'Kas',
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '',
  googleServiceAccountFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? '',
  /**
   * Alternatif lain: OAuth 2.0 memakai akun Google pemilik spreadsheet.
   * Butuh Client ID + Client Secret (dari Google Cloud Console) dan sebuah
   * refresh token hasil otorisasi sekali (lihat docs/apps-script/README bagian OAuth).
   */
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
  googleOAuthRefreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? '',
  /**
   * Alternatif tanpa Service Account: URL Web App Google Apps Script yang
   * di-deploy dari spreadsheet tujuan. Bila diisi, mode ini dipakai (lebih mudah
   * dibuat: cukup Extensions → Apps Script, tanpa Google Cloud Console).
   */
  googleAppsScriptUrl: process.env.GOOGLE_APPS_SCRIPT_URL ?? '',
  /** Rahasia bersama opsional yang ikut dikirim ke Web App (lihat Google Apps Script). */
  googleAppsScriptToken: process.env.GOOGLE_APPS_SCRIPT_TOKEN ?? '',
  // 0 = hanya sinkronisasi manual lewat tombol "Sinkronkan Sekarang".
  sheetsSyncIntervalMinutes: Number(process.env.SHEETS_SYNC_INTERVAL_MINUTES ?? 0),
  sheetsRequestTimeoutMs: Number(process.env.SHEETS_REQUEST_TIMEOUT_MS ?? 15000),
}

/** Password awal untuk seluruh akun demo (hanya dipakai oleh skrip seed). */
export const DEMO_PASSWORD = 'wcc12345'
