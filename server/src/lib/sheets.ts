import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { env } from '../env'

/**
 * Klien tipis untuk Google Sheets API v4 — tanpa dependensi `googleapis`.
 *
 * Autentikasi memakai *service account*: JWT RS256 ditandatangani dengan private
 * key, lalu ditukar menjadi access token OAuth2. Semua panggilan HTTP memakai
 * `fetch` bawaan Node 18+.
 *
 * Kredensial TIDAK pernah dikembalikan ke klien; UI hanya menampilkan status.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

export interface ServiceAccount {
  client_email: string
  private_key: string
  project_id?: string
}

export interface SheetsConfig {
  configured: boolean
  /** Alasan bila belum siap dipakai (hanya diisi ketika `configured = false`). */
  reason?: string
  /** Cara integrasi: service account (Cloud Console) atau Web App Apps Script. */
  mode: 'service-account' | 'apps-script'
  spreadsheetId: string
  tab: string
  serviceAccountEmail?: string
  /** URL Web App Apps Script — RAHASIA, jangan pernah dikembalikan ke klien. */
  appsScriptUrl?: string
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Membaca service account dari file atau variabel lingkungan (JSON mentah atau base64). */
function loadServiceAccount(): ServiceAccount {
  const file = env.googleServiceAccountFile.trim()
  const inline = env.googleServiceAccountJson.trim()

  let raw = ''
  if (file) {
    raw = readFileSync(file, 'utf8')
  } else if (inline) {
    raw = inline
  } else {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_FILE / GOOGLE_SERVICE_ACCOUNT_JSON belum diisi.')
  }

  raw = raw.trim()
  if (!raw.startsWith('{')) {
    // Dikirim sebagai base64 (praktis untuk variabel lingkungan / Docker secret).
    raw = Buffer.from(raw, 'base64').toString('utf8').trim()
  }

  const parsed = JSON.parse(raw) as Partial<ServiceAccount>
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Service account JSON tidak lengkap (butuh client_email dan private_key).')
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key, project_id: parsed.project_id }
}

let cachedConfig: SheetsConfig | null = null

/** Ringkasan konfigurasi (aman ditampilkan; tanpa private key / URL rahasia). */
export function getSheetsConfig(): SheetsConfig {
  if (cachedConfig) return cachedConfig
  const spreadsheetId = env.googleSheetsId.trim()
  const tab = env.googleSheetsTab.trim() || 'Kas'
  const appsScriptUrl = env.googleAppsScriptUrl.trim()

  // Mode Apps Script diprioritaskan bila URL Web App tersedia.
  if (appsScriptUrl) {
    cachedConfig = { configured: true, mode: 'apps-script', spreadsheetId, tab, appsScriptUrl }
    return cachedConfig
  }

  try {
    const account = loadServiceAccount()
    if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_ID belum diisi.')
    cachedConfig = {
      configured: true,
      mode: 'service-account',
      spreadsheetId,
      tab,
      serviceAccountEmail: account.client_email,
    }
  } catch (error) {
    cachedConfig = {
      configured: false,
      mode: 'service-account',
      reason: error instanceof Error ? error.message : String(error),
      spreadsheetId,
      tab,
    }
  }
  return cachedConfig
}

export function isSheetsConfigured(): boolean {
  return getSheetsConfig().configured
}

/** Hanya untuk pengujian: paksa konfigurasi dibaca ulang dari `env`. */
export function resetSheetsConfigCache(): void {
  cachedConfig = null
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), env.sheetsRequestTimeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Menukar JWT service account menjadi access token OAuth2. */
export async function getAccessToken(): Promise<string> {
  const account = loadServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  )
  const signingInput = `${header}.${claims}`
  const signature = createSign('RSA-SHA256').update(signingInput).sign(account.private_key)
  const assertion = `${signingInput}.${base64url(signature)}`

  const res = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string }
  if (!res.ok || !body.access_token) {
    const error = new Error(`Gagal mendapatkan token Google: ${body.error_description ?? res.status}`) as Error & {
      status?: number
    }
    error.status = res.status
    throw error
  }
  return body.access_token
}

async function sheetsFetch(token: string, path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const res = await fetchWithTimeout(`${SHEETS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>
  if (!res.ok) {
    const detail = (body.error as { message?: string } | undefined)?.message
    const error = new Error(detail ?? `Google Sheets membalas HTTP ${res.status}`) as Error & { status?: number }
    error.status = res.status
    throw error
  }
  return body
}

/** Memastikan tab/lembar tujuan ada; membuatnya bila belum ada. */
export async function ensureTab(token: string, spreadsheetId: string, tab: string): Promise<void> {
  const meta = (await sheetsFetch(
    token,
    `/${spreadsheetId}?fields=sheets.properties.title`,
  )) as { sheets?: { properties?: { title?: string } }[] }
  const exists = (meta.sheets ?? []).some((sheet) => sheet.properties?.title === tab)
  if (!exists) {
    await sheetsFetch(token, `/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
    })
  }
}

