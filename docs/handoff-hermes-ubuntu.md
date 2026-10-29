# Handoff: Hermes (Ubuntu) → OpenCode (homeserver) → WCC

Dokumen ini adalah **satu-satunya file yang perlu dikirim ke Hermes**. Isinya:
arsitektur, prasyarat Ubuntu, instalasi & keamanan OpenCode, cara Hermes
menyerahkan tugas ke OpenCode, daftar **skill** dan **API/kredensial** yang
dibutuhkan, plus runbook deploy WISANGGENI CLIMBING CLUB (WCC).

- Repo: `https://github.com/Nahelahya/WCC` (branch produksi: `main`, branch uji: `testing`)
- Produksi: `https://wisanggeniclub.site` (Hostinger Node.js / LiteSpeed–Passenger, Node 22)
- Database: Supabase PostgreSQL (`iiwujuwliqlwgdhdtayw`, region `ap-southeast-1`)
- Stack: React 18 + Vite 8 (frontend) / Express 4 + PostgreSQL (backend), satu origin
- Versi dokumen: 1.1 — 2026-10-29
- Otomasi Hermes: `ops/hermes/` (lihat Bagian 4 dan `ops/hermes/README.md`)

> **PENTING:** semua nilai rahasia di dokumen ini ditulis sebagai placeholder
> `<...>`. Jangan pernah menaruh token asli di repo, di prompt, atau di file ini.
> Baca Bagian 9 (rotasi rahasia) sebelum menyerahkan akses ke agen.

---

## 0. Cara memakai dokumen ini

1. Kirim file ini ke Hermes.
2. Minta Hermes menjalankan **Bagian 1–4** (setup host + OpenCode + koneksi),
   lalu memasang skrip di `ops/hermes/` (lihat `ops/hermes/README.md`).
3. Minta Hermes meng-install **skill** di Bagian 5 dan menyiapkan kredensial di Bagian 6.
4. Setelah smoke test lolos, gunakan **prompt siap tempel** di Bagian 11 untuk
   operasi harian.

Skrip yang sudah tersedia (jangan ditulis ulang dari nol):

| File | Fungsi |
|---|---|
| `ops/hermes/wcc-task` | kirim tugas JSON ke OpenCode, preflight, log NDJSON |
| `ops/hermes/wcc-deploy` | push fast-forward + tunggu build + verifikasi (butuh `--yes`) |
| `ops/hermes/wcc-task@.service` | unit systemd oneshot per tugas |
| `ops/hermes/opencode-tunnel.service` | tunnel SSH ke homeserver |
| `ops/hermes/hermes.env.example` | contoh variabel lingkungan |

Urutan eksekusi yang aman:

```
Prasyarat Ubuntu → OpenCode + systemd → Koneksi Hermes↔OpenCode
→ ops/hermes → Skills → Kredensial → Smoke test → Baru boleh deploy
```

---

## 1. Arsitektur & pembagian peran

### 1.1 Peran

| Komponen | Peran | Yang dijalankan |
|---|---|---|
| **Hermes** (Ubuntu) | Orkestrator: menerima perintah manusia, memecah tugas, memanggil OpenCode, melaporkan hasil | `hermes` CLI/daemon + skrip `wcc-task` |
| **OpenCode** (homeserver) | Eksekutor: membaca repo, menulis kode, menjalankan test/build, commit & push | `opencode serve` (HTTP API) **atau** `opencode run` via SSH |
| **GitHub** | Sumber kebenaran kode + pemicu auto-deploy Hostinger | repo `Nahelahya/WCC` |
| **Hostinger** | Build & jalankan aplikasi produksi | Node 22, entry `server.cjs`, build `vite build` |
| **Supabase** | Database produksi + MCP untuk migrasi/inspeksi | PostgreSQL pooler port 6543 |

Hermes **bukan** pengganti model: Hermes memakai model (OpenCode Zen/Go atau
provider lain) untuk berpikir, lalu menyerahkan eksekusi kode ke OpenCode.
Jangan biarkan dua agen mengedit repo yang sama secara bersamaan.

### 1.2 Dua topologi yang didukung

**Topologi A — semua di satu homeserver (paling sederhana)**

```
manusia → Hermes ──(localhost HTTP/CLI)──> OpenCode ──> repo lokal ──> GitHub ──> Hostinger
```

**Topologi B — Hermes di Ubuntu, OpenCode di homeserver lain**

```
manusia → Hermes (Ubuntu) ──SSH tunnel / Tailscale──> OpenCode (homeserver:4096)
                                                        └─> repo lokal ──> GitHub ──> Hostinger
```

Aturan yang tidak boleh dilanggar:

- Port `4096` OpenCode **hanya** listen di `127.0.0.1` atau IP privat
  (Tailscale/WireGuard). **Jangan** buka ke internet publik.
- Akses lintas host memakai **SSH tunnel** atau VPN, bukan port forwarding publik.
- Satu repo = satu pekerjaan aktif. Kalau perlu paralel, pakai `git worktree`
  (skill `using-git-worktrees`), jangan dua agen di direktori yang sama.

---

## 2. Prasyarat Ubuntu

Target: Ubuntu 22.04/24.04 LTS, user non-root (`wcc` atau `hermes`), akses `sudo`.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
  git curl jq unzip build-essential ca-certificates gnupg \
  ripgrep fd-find tmux htop ufw fail2ban unattended-upgrades \
  postgresql-client openssh-client rsync
```

### 2.1 Node.js 22 (wajib; repo memakai Vite 8 + Node >= 20)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # harus v22.x
npm -v
```

Alternatif: `nvm` (kalau tidak mau Node sistem). Kalau pakai `nvm`, systemd
harus memakai path absolut ke binary Node/OpenCode.

### 2.2 Firewall & hardening dasar

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw enable

sudo systemctl enable --now fail2ban
sudo systemctl enable --now unattended-upgrades
```

Kalau Hermes dan OpenCode beda host, buka **hanya** port yang benar-benar perlu
(SSH). Port 4096 tetap tertutup.

### 2.3 Struktur direktori yang dipakai dokumen ini

```bash
# user service (lewati bila sudah ada)
sudo adduser --disabled-password --gecos "" wcc
sudo -u wcc -H mkdir -p /home/wcc/apps

