# Prompt: Web Lapor Website Pemerintah + Auto-Fix AI Harness (OpenCode Serve)

## 1. Tujuan
Bangun aplikasi end-to-end tempat masyarakat melaporkan masalah website pemerintah (`*.go.id`), lalu backend secara **otomatis (tanpa klik admin)**:
1. Mengecek kondisi live website (`fetch` + Playwright).
2. Mengubah laporan + bukti live menjadi prompt terstruktur.
3. Mengirim prompt ke **OpenCode Wrapper (`POST :3001/chat`)** yang berkomunikasi dengan `opencode serve` via SDK `@opencode/client` untuk memperbaiki kode di repo terkait hingga verifikasi yang tersedia lolos (hanya script npm yang memang ada di repo; project tanpa test tidak dipaksa test).
4. Melakukan `git push` dan membuat Pull Request otomatis via `gh pr create`.

> **Wajib:** Gunakan arsitektur `opencode serve` + `@opencode/client` (bukan CLI `opencode run`).

---

## 2. Arsitektur & Tech Stack

```text
[Next.js App :3000]  --(POST /api/reports + after())-->  [Orchestrator Harness]
                                                               |
                     +-----------------------------------------+
                     v
        [OpenCode Wrapper :3001]  <--(@opencode/client)-->  [opencode serve :4096 / Service.ensure()]
```

- **Web & API**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma (SQLite dev / Postgres prod), Zod.
- **OpenCode Wrapper (`services/opencode-wrapper/`)**: Express + `cors` + `@opencode/client` (`^2.0.32`).
- **Live Check & VCS**: `fetch` + Playwright (screenshot & `EVIDENCE.md`), `git` + `gh` CLI (push & PR hanya dilakukan oleh orchestrator).

---

## 3. Cara Kerja OpenCode Wrapper (`services/opencode-wrapper/`)

Buat service Express di port `:3001` yang membungkus `@opencode/client` dengan dua modul utama:

### 3.1 Koneksi Client (`opencode.js`)
- Gunakan `OpenCode` dari `@opencode/client` dan `Service` dari `@opencode/client/service`.
- **`getClient()` (singleton cached)**:
  - **Mode URL (`OPENCODE_URL` diset)**: Konek via `OpenCode.make({ baseUrl: process.env.OPENCODE_URL, headers })`. Dukung header `Authorization: Bearer <OPENCODE_TOKEN>` atau Basic Auth dari `OPENCODE_USERNAME` & `OPENCODE_PASSWORD`. Verifikasi koneksi dengan `await client.server.info()`.
  - **Mode Default (`OPENCODE_URL` kosong)**: Jalankan `const endpoint = await Service.ensure()` (otomatis menyalakan background `opencode serve --service`), lalu `OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) })`.
- **`extractAssistantText(messages)`**:
  - Baca array dari `messages?.data ?? messages ?? []` secara mundur (terbaru ke terlama).
  - Cari item dengan `type === 'assistant'` dan `Array.isArray(content)`, ambil semua bagian `type === 'text'`, gabungkan `text`-nya dengan `\n`, lalu kembalikan `{ text, message }`.

### 3.2 Endpoint HTTP (`server.js`)
Jika `getClient()` gagal konek di endpoint mana pun, balas HTTP `503 { error: "opencode_unavailable", hint, detail }`.

