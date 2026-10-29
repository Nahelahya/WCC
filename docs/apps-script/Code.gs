/** WISANGGENI CLIMBING CLUB — Sinkronisasi Kas ke Google Sheets
 * ------------------------------------------------------------------
 * Web App ini menjadi jembatan antara server aplikasi dan spreadsheet ini,
 * sehingga TIDAK perlu Service Account / Google Cloud Console.
 *
 * CARA PASANG (sekali saja):
 *   1. Buka spreadsheet kas milikmu.
 *   2. Menu  Extensions → Apps Script.
 *   3. Hapus isi editor, tempel SELURUH kode di bawah, lalu simpan (Ctrl+S).
 *   4. Klik  Deploy → New deployment → ikon gear → "Web app".
 *   5. Isi:  Description    = bebas (mis. "WCC kas sync").
 *          Execute as     = Me (akun kamu).
 *          Who has access = Appsscript (lebih aman daripada "Anyone").
 *   6. Klik Deploy → izin akses (RESTRICTED jika memungkinkan).
 *   7. Salin "Web app URL" (berakhiran /exec), lalu kirim ke pengelola
 *      server untuk diisi sebagai GOOGLE_APPS_SCRIPT_URL.
 *
 * KEAMANAN:
 *   - Rahasia bersama dibaca dari Script Properties (kunci "WCC_SECRET"),
 *     BUKAN dari kode. Jangan pernah menerbitkan SECRET di repositori.
 *   - `doPost` gagal tertutup: tolak permintaan bila SECRET masih kosong,
 *     placeholder, atau kurang dari 32 karakter.
 *   - Pastikan `Execute as` = Me dan `Who has access` = Appsscript (bukan
 *     "Anyone"), agar hanya aplikasi server yang memanggil endpoint ini.
 */

/** Membaca kunci rahasia dari Script Properties (tidak ada di kode). */
function getSecret() {
  return PropertiesService.getScriptProperties().getProperty('WCC_SECRET');
}

/** Mengecek apakah rahasia sudah kuat dan valid. */
function isStrongSecret(secret) {
  if (!secret) return false;
  if (secret === 'GANTI-DENGAN-TOKEN-RAHASIA') return false;
  return secret.length >= 32;
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    // Gagal tertutup (M-08): tolak permintaan bila rahasia belum disiapkan.
    var secret = getSecret();
    if (!isStrongSecret(secret)) {
      return reply({
        ok: false,
        error: 'Konfigurasi rahasia belum siap. Masukkan kunci "WCC_SECRET" (min. 32 karakter) di Script Properties, lalu coba lagi.',
      });
    }

    // Lalu lanjutkan verifikasi token.
    if (body.token !== secret) {
      return reply({ ok: false, error: 'Token tidak valid.' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tab = body.tab || DEFAULT_TAB;
    var sheet = ss.getSheetByName(tab) || ss.insertSheet(tab);

    // Uji koneksi tanpa mengubah data.
    if (body.action === 'ping') {
      return reply({ ok: true, tab: sheet.getName(), spreadsheet: ss.getName() });
    }

    var values = body.values || [];
    var width = values[0] ? values[0].length : 6;

    // Tulis penuh (full refresh): bersihkan lalu isi ulang.
    sheet.clear();
    if (values.length && width) {
      sheet.getRange(1, 1, values.length, width).setValues(values);
    }

    // Baca ulang untuk rekonsiliasi di sisi server.
    var lastRow = Math.max(sheet.getLastRow(), 1);
    var readBack = sheet
      .getRange(1, 1, lastRow, width)
      .getValues()
      .map(function (row) {
        return row.map(function (cell) {
          return cell === null || cell === undefined ? '' : String(cell);
        });
      });

    return reply({ ok: true, rows: values.length, readBack: readBack });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return reply({ ok: true, service: 'WCC kas sync', time: new Date().toISOString() });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