sudo mkdir -p /etc/opencode
sudo chown root:root /etc/opencode

# clone sebagai user service agar kepemilikan file benar
sudo -u wcc -H git clone https://github.com/Nahelahya/WCC.git /home/wcc/apps/WCC
```

> Path tetap: `/home/wcc/apps/WCC`. Kalau memakai user/path lain, ganti **semua**
> kemunculannya (systemd, agent, skrip Hermes). Jangan mencampur dua path.

---

## 3. Instalasi & konfigurasi OpenCode (homeserver)

### 3.1 Install

```bash
npm install --global @opencode/cli
opencode --version
```

Alternatif installer resmi:

```bash
curl -fsSL https://opencode.ai/install | bash
```

### 3.2 Login provider model

Semua perintah OpenCode di bawah harus dijalankan sebagai **user service**
(`wcc`), karena kredensial, config, dan skill disimpan di home user tersebut:

```bash
sudo -u wcc -H bash          # masuk sebagai wcc; atau prefix tiap perintah
```

```bash
opencode auth login          # pilih provider (mis. OpenCode Zen / OpenCode Go)
opencode auth list
opencode models | head -30
```

Untuk Hermes, kunci model disimpan terpisah:

```bash
# ~/.hermes/.env  (chmod 600)
OPENCODE_ZEN_API_KEY=<OPENCODE_ZEN_KEY>
OPENCODE_GO_API_KEY=<OPENCODE_GO_KEY>
```

```yaml
# ~/.hermes/config.yaml
model:
  provider: opencode-go      # atau opencode-zen
  default: <MODEL_ID>        # ambil dari `opencode models`
```

### 3.3 Config global OpenCode

`~/.config/opencode/opencode.json`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "wcc",
  "permissions": [
    { "action": "*", "resource": "*", "effect": "allow" },

    // Rahasia tidak boleh dibaca agen.
    { "action": "read", "resource": "**/.env", "effect": "deny" },
    { "action": "read", "resource": "**/.env.*", "effect": "deny" },
    { "action": "read", "resource": "**/.env.example", "effect": "allow" },
    { "action": "read", "resource": "**/*.pem", "effect": "deny" },
    { "action": "read", "resource": "**/id_ed25519*", "effect": "deny" },

    // Perintah berbahaya selalu ditolak, walau `--auto`.
    { "action": "shell", "resource": "*sudo *", "effect": "deny" },
    { "action": "shell", "resource": "*rm -rf /*", "effect": "deny" },
    { "action": "shell", "resource": "*git push --force*", "effect": "deny" },
    { "action": "shell", "resource": "*git reset --hard*", "effect": "deny" },
    { "action": "shell", "resource": "*shutdown*", "effect": "deny" },
    { "action": "shell", "resource": "*reboot*", "effect": "deny" }
  ]
}
```

Catatan: aturan terakhir yang cocok yang menang. Jangan menaruh `allow *` di
paling bawah setelah `deny`, atau larangan akan tertimpa.

### 3.4 Agent khusus WCC

Agent sudah tersedia di repo: `/home/wcc/apps/WCC/.opencode/agents/wcc.md`.
File ini ikut ter-review dan otomatis dipakai saat `--agent wcc`.

Isinya menetapkan:

- hanya boleh **commit lokal**; `git push`, `git reset --hard`, `sudo`,
  `rm -rf`, dan sejenisnya **ditolak** oleh permission;
- tidak boleh membaca `.env`, kunci, atau dump database;
- wajib menjalankan `npm run typecheck`, `(cd server && npm run typecheck)`,
  dan `npm run build`;
- wajib berhenti dan menulis `BUTUH KEPUTUSAN: ...` bila tugas ambigu atau
  menyentuh skema DB.

Jangan membuat agent global yang mengizinkan push. Kalau benar-benar perlu
agent global, salin file yang sama ke `~/.config/opencode/agents/wcc.md`,
tetapi versi repo tetap menjadi acuan. Verifikasinya ada di Bagian 8 butir 4.

### 3.5 Jalankan sebagai service (systemd)

Simpan kredensial server:

```bash
sudo install -m 600 /dev/null /etc/opencode/server.env
sudo tee /etc/opencode/server.env >/dev/null <<'EOF'
OPENCODE_SERVER_USERNAME=opencode
OPENCODE_SERVER_PASSWORD=<PANJANG_ACAK_MIN_32_KARAKTER>
EOF
```

`/etc/systemd/system/opencode.service`:

```ini
[Unit]
Description=OpenCode server (WCC)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=wcc
Group=wcc
WorkingDirectory=/home/wcc/apps/WCC
Environment=HOME=/home/wcc
EnvironmentFile=/etc/opencode/server.env
ExecStart=/usr/local/bin/opencode serve --hostname 127.0.0.1 --port 4096
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/home/wcc/apps

[Install]
WantedBy=multi-user.target
```