- `GET /health` -> panggil `client.server.info()`, balas `{ ok: true, opencode: info }`.
- `POST /sessions` `{ directory?, title?, agent?, model? }` -> panggil `client.session.create({ title, agent, model, location: { directory: directory || WORKDIR } })`.
- `GET /sessions/:id/messages?limit=50` -> panggil `client.message.list({ sessionID: req.params.id, limit })`.
- `GET /sessions/:id/activity?limit=100` -> panggil `client.message.list(...)` lalu sederhanakan via `extractActivity(messages)` menjadi `{ sessionID, activity: [{ key, line }] }` — satu baris per tool call / perintah shell / catatan AI. Dipakai harness untuk live feed.
- `POST /chat` `{ message, sessionID?, directory?, agent?, model?, timeoutMs? }`:
  1. Jika `sessionID` kosong, buat session baru via `client.session.create({ agent, model, location: { directory: directory || WORKDIR } })`.
  2. Kirim prompt: `await client.session.prompt({ sessionID: sid, text: message })` *(catatan: `prompt()` hanya mengirim pesan user, belum menghasilkan balasan akhir)*.
  3. Tunggu proses selesai (idle): `await client.session.wait({ sessionID: sid }, { signal: AbortSignal.timeout(timeoutMs || WAIT_TIMEOUT_MS) })` *(tangkap error timeout agar tetap lanjut mengambil pesan parsial yang sudah ada)*.
  4. Ambil pesan: `const messages = await client.message.list({ sessionID: sid, limit: 20 })` lalu ekstrak jawaban dengan `extractAssistantText(messages)`.
  5. Balas `{ sessionID: sid, reply: text, assistantMessage, messages }`.
- `POST /sessions/:id/interrupt` -> panggil `client.session.interrupt({ sessionID: req.params.id })`.
- `GET /events` -> SSE (`text/event-stream`) passthrough menggunakan `for await (const event of client.event.subscribe())`.

---

## 4. Skema Database (Prisma)

```prisma
model Report {
  id          String   @id @default(cuid())
  siteUrl     String
  deskripsi   String   @db.Text
  screenshot  String?
  namaPelapor String?
  kontak      String?  // email saja (opsional)
  status      String   @default("baru") // baru | diproses-ai | pr-dibuat | selesai | ditolak
  prompt      String?  @db.Text
  harnessLog  String?  @db.Text
  prUrl       String?
  repoUrl     String?
  sessionId   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## 5. Halaman & API (Next.js)

### Halaman
1. **`/` (Form Publik)**:
   - Input: `siteUrl` (wajib http/https, beri warning jika bukan `*.go.id`), `deskripsi` (min 20 karakter: langkah reproduksi + ekspektasi vs aktual), `screenshot` (opsional, image maks 5MB), `namaPelapor` & `kontak` email (opsional).
   - Submit -> arahkan ke `/lapor/[id]`.
2. **`/lapor/[id]` (Tracking Publik)**:
   - Menampilkan `status`, detail laporan, `prompt` (read-only collapsible), `sessionId`, `harnessLog`, dan link `prUrl`.
3. **`/admin` (Monitoring Read-Only)**:
   - Tabel laporan (filter status, cari URL/deskripsi/ID) & detail lengkap (`sessionId`, `prompt`, log iterasi, `prUrl`).
   - Diproteksi header `x-admin-key: ADMIN_KEY`. **Tanpa tombol trigger manual.**

### Endpoint API
- `POST /api/reports`: Validasi Zod + rate-limit 10 req/IP/jam -> simpan status `baru` -> return `{ id }` segera -> jalankan `processViaWrapper(id)` secara async di background (`after()`).
- `GET /api/reports/[id]`: Detail laporan publik.
- `GET /api/reports`: Daftar laporan untuk admin (wajib `x-admin-key`).

---

## 6. Alur Kerja Harness (`harness/`)

Prinsip: **sistem hanya menyiapkan repo — sisanya dikerjakan AI sampai PR**.
Harness tidak melakukan mutasi git apa pun dan tidak menjalankan verifikasi sendiri.

1. **Inisialisasi & Mapping Repo**:
   - Set status `diproses-ai`. Cocokkan `siteUrl` ke `config/site-to-repo.json` dan pastikan ada di `config/allowed-repos.txt`. Jika gagal -> set `ditolak`, hentikan proses.
2. **Cek Live & Siapkan Repo**:
   - Akses `siteUrl` dengan `fetch` + Playwright -> simpan `/tmp/harness-<id>/EVIDENCE.md` dan `artifacts/<id>-live.png` (bahan prompt).
   - Bangun SATU prompt end-to-end dari `harness/opencode-prompt.template.md` (fix + verifikasi mandiri + git + PR + format balasan `PR_URL:`). Simpan ke `Report.prompt`.
   - `git clone <repoUrl> /tmp/harness-<id>/repo`, set git identity lokal, tulis `opencode.json` guardrails (AI boleh git branch/add/commit/push & `gh pr create`; yang berbahaya tetap deny: force-push, push main/master, reset --hard, `gh pr merge`, dll).
3. **Serahkan ke AI**:
   - Buat session baru (`POST /sessions`), kirim prompt (`POST /chat` dengan `timeoutMs=AI_TASK_TIMEOUT_MS`), lalu polling `GET /sessions/:id/activity` setiap 2,5 detik — setiap baris activity (`edit ...`, `$ ...`, `ai: ...`) langsung disimpan ke `Report.harnessLog` sebagai live feed.
   - Jika balasan akhir belum memuat `PR_URL:` -> kirim lanjutan "lanjutkan sampai PR terbuat" (maks 3x). Jika AI menyatakan terhalang / wrapper error -> berhenti, status tetap `diproses-ai`.
4. **Catat PR (read-only)**:
   - Ekstrak `https://github.com/.../pull/<n>` dari balasan AI, verifikasi via `gh pr view <url> --json url,state`.
   - Simpan `prUrl`, ubah status ke `pr-dibuat`, hapus WORKDIR.