/** Menimpa isi tab dengan `values` (baris pertama = header). */
export async function writeValues(
  token: string,
  spreadsheetId: string,
  tab: string,
  values: (string | number)[][],
): Promise<number> {
  await sheetsFetch(token, `/${spreadsheetId}/values/${encodeURIComponent(`${quote(tab)}!A:Z`)}:clear`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const range = `${quote(tab)}!A1:${columnLabel(values[0]?.length ?? 1)}${Math.max(values.length, 1)}`
  await sheetsFetch(token, `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
  })
  return values.length
}

/** Membaca ulang isi tab (untuk rekonsiliasi). */
export async function readValues(token: string, spreadsheetId: string, tab: string): Promise<string[][]> {
  const body = (await sheetsFetch(
    token,
    `/${spreadsheetId}/values/${encodeURIComponent(`${quote(tab)}!A1:Z`)}`,
  )) as { values?: string[][] }
  return body.values ?? []
}

function quote(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`
}

function columnLabel(count: number): string {
  let label = ''
  let n = count
  while (n > 0) {
    const rem = (n - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    n = Math.floor((n - 1) / 26)
  }
  return label || 'A'
}

/* ------------------------------------------------------------------ */
/* Transport terpadu: tulis penuh + baca ulang (mode-aware)            */
/* ------------------------------------------------------------------ */

export interface SheetSyncResult {
  rows: number
  /** Isi tab setelah ditulis (baris pertama = header), sudah berupa teks. */
  readBack: string[][]
}

interface AppScriptBody {
  ok?: boolean
  error?: string
  rows?: number
  readBack?: unknown
  tab?: string
}

/**
 * Memanggil Web App Google Apps Script (`doPost`).
 *
 * Memakai `Content-Type: text/plain` agar tidak memicu preflight dan agar isi
 * permintaan dapat dibaca utuh lewat `e.postData.contents` di sisi Apps Script.
 */
async function appsScriptRequest(url: string, payload: Record<string, unknown>): Promise<AppScriptBody> {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let body: AppScriptBody
  try {
    body = JSON.parse(text) as AppScriptBody
  } catch {
    const error = new Error(
      'Respons Apps Script tidak valid (bukan JSON). Pastikan Web App di-deploy dengan ' +
        '"Who has access: Anyone" dan URL berakhiran /exec.',
    ) as Error & { status?: number }
    error.status = res.status
    throw error
  }
  if (!res.ok || body.ok === false) {
    const error = new Error(body.error ?? `Apps Script menolak permintaan (HTTP ${res.status}).`) as Error & {
      status?: number
    }
    error.status = res.status
    throw error
  }
  return body
}

async function appsScriptSync(cfg: SheetsConfig, values: (string | number)[][]): Promise<SheetSyncResult> {
  if (!cfg.appsScriptUrl) throw new Error('GOOGLE_APPS_SCRIPT_URL belum diisi.')
  const body = await appsScriptRequest(cfg.appsScriptUrl, {
    action: 'sync',
    tab: cfg.tab,
    token: env.googleAppsScriptToken || undefined,
    values,
  })
  const readBack = Array.isArray(body.readBack) ? (body.readBack as string[][]) : []
  return { rows: typeof body.rows === 'number' ? body.rows : values.length, readBack }
}

/**
 * Menimpa seluruh isi tab dengan `values` lalu membacanya kembali, apa pun
 * modenya (service account / Apps Script). Dipakai `syncService` untuk
 * sinkronisasi penuh sekaligus rekonsiliasi.
 */
export async function syncSheet(cfg: SheetsConfig, values: (string | number)[][]): Promise<SheetSyncResult> {
  if (cfg.mode === 'apps-script') return appsScriptSync(cfg, values)

  const token = await getAccessToken()
  await ensureTab(token, cfg.spreadsheetId, cfg.tab)
  await writeValues(token, cfg.spreadsheetId, cfg.tab, values)
  const readBack = await readValues(token, cfg.spreadsheetId, cfg.tab)
  return { rows: values.length, readBack }
}

/** Uji koneksi ringan tanpa mengubah data (dipakai `npm run sheets:check`). */
export async function pingSheet(cfg: SheetsConfig): Promise<{ tab: string }> {
  if (cfg.mode === 'apps-script') {
    if (!cfg.appsScriptUrl) throw new Error('GOOGLE_APPS_SCRIPT_URL belum diisi.')
    const body = await appsScriptRequest(cfg.appsScriptUrl, {
      action: 'ping',
      tab: cfg.tab,
      token: env.googleAppsScriptToken || undefined,
    })
    return { tab: typeof body.tab === 'string' ? body.tab : cfg.tab }
  }
  const token = await getAccessToken()
  await ensureTab(token, cfg.spreadsheetId, cfg.tab)
  return { tab: cfg.tab }
}