> Cek `which opencode`. Kalau bukan `/usr/local/bin/opencode`, sesuaikan
> `ExecStart=`. Kalau memakai `nvm`, pakai path absolut Node + binary OpenCode.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now opencode
sudo systemctl status opencode --no-pager
```

Verifikasi (password dibaca dari terminal, tidak masuk shell history):

```bash
read -rsp 'OpenCode server password: ' PW; echo; export PW
curl -fsS -u "opencode:$PW" http://127.0.0.1:4096/api/info | jq
```

Alternatif tanpa systemd (cukup untuk uji cepat):

```bash
opencode service set hostname 127.0.0.1
opencode service set port 4096
opencode service set password "<PANJANG_ACAK>"
opencode service start
opencode service status
```

### 3.6 Autentikasi API

Dua cara yang didukung:

1. **Basic auth** (disarankan untuk Hermes, dan yang dipakai `opencode serve`):
   `Authorization: Basic base64("<OPENCODE_SERVER_USERNAME>:<OPENCODE_SERVER_PASSWORD>")`
   Username default `opencode`. Ini yang dipakai semua contoh curl di dokumen ini.
2. **Pairing** (untuk browser/manusia; sekali pakai, kedaluwarsa 5 menit).
   Pairing terikat ke **shared/background service** OpenCode, bukan ke proses
   `opencode serve` terpisah. Kalau memakai `opencode serve` + Basic auth,
   lewati bagian ini.

   ```bash
   opencode pair            # cetak link + QR (butuh shared service)
   ```

   Versi API (bila server mendukungnya):

   ```bash
   curl -fsS -u "opencode:$PW" -X POST http://127.0.0.1:4096/api/pair
   # {"code":"...","expires_in":300}

   curl -fsS -H 'accept: application/json' \
     http://127.0.0.1:4096/auth/connect/<CODE>
   # {"token":"..."}  → pakai sebagai password Basic auth
   ```

Jangan pernah mencetak token/password ke log Hermes. Simpan di
`~/.hermes/.env` (chmod 600) atau `/etc/opencode/server.env`.

### 3.7 Akses dari Hermes (topologi B)

Di host Hermes, buat tunnel permanen.

Unit siap pakai ada di repo: `ops/hermes/opencode-tunnel.service`. Ganti
`wcc@HOMESERVER` dan path kunci, lalu pasang:

```bash
sudo install -m 0644 ops/hermes/opencode-tunnel.service /etc/systemd/system/
```

Inti perintahnya:

```ini
ExecStart=/usr/bin/ssh -NT -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -i /home/hermes/.ssh/id_ed25519_wcc \
  -L 127.0.0.1:4096:127.0.0.1:4096 wcc@HOMESERVER
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now opencode-tunnel
curl -fsS -u "opencode:$PW" http://127.0.0.1:4096/api/info | jq '.version'
```

Alternatif yang lebih tahan banting: Tailscale di kedua host, lalu akses
`http://<homeserver-tailscale-ip>:4096` dengan `--hostname` diarahkan ke IP
Tailscale (bukan `0.0.0.0`).

---

## 4. Protokol penyerahan tugas Hermes → OpenCode

Pilih **satu** mode. Jangan campur keduanya untuk tugas yang sama.

### Mode A — `opencode run` via SSH (disarankan, paling sederhana)

Tidak perlu mengelola sesi/HTTP. Hermes menjalankan perintah, menunggu selesai,
membaca output JSON.

```bash
ssh wcc@<HOMESERVER> 'cd /home/wcc/apps/WCC && \
  opencode run \
    --agent wcc \
    --format json \
    --auto \
    "Perbaiki bug X. Ikuti aturan repo. Laporkan file yang diubah dan hasil verifikasi."'
```

- `--auto` menyetujui permission yang **tidak** dilarang config. Tanpa ini,
  eksekusi non-interaktif akan menggantung di prompt izin.
- `--format json` → keluaran NDJSON, mudah diparse Hermes.
- `--continue` melanjutkan sesi terakhir; `--session ses_xxx` melanjutkan sesi tertentu.

Skrip siap pakai: `ops/hermes/wcc-task` (pasang ke `/usr/local/bin/wcc-task`).
Jangan menulis ulang dari nol; skrip ini sudah menangani validasi JSON,
preflight repo, pengiriman prompt base64, timeout, log NDJSON, dan laporan
commit.

```bash
sudo install -m 0755 ops/hermes/wcc-task /usr/local/bin/wcc-task
wcc-task --dry-run ops/hermes/task.example.json | jq '{status, id, stage}'
wcc-task /etc/wcc/tasks/WCC-2026-10-29-001.json | jq
```

Alurnya:

1. Validasi tugas + field wajib.
2. Preflight di homeserver: repo ada, tree bersih, `git fetch`,
   branch cocok (atau `checkout: true`), `pull --ff-only`.
3. Prompt = tujuan + skill + batasan + kriteria + instruksi wajib.
4. `opencode run --agent wcc --format json --auto` dengan batas waktu.
5. Log mentah: `WCC_LOG_DIR/<id>.ndjson`.
6. Stdout: satu JSON (`status`, `commit`, `dirtyFiles`, `summary`, …).
7. Kode keluar: `0` ok, `2` usage, `3` preflight, `4` agen gagal /
   meninggalkan perubahan belum di-commit (`needs-review`).

Detail pemasangan, skema tugas, dan systemd ada di `ops/hermes/README.md`.

> `--auto` menyetujui semua permission yang tidak dilarang config. Pastikan
> larangan di Bagian 3.3 dan agent `wcc` sudah aktif sebelum memakai `--auto`.

### Mode B — HTTP API (untuk tugas panjang, streaming, atau banyak sesi)

1. Buat sesi:

```bash
SID=$(curl -fsS -u "opencode:$PW" \
  -H 'content-type: application/json' \
  -d '{
        "title": "WCC: perbaikan carousel",
        "agent": "wcc",
        "location": { "directory": "/home/wcc/apps/WCC" }
      }' \
  http://127.0.0.1:4096/api/session | jq -r '.data.id')
```

2. Kirim prompt (bisa sekaligus melampirkan skill):

```bash
curl -fsS -u "opencode:$PW" \
  -H 'content-type: application/json' \
  -d '{
        "text": "Perbaiki bug X. Verifikasi dengan typecheck + build.",
        "skills": [{ "id": "systematic-debugging" }]
      }' \
  "http://127.0.0.1:4096/api/session/$SID/prompt"
```

3. Tunggu sampai agen idle:

```bash
curl -fsS -u "opencode:$PW" -X POST \
  "http://127.0.0.1:4096/api/experimental/session/$SID/wait"   # 204 = idle
```

4. Ambil hasil:

```bash
curl -fsS -u "opencode:$PW" \
  "http://127.0.0.1:4096/api/session/$SID/message" | jq
```

5. (Opsional) Pantau event real-time:

```bash
curl -N -u "opencode:$PW" \
  "http://127.0.0.1:4096/api/event?types=session.updated,session.idle"
```

