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
  // ---- Google Sheets (poin 3) ----
  googleSheetsId: process.env.GOOGLE_SHEETS_ID ?? '',
  googleSheetsTab: process.env.GOOGLE_SHEETS_TAB ?? 'Kas',
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '',
  googleServiceAccountFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? '',
  // 0 = hanya sinkronisasi manual lewat tombol "Sinkronkan Sekarang".
  sheetsSyncIntervalMinutes: Number(process.env.SHEETS_SYNC_INTERVAL_MINUTES ?? 0),
  sheetsRequestTimeoutMs: Number(process.env.SHEETS_REQUEST_TIMEOUT_MS ?? 15000),
}

/** Password awal untuk seluruh akun demo (hanya dipakai oleh skrip seed). */
export const DEMO_PASSWORD = 'wcc12345'
