# Otomasi sisi Hermes (Ubuntu)

Paket ini menjembatani **Hermes** (penerima perintah manusia) dengan **OpenCode**
(eksekutor kode di homeserver) untuk repo WCC.

Isi:

| File | Fungsi |
|---|---|
| `wcc-task` | kirim satu tugas JSON ke OpenCode lewat SSH, simpan log NDJSON, kembalikan JSON |
| `wcc-deploy` | push fast-forward + tunggu build Hostinger + verifikasi produksi (butuh `--yes`) |
| `wcc-task@.service` | unit systemd oneshot untuk menjalankan tugas bernama |
| `opencode-tunnel.service` | tunnel SSH permanen ke `127.0.0.1:4096` (topologi B) |
| `hermes.env.example` | contoh variabel lingkungan; **jangan** isi nilai asli di repo |
| `task.example.json` | contoh skema tugas |

Dokumen arsitektur lengkap: `docs/handoff-hermes-ubuntu.md`.
Agen OpenCode yang dipakai: `.opencode/agents/wcc.md` (ikut ter-review di repo).

---

## 1. Pembagian peran yang dijaga skrip ini

```
manusia --setuju--> Hermes --wcc-task--> OpenCode (agent wcc) --commit lokal
                                                              |
manusia --setuju--> Hermes --wcc-deploy --yes-----------------+--> git push --> Hostinger
```

- `wcc-task` **tidak** melakukan push/deploy. Agen juga dilarang push oleh
  permission di `.opencode/agents/wcc.md`.
- `wcc-deploy` **selalu** butuh `--yes`. Tanpa `--yes`, skrip berhenti dengan
  kode 2.
- Satu repo = satu tugas aktif. Jangan menjalankan dua `wcc-task` bersamaan di
  direktori yang sama (pakai `git worktree` bila perlu paralel).

---

## 2. Pasang di host Hermes

Prasyarat: Ubuntu 22.04/24.04, `bash`, `git`, `curl`, `jq`, `openssh-client`,
`coreutils` (`timeout`), dan akses SSH ke homeserver sebagai user `wcc`.

```bash
# 1. Skrip
sudo install -m 0755 wcc-task   /usr/local/bin/wcc-task
sudo install -m 0755 wcc-deploy /usr/local/bin/wcc-deploy

# 2. Konfigurasi (rahasia)
sudo install -d -m 0750 -o root -g hermes /etc/wcc
sudo install -m 0640 -o root -g hermes hermes.env.example /etc/wcc/hermes.env
sudoedit /etc/wcc/hermes.env          # isi nilai asli

# 3. Direktori tugas & log
sudo install -d -m 0750 -o hermes -g hermes /etc/wcc/tasks
install -d -m 0750 "$HOME/.local/state/wcc/logs"

# 4. Unit systemd
sudo install -m 0644 wcc-task@.service /etc/systemd/system/
sudo install -m 0644 opencode-tunnel.service /etc/systemd/system/
sudo systemctl daemon-reload
```

`/etc/wcc/hermes.env` tidak dibaca otomatis oleh shell. Untuk pemakaian manual:

```bash
set -a; . /etc/wcc/hermes.env; set +a
```

Unit systemd membacanya lewat `EnvironmentFile=`.

### Tunnel (hanya topologi B)

Edit `opencode-tunnel.service`, ganti `wcc@HOMESERVER`, lalu:

```bash
sudo systemctl enable --now opencode-tunnel
systemctl status opencode-tunnel --no-pager
curl -fsS -u "opencode:$OPENCODE_SERVER_PASSWORD" \
  http://127.0.0.1:4096/api/info | jq '{version, pid}'
```

Untuk topologi A (Hermes dan OpenCode satu host), lewati unit tunnel dan set
`WCC_SSH_HOST=wcc@localhost` atau panggil `opencode run` langsung.

---

## 3. Menjalankan tugas

```bash
sudoedit /etc/wcc/tasks/WCC-2026-10-29-001.json   # salin dari task.example.json
sudo -u hermes bash -c 'set -a; . /etc/wcc/hermes.env; set +a; \
  wcc-task /etc/wcc/tasks/WCC-2026-10-29-001.json'
```