Endpoint lain yang berguna:

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/api/info` | versi, pid, URL, kesiapan server |
| `GET` | `/api/skill?location[directory]=/home/wcc/apps/WCC` | daftar skill yang terdeteksi |
| `GET` | `/api/session` | daftar sesi |
| `POST` | `/api/session/{id}/interrupt` | hentikan agen |
| `POST` | `/api/session/{id}/shell` | jalankan shell di sesi |
| `GET` | `/api/session/{id}/diff` | diff perubahan |
| `GET` | `/api/session/{id}/context` | konteks/token |
| `GET` | `/openapi.json` | spesifikasi OpenAPI lengkap |

### 4.1 Skema tugas (dipakai Hermes)

```jsonc
{
  "id": "WCC-2026-10-29-001",
  "repo": "Nahelahya/WCC",
  "directory": "/home/wcc/apps/WCC",
  "branch": "testing",
  "agent": "wcc",
  "checkout": false,
  "skills": ["systematic-debugging", "verification-before-completion"],
  "goal": "Landing: carousel kegiatan tidak konsisten di mode gelap. Perbaiki tanpa mengubah tema.",
  "constraints": [
    "Jangan mengubah framework/DB/desain",
    "Jangan menyentuh .env",
    "Jangan deploy sebelum verifikasi lolos"
  ],
  "acceptance": [
    "npm run typecheck (root) = 0",
    "cd server && npm run typecheck = 0",
    "npm run build sukses",
    "build Hostinger state=completed dan commit hash cocok",
    "GET /api/health ok=true 3x berturut-turut"
  ],
  "deploy": false,
  "report": { "format": "markdown", "channel": "<kanal Hermes>" }
}
```

Field yang dibaca `wcc-task`: `goal`, `id`, `branch`, `agent`, `directory`,
`checkout`, `skills`, `constraints`, `acceptance`. `repo`, `deploy`, dan
`report` hanya informatif; `wcc-deploy` tetap butuh `--yes` dan tidak membaca
`deploy`.

### 4.2 Aturan laporan balik

Hermes wajib mengembalikan ringkas:

```
STATUS: sukses | gagal | butuh keputusan
RINGKASAN: 1–3 kalimat
FILE: daftar file yang diubah
VERIFIKASI: perintah + hasil (typecheck/build/health)
COMMIT: <hash> (branch)
DEPLOY: ya/tidak, build state, waktu
RISIKO/SISA: hal yang belum selesai
```

Kalau agen butuh keputusan manusia (mis. mengubah skema DB), ia **harus berhenti**
dan melaporkan `butuh keputusan`, bukan menebak.

---

## 5. Skill yang dibutuhkan

Skill = instruksi reusable yang dimuat OpenCode saat relevan. Skill **tidak**
menambah kemampuan baru di luar tool yang ada; ia mengatur cara kerja.

### 5.1 Wajib (inti)

| Skill ID | Kegunaan | Sumber |
|---|---|---|
| `using-superpowers` | Disiplin memilih skill sebelum bertindak | `obra/superpowers` |
| `brainstorming` | Sebelum membuat fitur/perubahan perilaku | `obra/superpowers` |
| `writing-plans` | Memecah spesifikasi jadi rencana bertahap | `obra/superpowers` |
| `executing-plans` | Menjalankan rencana langkah demi langkah | `obra/superpowers` |
| `systematic-debugging` | Wajib saat ada bug/503/test gagal | `obra/superpowers` |
| `test-driven-development` | Sebelum menulis implementasi fitur | `obra/superpowers` |
| `verification-before-completion` | Bukti sebelum klaim "selesai" | `obra/superpowers` |
| `requesting-code-review` | Sebelum merge/perubahan besar | `obra/superpowers` |
| `receiving-code-review` | Menanggapi review dengan rigor | `obra/superpowers` |
| `using-git-worktrees` | Kerja paralel tanpa bentrok | `obra/superpowers` |
| `finishing-a-development-branch` | Memutuskan merge/PR/bersihkan branch | `obra/superpowers` |
| `dispatching-parallel-agents` | 2+ tugas independen | `obra/superpowers` |
| `subagent-driven-development` | Eksekusi rencana via subagent | `obra/superpowers` |

### 5.2 Wajib untuk WCC (domain)

| Skill ID | Kegunaan | Sumber |
|---|---|---|
| `supabase` | DB, Auth, RLS, migrasi, MCP, logs | `supabase/agent-skills` |
| `supabase-postgres-best-practices` | Sebelum mengubah skema/query/index/RLS | `supabase/agent-skills` |
| `opencode` | Cara kerja/config/API OpenCode itu sendiri | bawaan OpenCode |
| `browser` | Verifikasi UI, screenshot, console/network | bawaan OpenCode (butuh browser tools); di server headless pakai Playwright MCP |

### 5.3 Opsional (keamanan & kualitas)

| Skill ID | Kegunaan | Sumber |
|---|---|---|
| `find-security-vulnerabilities-in-code` | Audit kode white-box + PoC | `usestrix/strix` |
| `fix-security-vulnerabilities-with-strix` | Perbaiki temuan lalu buktikan tertutup | `usestrix/strix` |
| `api-security-testing` | Uji API (BOLA/IDOR, auth, injection) | `usestrix/strix` |
| `web-app-penetration-testing` | Pentest web end-to-end | `usestrix/strix` |
| `owasp-top-10-testing` | Audit sesuai OWASP Top 10 | `usestrix/strix` |
| `ci-security-scanning-with-strix` | Scan keamanan di CI | `usestrix/strix` |
| `ponytail` | Perubahan sekecil mungkin (anti over-engineering) | opsional |
| `video-demo` | Demo video/screenshot produk | opsional |

### 5.4 Install

Jalankan sebagai user service (`wcc`) agar skill ditemukan oleh OpenCode:
`sudo -u wcc -H bash` lebih dulu. Kalau nama agent tidak dikenali, ganti
`-a opencode` dengan `-a '*'`.

```bash
# Inti (global, untuk agent opencode)
npx skills add obra/superpowers -g -a opencode -y

# Domain
npx skills add supabase/agent-skills -g -a opencode -y