---

## 7. Struktur File, Konfigurasi & Deliverables

1. **Wrapper**: `services/opencode-wrapper/{server.js,opencode.js}` (implementasi sesuai §3).
2. **Harness**: `harness/build-prompt.ts`, `harness/process-via-wrapper.ts`, `harness/opencode-prompt.template.md`.
3. **Config**: `config/site-to-repo.json` (3 contoh `*.go.id`), `config/allowed-repos.txt`, `opencode.json` (root).
4. **Scripts (`package.json`)**:
   - `dev`: Next.js dev server (`:3000`)
   - `wrapper:dev`: `node services/opencode-wrapper/server.js` (`:3001`)
   - `opencode:serve`: `opencode serve --port 4096` (opsional jika memakai `OPENCODE_URL`)
   - `harness`: `tsx harness/process-via-wrapper.ts --reportId=` (untuk retry/debug manual)
5. **Environment (`.env.example`)**:
   `DATABASE_URL`, `ADMIN_KEY`, `WRAPPER_URL=http://localhost:3001`, `OPENCODE_URL=http://localhost:4096`, `OPENCODE_MODEL`, `OPENCODE_WAIT_TIMEOUT_MS=120000`, `AI_TASK_TIMEOUT_MS=900000` (timeout satu tugas end-to-end AI: fix + git + PR), `GITHUB_TOKEN`, `OPENCODE_WORKDIR`.
6. **Data & Dokumentasi**: Seed 2 laporan dummy + `README.md` (cara menjalankan, setup `opencode auth login` & `gh auth login`, serta contoh test `curl :3001/health` dan `curl :3001/chat`).

---

## 8. Kriteria Selesai (Acceptance Criteria)
- [ ] Wrapper berjalan: `GET :3001/health` mengembalikan `ok: true` dan `POST :3001/chat {"message":"jawab SATU kata: halo"}` membalas dengan benar.
- [ ] Saat form disubmit, laporan otomatis berubah ke `diproses-ai` tanpa klik admin, dan halaman `/lapor/[id]` menampilkan prompt, `sessionId`, serta live feed aktivitas AI.
- [ ] AI menyelesaikan fix + verifikasi mandiri + git + PR sendiri; status berubah ke `pr-dibuat` lengkap dengan `prUrl` aktif yang terverifikasi via `gh pr view`.
- [ ] Jika AI terhalang atau wrapper mati, proses berhenti tanpa membuat PR dan feed menampilkan penyebabnya.
- [ ] `npm run build` berjalan sukses tanpa error.