Atau lewat systemd (nama instance = nama file tanpa `.json`):

```bash
sudo systemctl start wcc-task@WCC-2026-10-29-001
journalctl -u wcc-task@WCC-2026-10-29-001 -f
```

Uji tanpa menyentuh homeserver:

```bash
wcc-task --dry-run task.example.json | jq '{status, id, stage}'
```

### Skema tugas

Field yang dibaca `wcc-task`:

| Field | Wajib | Arti |
|---|---|---|
| `goal` | ya | tujuan dalam bahasa manusia |
| `id` | tidak | nama log; default `wcc-<UTC timestamp>` |
| `branch` | tidak | default `testing`; harus sama dengan branch aktif |
| `agent` | tidak | default `wcc` |
| `directory` | tidak | default `WCC_REPO_DIR` |
| `checkout` | tidak | `true` = pindah/buat branch otomatis saat preflight |
| `skills` | tidak | daftar skill yang harus dipakai |
| `constraints` | tidak | larangan eksplisit |
| `acceptance` | tidak | kriteria selesai |

Field `repo`, `deploy`, dan `report` hanya informatif untuk Hermes.

### Perilaku `wcc-task`

1. Validasi JSON + field.
2. Preflight di homeserver: repo ada, working tree bersih, `git fetch`,
   branch cocok (atau checkout bila `checkout: true`), `pull --ff-only`.
3. Prompt disusun dari tugas + instruksi wajib, dikirim **base64** lewat stdin
   SSH (aman dari kutip/spasi).
4. `opencode run --agent wcc --format json --auto` dijalankan dengan batas waktu.
5. Log NDJSON disimpan di `WCC_LOG_DIR/<id>.ndjson`.
6. Laporan pasca-jalan: commit, jumlah file berubah, commit ahead, working tree.
7. Stdout: **satu objek JSON**. Stderr: log manusia.

Contoh keluaran:

```json
{
  "status": "ok",
  "id": "WCC-2026-10-29-001",
  "branch": "testing",
  "agent": "wcc",
  "commit": "1a2b3c4...",
  "dirtyFiles": 0,
  "changedFiles": 4,
  "commitsAhead": 1,
  "logFile": "/home/hermes/.local/state/wcc/logs/WCC-2026-10-29-001.ndjson",
  "stage": "run",
  "summary": "STATUS: sukses ...",
  "exitCode": 0
}
```

Status: `ok`, `needs-review` (agen meninggalkan perubahan belum di-commit),
`failed`, `preflight-failed`, `dry-run`.

| Kode | Arti |
|---|---|
| 0 | tugas selesai, tree bersih |
| 2 | usage/konfigurasi/JSON salah |
| 3 | preflight gagal (repo kotor, branch salah, commit tidak ada) |
| 4 | agen gagal/timeout atau meninggalkan perubahan belum di-commit |

`needs-review` **bukan** sukses: manusia harus memeriksa diff lalu commit atau
minta agen merapikan.

---

## 4. Deploy

```bash
# Sinkronkan testing saja (tidak memicu build)
wcc-deploy --yes

# Promosikan commit dari testing ke main (memicu auto-deploy Hostinger)
wcc-deploy --yes --to-main --task /etc/wcc/tasks/WCC-2026-10-29-001.json

# Deploy commit tertentu
wcc-deploy --yes --to-main --sha 1a2b3c4d5e6f...
```

Yang dilakukan `wcc-deploy`:

1. Resolve commit ke SHA penuh di homeserver.
2. Preflight: tree bersih, commit ada, target adalah leluhur SHA (fast-forward),
   `npm run typecheck`, `(cd server && npm run typecheck)`.
3. `git push origin <sha>:refs/heads/<target>` — tanpa checkout, tanpa force.
4. Verifikasi `git ls-remote` = SHA.
5. Bila target `main`: poll `/builds` sampai `state=completed` (maks
   `WCC_BUILD_TIMEOUT`), lalu cek `/api/health` 3x (harus `ok=true`), landing,
   `/masuk`, dan `/api/landing` (HTTP 200).