# Keamanan (opsional tapi disarankan)
npx skills add usestrix/strix -g -a opencode -y
```

Per-repo (lebih baik untuk skill yang harus ikut versi kode):

```bash
cd /home/wcc/apps/WCC
npx skills add usestrix/strix -a opencode -y
# menghasilkan .agents/skills/** + skills-lock.json (sudah ada di repo ini)
```

Cek hasil: `npx skills list` dan `ls ~/.config/opencode/skills`.

Verifikasi:

```bash
# PW sudah di-export pada langkah verifikasi 3.5
curl -fsS -u "opencode:$PW" \
  "http://127.0.0.1:4096/api/skill?location%5Bdirectory%5D=%2Fhome%2Fwcc%2Fapps%2FWCC" \
  | jq -r '.data[].id'

# atau di dalam sesi:
#   "Sebutkan skill yang tersedia." / pakai @nama-skill di prompt
```

Lokasi pencarian skill (OpenCode V2):

```
~/.config/opencode/skills/<id>/SKILL.md
~/.claude/skills, ~/.agents/skills        (kompatibilitas)
<sampai project root>/.opencode/skills
<sampai project root>/.claude/skills, .agents/skills
```

### 5.5 MCP server yang disarankan

| MCP | Fungsi | Cara |
|---|---|---|
| **Supabase** | inspeksi tabel, migrasi, logs, advisors | `opencode mcp add supabase --url https://mcp.supabase.com/mcp?project_ref=iiwujuwliqlwgdhdtayw` lalu `opencode mcp auth supabase` |
| **Playwright** | verifikasi UI/screenshot di server headless | `opencode mcp add playwright -- npx -y @playwright/mcp@latest --headless` |
| **Context7** (opsional) | dokumentasi library terkini | `opencode mcp add context7 --url https://mcp.context7.com/mcp` |

Cek koneksi: `opencode mcp list`.

---

## 6. API & kredensial yang dibutuhkan

Semua rahasia disimpan **di luar repo**: `/etc/opencode/*.env`, `~/.hermes/.env`,
atau secret manager. Repo hanya berisi placeholder di `.env.example`.

| # | Layanan | Dipakai untuk | Kredensial | Simpan di | Catatan |
|---|---|---|---|---|---|
| 1 | **OpenCode server** | eksekusi tugas | username + password Basic auth | `/etc/opencode/server.env` | listen `127.0.0.1:4096` |
| 2 | **OpenCode Zen/Go** | model Hermes/OpenCode | API key `oc_...` | `~/.hermes/.env`, `opencode auth login` | key per workspace, bisa dibatasi budget |
| 3 | **GitHub** | clone/push repo | PAT (scope `repo`) atau SSH deploy key | `~/.ssh/id_ed25519_wcc`, `~/.git-credentials` | lebih baik deploy key per host |
| 4 | **Hostinger API** | trigger build, restart, runtime log, env | bearer token | `~/.hermes/.env` | token bersifat akun; rotasi rutin |
| 5 | **Hostinger SSH** | inspeksi file/log di server | SSH key | `~/.ssh/` | hindari password auth |
| 6 | **Supabase** | DB produksi, migrasi, MCP | project ref + OAuth/service role | MCP OAuth / `~/.hermes/.env` | service role **jangan** masuk frontend |
| 7 | **Fonnte** (WhatsApp) | notifikasi pendaftaran disetujui | device token | env Hostinger | kuota & masa aktif device |
| 8 | **DOKU** | pembayaran online | client ID + secret | env Hostinger | webhook harus HTTPS publik |
| 9 | **Hostinger Mail API** | email transaksional | API token + mailbox ID | env Hostinger | alternatif SMTP |
| 10 | **Google Apps Script** | sinkron kas ke Sheets | URL `/exec` + shared secret | env Hostinger | lebih mudah dari service account |

### 6.1 Hostinger API — endpoint yang terverifikasi

Base: `https://developers.hostinger.com/api/hosting/v1/accounts/<USERNAME>/websites/<DOMAIN>/nodejs`

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/builds` | daftar build + commit hash + state |
| `POST` | `/builds` | trigger build manual |
| `GET` | `/builds/{uuid}/logs` | log build |
| `POST` | `/server/restart` | restart aplikasi |
| `GET` | `/runtime-logs?period=1h&limit=100` | log runtime (**hanya `1h` yang valid**; `6h/12h/24h` → 422) |
| `PUT` | `/builds/settings/env` | set environment variable |

Contoh (variabel diambil dari `~/.hermes/.env`, lihat Lampiran B):

```bash
set -a; source ~/.hermes/.env; set +a

curl -fsS -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  "https://developers.hostinger.com/api/hosting/v1/accounts/$HOSTINGER_ACCOUNT/websites/$HOSTINGER_DOMAIN/nodejs/builds" \
  | jq '.data[0] | {state, created_at, commit: .options.source_options.commit.hash}'

curl -fsS -X POST -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  "https://developers.hostinger.com/api/hosting/v1/accounts/$HOSTINGER_ACCOUNT/websites/$HOSTINGER_DOMAIN/nodejs/server/restart"
```

### 6.2 Environment produksi (Hostinger)

Wajib:

```
NODE_ENV=production
DATABASE_URL=postgresql://postgres.<REF>:<PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
JWT_SECRET=<min 32 karakter acak>
CORS_ORIGIN=https://wisanggeniclub.site,https://www.wisanggeniclub.site
PUBLIC_APP_URL=https://wisanggeniclub.site
COOKIE_SECURE=true
UPLOAD_DIR=/home/<HOSTINGER_USER>/wcc-uploads
```

Frontend (dibaca saat `vite build`):

```
VITE_API_MODE=live
VITE_API_URL=/api
```

Jangan set `PORT` (Passenger menyediakannya). Jangan taruh `.env` di repo.

Fitur opsional (isi hanya bila dipakai): `FONNTE_TOKEN`, `WA_GROUP_LINK`,
`WA_GROUP_NAME`, `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`, `DOKU_BASE_URL`,
`DOKU_NOTIFICATION_PATH`, `HOSTINGER_MAIL_API_TOKEN`,
`GOOGLE_APPS_SCRIPT_URL`, `GOOGLE_APPS_SCRIPT_TOKEN`, `GOOGLE_SHEETS_ID`,
`API_RATE_LIMIT`, `LOGIN_RATE_LIMIT`, `PASSWORD_RESET_RATE_LIMIT`.

### 6.3 Izin minimum

- GitHub: **satu repo saja** (`Nahelahya/WCC`), scope `repo` (fine-grained: Contents RW, Metadata R).
- Hostinger: token API satu akun — tidak ada scope granular; perlakukan sebagai kredensial tinggi.
- Supabase: MCP dengan OAuth akun; jangan menempel service role key di kode/agen prompt.
- Fonnte: satu device; cek kuota sebelum uji massal.
- Semua kredensial: `chmod 600`, owner user service, tidak masuk shell history (`export` dari file, bukan `--token` di command line).

---

## 7. Runbook WCC

### 7.1 Perintah dasar

```bash
cd /home/wcc/apps/WCC

