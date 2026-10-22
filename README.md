# ReportGov — Web Pelaporan Website Pemerintah + Auto-Fix AI Harness (OpenCode Serve)

Sistem end-to-end tempat masyarakat melaporkan masalah pada website pemerintah (`*.go.id`), dengan **2 Hierarki Validasi Sebelum Perbaikan**:
1. **Hierarki 1 (Data Repositori)**: Sistem memvalidasi apakah URL situs terdaftar di pemetaan repositori kami (`config/site-to-repo.json` & `config/allowed-repos.txt`). Jika **tidak ada**, laporan langsung **ditolak**. Jika ada, lanjut ke Hierarki 2.
2. **Hierarki 2 (Simulasi & Pemeriksaan AI)**: Sistem menjalankan simulasi browser headless (Playwright) & HTTP live check, lalu Agen AI Inspector menganalisis kebenaran error. Jika hasil pemeriksaan membuktikan error **tidak terbukti / false positive / teks acak**, laporan **ditolak**. Jika error **benar adanya**, sistem melanjutkan ke perbaikan kode pada basis repositori dan pembuatan Pull Request otomatis.

---

## Prasyarat

1. **Node.js 20+** & **npm**
2. **OpenCode CLI** terinstall di `PATH` dan sudah login:
   ```sh
   opencode auth login
   ```
3. **GitHub CLI (`gh`)** sudah login (untuk pembuatan PR otomatis):
   ```sh
   gh auth login
   ```

---

## Instalasi & Setup Database

```sh
npm install
cp .env.example .env
npm run db:push
npm run db:seed
```

### Setup Login Admin (Google OAuth)

1. Buat OAuth Client di [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (tipe Web):
   - Authorized redirect URI (dev): `http://localhost:3000/api/auth/callback/google`
2. Isi `.env`:
   ```sh
   AUTH_SECRET="$(openssl rand -base64 32)"
   AUTH_GOOGLE_ID="<client-id>"
   AUTH_GOOGLE_SECRET="<client-secret>"
   ADMIN_ALLOWED_EMAILS="admin1@gmail.com,admin2@go.id"
   ```
   Hanya email di allowlist yang bisa login ke `/admin`.

---

## Menjalankan Sistem

Jalankan 2 proses utama (atau 3 proses jika menggunakan `opencode serve` eksplisit):

```sh
# Terminal 1 (Opsional — jika tidak diset, wrapper otomatis menjalankan `Service.ensure()`)
npm run opencode:serve

# Terminal 2 — OpenCode Wrapper (:3001)
npm run wrapper:dev

# Terminal 3 — Next.js Web & API (:3000)
npm run dev
```

- **Form Publik**: [http://localhost:3000](http://localhost:3000)
- **Tracking Laporan**: `http://localhost:3000/lapor/<id>`
- **Monitoring Admin (Read-Only)**: [http://localhost:3000/admin](http://localhost:3000/admin) (login with Google — email harus terdaftar di `ADMIN_ALLOWED_EMAILS`)

---

## Test Cepat OpenCode Wrapper (`:3001`)

```sh
# 1. Cek koneksi wrapper ke OpenCode server
curl http://localhost:3001/health

# 2. Test kirim prompt singkat ke OpenCode via wrapper
curl -X POST http://localhost:3001/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"jawab dengan SATU kata saja: halo"}'

# 3. Lihat activity feed sebuah session (yang tampil di halaman tracking)
curl http://localhost:3001/sessions/<sessionId>/activity?limit=100
```

---

## Menambahkan Mapping Website & Repo Allowlist

1. Tambahkan pasangan URL website pemerintah dan repo GitHub di `config/site-to-repo.json`:
   ```json
   {
     "https://layanan.kominfo.go.id": "https://github.com/pemerintah-id/portal-layanan-kominfo.git"
   }
   ```
2. Daftarkan URL repo tersebut ke dalam `config/allowed-repos.txt`.

---

## Debug / Retry Harness Manual (CLI)

Meskipun seluruh laporan diproses otomatis saat submit (`POST /api/reports`), Anda dapat menjalankan ulang harness untuk ID laporan tertentu melalui CLI:

```sh
npm run harness -- --reportId=seed-dukcapil-broken-link
```

---

## Luaran Wajib & Dokumentasi Terkait

- **Catatan Sumber dan AI**: Lihat dokumen lengkap di [CATATAN_SUMBER_DAN_AI.md](file:///d:/test/new/ReportGov/CATATAN_SUMBER_DAN_AI.md) (mencakup Model, Tools, API, Dataset, Library, Lisensi, Komponen Terdahulu, dan Penggunaan AI dalam Pengembangan).
- **Bukti Pengujian**: Lihat dokumen lengkap di [BUKTI_PENGUJIAN.md](file:///d:/test/new/ReportGov/BUKTI_PENGUJIAN.md) (mencakup Skenario, Masukan, Hasil Aktual, Kendala Teknis, dan Langkah Pengawasan Manusia).