6. Stdout: satu objek JSON berisi status, commit, state build, sampel health.

Tanpa `--to-main`, hanya branch sumber yang disinkronkan; tidak ada build.

`--with-build` menjalankan `npm run build` di homeserver sebelum push. Build
produksi tetap dilakukan Hostinger.

### Bila build tidak terdeteksi

Hostinger auto-deploy hanya untuk `main`. Bila tidak ada build dengan commit
yang cocok dalam 90 detik:

- picu manual di panel Hostinger, atau
- set `WCC_ALLOW_BUILD_TRIGGER=1` untuk mencoba `POST /builds`
  (endpoint ini **belum terverifikasi**; periksa hasilnya).

`--skip-wait` hanya untuk darurat: push terjadi, verifikasi dilewati.

---

## 5. Keamanan

- Rahasia hanya di `/etc/wcc/hermes.env` (`0640 root:hermes`) atau
  `/etc/opencode/server.env` (`0600`). Jangan di repo, prompt, atau argumen CLI.
- `wcc-deploy` tidak pernah mencetak token. Header auth dibentuk di memori.
- Agen `wcc` tidak boleh push/deploy/migrasi; lihat `.opencode/agents/wcc.md`.
- Kunci SSH Hermes hanya boleh login sebagai `wcc` di homeserver dan hanya
  untuk repo WCC. Gunakan `command=`/`restrict` bila memungkinkan.
- Port OpenCode hanya `127.0.0.1` atau IP privat (Tailscale/WireGuard).
- Rotasi kredensial sebelum memberi akses ke agen baru (Bagian 9 dokumen
  handoff).

---

## 6. Troubleshooting

| Gejala | Sebab | Tindakan |
|---|---|---|
| `preflight-failed`, `working tree kotor` | ada perubahan belum di-commit | `cd /home/wcc/apps/WCC && git status`, commit/stash, ulangi |
| `branch aktif 'x', tugas minta 'y'` | branch tidak cocok | set `"checkout": true` atau pindah branch manual |
| `pull bukan fast-forward` | branch lokal dan remote divergen | selesaikan manual; jangan reset paksa |
| `agen melewati batas waktu` | tugas terlalu besar | pecah tugas; naikkan `WCC_TASK_TIMEOUT` bila perlu |
| `needs-review` | agen tidak commit | periksa `git diff`, commit sendiri atau minta agen lanjut |
| `bukan fast-forward` saat deploy | `main` sudah maju | tarik `main`, merge/rebase di branch uji, ulangi |
| `build tidak selesai` | build gagal atau tidak dipicu | cek panel Hostinger + runtime log |
| `unhealthy` | 503/health gagal setelah deploy | cek `journalctl -u opencode`, runtime log, rollback 7.6 |

Log mentah agen: `WCC_LOG_DIR/<id>.ndjson`. Ringkasan terakhir ada di field
`summary` pada JSON keluaran.

---

## 7. Verifikasi cepat setelah instalasi

```bash
set -a; . /etc/wcc/hermes.env; set +a

# 1. Skrip valid
bash -n /usr/local/bin/wcc-task
bash -n /usr/local/bin/wcc-deploy
command -v shellcheck >/dev/null && shellcheck /usr/local/bin/wcc-task /usr/local/bin/wcc-deploy

# 2. Dry run
wcc-task --dry-run task.example.json | jq -e '.status == "dry-run"'

# 3. SSH + repo
ssh "$WCC_SSH_HOST" "cd $WCC_REPO_DIR && git status -sb && git log --oneline -1"

# 4. Tugas baca-saja (tidak mengubah file)
#    Buat task dengan goal: "Sebutkan stack dan 3 aturan deploy. Jangan ubah file."
#    Lalu pastikan status=ok dan dirtyFiles=0.

# 5. Deploy pertama hanya setelah tugas uji di branch testing lolos.
```