# Frontend
npm ci                 # Linux: tidak perlu --force
npm run typecheck      # tsc --noEmit
npm run build          # vite build -> dist/

# Backend
cd server
npm ci
npm run typecheck
npm run db:migrate     # HANYA dengan DATABASE_URL yang benar
npm run dev            # lokal, port 4000
```

Lokal (dua terminal):

```bash
# terminal 1
cd /home/wcc/apps/WCC/server && npm run dev
# terminal 2
cd /home/wcc/apps/WCC && npm run dev     # Vite proxy /api -> localhost:4000
```

### 7.2 Alur perubahan yang benar

1. `git fetch origin && git status -sb` → working tree harus bersih.
2. Buat branch `fix/...` atau `feat/...` dari `testing`.
3. Implementasi + verifikasi (typecheck root & server, build).
4. Commit dengan pesan jelas (bahasa Indonesia, awalan `fix:`/`feat:`/`chore:`).
5. Push branch → review/merge ke `testing`.
6. Setelah lolos uji, fast-forward `main` dan push.
7. Push `main` = auto-deploy Hostinger. Tunggu build selesai.
8. Verifikasi produksi (7.4). Jika gagal → rollback (7.6).

```bash
git checkout testing && git pull --ff-only origin testing
# ... kerja ...
git add -A && git commit -m "fix(landing): ..."
git push origin testing

git checkout main && git pull --ff-only origin main
git merge --ff-only testing
git push origin main
git checkout testing
```

Branch `testing` **tidak** di-deploy otomatis. Hanya `main`.

### 7.3 Deploy & verifikasi build

**Jalur utama (dijaga):**

```bash
sudo -u hermes bash -c 'set -a; . /etc/wcc/hermes.env; set +a; \
  wcc-deploy --yes --to-main --task /etc/wcc/tasks/WCC-2026-10-29-001.json'
```

`wcc-deploy` melakukan preflight, push fast-forward
`<sha>:refs/heads/main`, polling build, lalu verifikasi 7.4. Tanpa `--yes`
tidak ada push. Tanpa `--to-main`, hanya branch sumber yang disinkronkan
(tidak memicu build). Detail: `ops/hermes/README.md`.

**Jalur manual (untuk debug):**

```bash
# variabel dari ~/.hermes/.env (jangan tulis token di command line)
set -a; source ~/.hermes/.env; set +a
BASE="https://developers.hostinger.com/api/hosting/v1/accounts/$HOSTINGER_ACCOUNT/websites/$HOSTINGER_DOMAIN/nodejs"
BUILDS_URL="$BASE/builds"
RESTART_URL="$BASE/server/restart"
LOGS_URL="$BASE/runtime-logs"
AUTH=(-H "Authorization: Bearer $HOSTINGER_API_TOKEN")

# tunggu build (poll tiap 15 dtk, maks 10 menit)
for i in $(seq 1 40); do
  BUILD=$(curl -fsS "${AUTH[@]}" "$BUILDS_URL")
  STATE=$(jq -r '.data[0].state' <<<"$BUILD")
  HASH=$(jq -r '.data[0].options.source_options.commit.hash' <<<"$BUILD")
  echo "$(date -u +%H:%M:%S) state=$STATE commit=${HASH:0:7}"
  [ "$STATE" = "completed" ] && break
  [ "$STATE" = "failed" ] && { echo "BUILD GAGAL"; exit 1; }
  sleep 15
done
```

Bila perlu restart manual:

```bash
curl -fsS -X POST "${AUTH[@]}" "$RESTART_URL"
```

### 7.4 Verifikasi produksi (wajib setelah deploy)

```bash
# 1. health 3x, harus ok=true dan bootedAt/uptime wajar
for i in 1 2 3; do
  curl -fsS "https://wisanggeniclub.site/api/health?cb=$(date +%s%N)" | jq -c
  sleep 20
done

# 2. landing + login (HTML 200, bukan halaman 503)
curl -fsS -o /dev/null -w '%{http_code}\n' https://wisanggeniclub.site/
curl -fsS -o /dev/null -w '%{http_code}\n' https://wisanggeniclub.site/masuk

# 3. satu endpoint API publik
curl -fsS "https://wisanggeniclub.site/api/landing?cb=$(date +%s%N)" | jq '.hero.title'
```

Cek runtime log:

```bash
curl -fsS "${AUTH[@]}" "$LOGS_URL?period=1h&limit=100" \
  | jq -r '.logs[] | "\(.timestamp) [\(.level)] \(.message)"' | tail -40
