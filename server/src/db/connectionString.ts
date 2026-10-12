/**
 * Utilitas untuk menormalkan connection string database.
 *
 * Password yang dibuat penyedia (mis. Supabase) dapat memuat karakter yang
 * ilegal di dalam URL — contohnya `#` yang dianggap sebagai fragmen sehingga
 * `new URL()` gagal dengan "Invalid URL". Fungsi di sini meng-encode bagian
 * username/password saja, tanpa mengubah host, port, maupun nama database.
 */

/** Decode percent-encoding bila valid; bila tidak, kembalikan apa adanya. */
function decodeUserinfo(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function normalizeConnectionString(databaseUrl: string): string {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([\s\S]*)$/.exec(databaseUrl)
  if (!match) return databaseUrl

  const [, scheme, rest] = match
  // Gunakan `@` terakhir sebagai pemisah agar password yang memuat `@` tetap utuh.
  const at = rest.lastIndexOf('@')
  if (at < 0) return databaseUrl

  const userinfo = rest.slice(0, at)
  const hostPart = rest.slice(at + 1)

  const colon = userinfo.indexOf(':')
  if (colon < 0) {
    return `${scheme}://${encodeURIComponent(decodeUserinfo(userinfo))}@${hostPart}`
  }

  const user = userinfo.slice(0, colon)
  const pass = userinfo.slice(colon + 1)
  return `${scheme}://${encodeURIComponent(decodeUserinfo(user))}:${encodeURIComponent(
    decodeUserinfo(pass),
  )}@${hostPart}`
}
