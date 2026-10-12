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

  // ---- Penyimpanan berkas (unggahan) ----
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  uploadMaxMb: Number(process.env.UPLOAD_MAX_MB ?? 5),

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