```

Yang **bukan** error: `SIGTERM diterima, menutup server...` saat restart/deploy.
Yang **error**: `uncaughtException`, `unhandledRejection`, `ECONNREFUSED`,
`JWT_SECRET wajib diisi`, `Failed to listen`.

### 7.5 Migrasi database (produksi)

Migrasi **tidak** dijalankan otomatis oleh Hostinger.

- Disarankan: jalankan SQL lewat MCP Supabase (`apply_migration`) setelah review.
- Alternatif: `DATABASE_URL=<prod> npm run db:migrate` dari mesin tepercaya.
  Runner menjalankan **semua** file `server/src/db/migrations/*.sql` berurutan
  dan mengabaikan error "already exists".
- Sebelum migrasi: backup/export, cek apakah perubahan destruktif (DROP/ALTER
  tipe), dan pastikan kompatibel dengan kode yang sedang live.

### 7.6 Rollback

```bash
git revert --no-edit <commit>
git push origin main          # memicu build baru
# tunggu state=completed, lalu verifikasi 7.4
```

Jangan `git push --force` ke `main`. Jangan `git reset --hard` di repo produksi.

### 7.7 Jebakan yang sudah pernah terjadi

| Gejala | Penyebab | Penanganan |
|---|---|---|
| Semua rute 503 "server is temporarily busy" | proses Node belum siap saat deploy/restart; proses lama menahan port; service worker menyimpan halaman 503 | cek runtime log; restart; SW versi `wcc-v4` hanya cache 2xx; minta pengguna reload 2x / Ctrl+F5 |
| `/api/*` 404 HTML, `/` statis lama | app type salah (vite/static) atau output dir `dist` | set Express, output dir kosong, entry `server.cjs` |
| `ERR_REQUIRE_ASYNC_MODULE` | entry ESM/top-level await | entry harus `server.cjs` (CJS) |
| `JWT_SECRET wajib diisi` | env tidak terbaca | cek `hbuilds/config/.env` / env panel |
| Upload hilang setelah deploy | `UPLOAD_DIR` di dalam `hbuilds/` | arahkan ke `/home/<user>/wcc-uploads` |
| Login sukses tapi logout | `COOKIE_SECURE=true` tanpa HTTPS / CORS salah | perbaiki domain & HTTPS |
| Build gagal | dependency Linux (`@rolldown/binding-linux-x64-gnu`) atau type error | build di Linux; `npm run typecheck` dulu |
| `npm install` gagal di Windows | binding Linux-only | `npm install --force` (hanya Windows) |

### 7.8 Aturan repo yang tidak boleh dilanggar

1. Jangan mengubah framework, database, backend, tema, atau navigasi tanpa permintaan eksplisit.
2. Jangan commit `.env`, kredensial, dump DB, atau file upload.
3. Jangan mengedit `hbuilds/` atau `public_html/` di Hostinger (ditimpa deploy).
4. Jangan menambah dependency baru tanpa alasan kuat; cek lisensi & ukuran.
5. Ikuti pola yang ada: komentar bahasa Indonesia, struktur `src/pages`, `src/api`, `server/src/routes`.
6. Semua perubahan perilaku harus punya verifikasi (test/manual yang dijelaskan).
7. Jangan men-deploy perubahan yang belum lolos `typecheck` + `build`.
8. Jangan menampilkan token di output, log, commit, atau laporan.

---

## 8. Smoke test setelah setup

Jalankan berurutan; semua harus lolos sebelum Hermes dipakai untuk deploy.
Kalau `PW` belum di-export (lihat 3.5), set dulu:

```bash
read -rsp 'OpenCode server password: ' PW; echo; export PW
```

```bash
# 1. OpenCode hidup
curl -fsS -u "opencode:$PW" http://127.0.0.1:4096/api/info | jq '{version, pid, urls}'

# 2. Skill terdeteksi
curl -fsS -u "opencode:$PW" \
  "http://127.0.0.1:4096/api/skill?location%5Bdirectory%5D=%2Fhome%2Fwcc%2Fapps%2FWCC" \
  | jq -r '.data[].id' | sort | head -30

# 3. Repo bersih & bisa build
cd /home/wcc/apps/WCC
git status -sb
npm ci && npm run typecheck && npm run build
(cd server && npm ci && npm run typecheck)

# 3b. Skrip Hermes valid
bash -n /usr/local/bin/wcc-task /usr/local/bin/wcc-deploy
wcc-task --dry-run ops/hermes/task.example.json | jq -e '.status == "dry-run"'

# 4. Agen bisa menjawab tanpa mengubah file
opencode run --agent wcc --format json --auto \
  "Baca README.md dan HOSTINGER.md. Sebutkan stack, entry point, dan 3 aturan deploy. Jangan ubah file."

# 5. Tugas tulis kecil (di branch uji)
git checkout -b chore/smoke-test
opencode run --agent wcc --format json --auto \
  "Tambahkan komentar dokumentasi pada fungsi pertama di src/lib/imageCrop.ts, lalu jalankan typecheck. Jangan commit."
git diff --stat
git checkout -- . && git checkout testing && git branch -D chore/smoke-test
```

Kriteria lulus: tidak ada prompt izin yang menggantung, tidak ada file `.env`
terbaca, `git status` kembali bersih, dan laporan memuat hasil verifikasi.

---

## 9. Rotasi rahasia (lakukan SEBELUM menyerahkan akses)

Token yang pernah dibagikan lewat chat, screenshot, atau terminal harus
dianggap bocor. Urutan aman: **buat baru → pasang → verifikasi → cabut yang lama**.

- [ ] Hostinger API token → hPanel → API → buat token baru, cabut lama
- [ ] Hostinger SSH password → ganti dengan SSH key, nonaktifkan password login
- [ ] Supabase database password → reset di dashboard, update `DATABASE_URL`, restart app
- [ ] Supabase service role / access token → rotate, update MCP
- [ ] GitHub PAT → regenerate, batasi ke repo WCC
- [ ] Fonnte device token → rotate di dashboard, update env
- [ ] DOKU secret key → regenerate (sandbox & produksi terpisah)
- [ ] Hostinger Mail API token → regenerate
- [ ] Google Apps Script shared secret → ganti `SECRET` di script + env
- [ ] `JWT_SECRET` → ganti (semua sesi login lama otomatis logout)
- [ ] Password admin/pengurus → ganti lewat menu pengguna
- [ ] OpenCode server password → ganti di `/etc/opencode/server.env` + restart
- [ ] Hapus kredensial dari shell history: `history -c`, cek `~/.bash_history`

Setelah rotasi:

```bash
sudo systemctl restart opencode
curl -fsS -X POST -H "Authorization: Bearer $TOKEN" "$RESTART_URL"
```

---

## 10. Checklist go-live

**Host & akses**
- [ ] Ubuntu up-to-date, UFW aktif, fail2ban aktif, auto-update aktif
- [ ] User non-root untuk service, SSH key-only
- [ ] Node 22, git, jq, rg terpasang
- [ ] OpenCode systemd `active (running)`, listen `127.0.0.1:4096`
- [ ] Password server kuat (>= 32 char), file env `600`
- [ ] (Topologi B) tunnel SSH/Tailscale aktif & auto-restart

**OpenCode**
- [ ] `opencode auth list` menunjukkan provider aktif
- [ ] `opencode models` menampilkan model yang dipakai
- [ ] Config permissions memblokir `.env`, `sudo`, force-push, reset hard
- [ ] Agent `wcc` terdeteksi (`opencode debug agents` / `GET /api/agent`)
- [ ] Skill inti + Supabase terdeteksi
- [ ] MCP Supabase `connected`; Playwright siap (jika dipakai)

**Repo & deploy**
- [ ] Clone bersih, `git status` bersih, remote benar
- [ ] `npm ci` + typecheck + build sukses di Linux
- [ ] Token GitHub bisa push ke branch uji
- [ ] Token Hostinger bisa baca builds & restart
- [ ] Health produksi `ok:true`, landing & `/masuk` 200
- [ ] Runtime log bersih setelah restart
- [ ] Prosedur rollback diuji minimal sekali di branch uji

**Operasional**
- [ ] Hermes punya skema tugas + format laporan (Bagian 4)
- [ ] `ops/hermes/wcc-task` dan `wcc-deploy` terpasang; dry-run lolos
- [ ] Push/deploy hanya lewat `wcc-deploy --yes`; agen tidak bisa push
- [ ] Satu repo = satu tugas aktif; worktree untuk paralel
- [ ] Alert dikirim ke kanal yang dipantau manusia
- [ ] Dokumen ini disimpan di repo (`docs/handoff-hermes-ubuntu.md`) dan di Hermes

---

## 11. Prompt siap tempel untuk Hermes

```text
Kamu adalah Hermes yang mengoperasikan homeserver Ubuntu untuk proyek
WISANGGENI CLIMBING CLUB (WCC). Baca dokumen
docs/handoff-hermes-ubuntu.md di repo https://github.com/Nahelahya/WCC
dan ikuti persis.

Tugasmu sekarang:
1. Verifikasi prasyarat Ubuntu (Node 22, git, jq, rg, ufw, fail2ban).
2. Pastikan OpenCode berjalan sebagai service di 127.0.0.1:4096 dengan
   Basic auth dari /etc/opencode/server.env. Jangan buka port ke publik.
3. Pastikan skill inti terpasang (obra/superpowers, supabase/agent-skills,
   usestrix/strix) dan terdeteksi lewat /api/skill.
4. Jalankan smoke test Bagian 8. Laporkan setiap langkah: perintah, hasil,
   dan status lulus/gagal. Jangan mengubah kode aplikasi pada tahap ini.
5. Jika semua lulus, ringkas: versi OpenCode, model, daftar skill, status
   MCP, path repo, dan commit hash yang aktif.

Aturan:
- Jangan pernah mencetak atau menyimpan token di log/laporan.
- Jangan menjalankan deploy, migrasi DB, atau push ke main pada tahap ini.
- Jika butuh keputusan manusia, berhenti dan tulis "BUTUH KEPUTUSAN: ...".

Format laporan:
STATUS / RINGKASAN / LANGKAH & HASIL / RISIKO / LANGKAH BERIKUTNYA
```

---

## Lampiran A — Ringkasan perintah harian

```bash
# status
sudo systemctl status opencode --no-pager
curl -fsS -u "opencode:$PW" http://127.0.0.1:4096/api/info | jq '.version'

# tugas non-interaktif
wcc-task /etc/wcc/tasks/<id>.json | jq '{status, commit, dirtyFiles}'

# sesi HTTP
SID=$(curl -fsS -u "opencode:$PW" -H 'content-type: application/json' \
  -d '{"agent":"wcc","location":{"directory":"/home/wcc/apps/WCC"}}' \
  http://127.0.0.1:4096/api/session | jq -r '.data.id')

# deploy WCC (butuh persetujuan manusia)
wcc-deploy --yes --to-main --sha <sha>
# skrip menunggu /builds dan memverifikasi /api/health

# log runtime (variabel dari 7.3)
curl -fsS "${AUTH[@]}" "$LOGS_URL?period=1h&limit=100" \
  | jq -r '.logs[] | "\(.timestamp) [\(.level)] \(.message)"' | tail -40
```

## Lampiran B — Variabel yang harus diisi di sisi Hermes

Contoh lengkap dan siap salin: `ops/hermes/hermes.env.example`.

```bash
# /etc/wcc/hermes.env  (0640 root:hermes)
OPENCODE_SERVER_URL=http://127.0.0.1:4096
OPENCODE_SERVER_USERNAME=opencode
OPENCODE_SERVER_PASSWORD=<...>
OPENCODE_ZEN_API_KEY=<...>
OPENCODE_GO_API_KEY=<...>

GITHUB_TOKEN=<...>
HOSTINGER_API_TOKEN=<...>
HOSTINGER_ACCOUNT=<...>
HOSTINGER_DOMAIN=wisanggeniclub.site

WCC_SSH_HOST=wcc@<HOMESERVER>
WCC_SSH_KEY=/home/hermes/.ssh/id_ed25519_wcc
WCC_REPO_DIR=/home/wcc/apps/WCC
WCC_PROD_URL=https://wisanggeniclub.site

SUPABASE_PROJECT_REF=iiwujuwliqlwgdhdtayw
SUPABASE_ACCESS_TOKEN=<...>

FONNTE_TOKEN=<...>
DOKU_CLIENT_ID=<...>
DOKU_SECRET_KEY=<...>
```

Jangan meng-commit file ini. Jangan menyalinnya ke dalam prompt.
