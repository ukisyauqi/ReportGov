# Catatan Sumber dan AI — ReportGov

Dokumen ini disusun sebagai pemenuhan **Luaran Wajib: Catatan Sumber dan AI** untuk sistem **ReportGov** (Platform Pelaporan Website Pemerintah & Auto-Fix AI Harness).

---

## 1. Model AI yang Digunakan

ReportGov mengimplementasikan arsitektur *Agentic AI* berbasis OpenCode Serve runtime yang membagi tugas kecerdasan buatan ke dalam dua fungsi utama:

| Komponen AI | Model Default / Rekomendasi | Peran & Tanggung Jawab |
| :--- | :--- | :--- |
| **AI Bug Inspector (Hierarki 2 Validator)** | Claude 3.5 Sonnet / GPT-4o / Gemini 1.5 Pro *(via OpenCode provider)* | Menganalisis laporan masyarakat terhadap hasil live test (HTTP status code, console error, screenshot). Membedakan antara bug riil dengan laporan palsu, *false positive*, atau spam teks acak. |
| **AI Coder & Patch Engineer (Harness Auto-Fixer)** | Claude 3.5 Sonnet / Claude 3.7 Sonnet *(via OpenCode provider)* | Menjalankan sesi rekayasa perangkat lunak mandiri: membaca kode repositori target, melacak file sumber masalah, mengedit kode, menjalankan test/lint lokal yang tersedia, dan membuat branch serta commit perbaikan. |

> **Catatan Konfigurasi:** Model dikonfigurasi melalui variabel lingkungan `OPENCODE_MODEL` (mendukung format JSON `{"providerID":"...","id":"..."}` atau string `"providerID/modelID"`). Jika dikosongkan, OpenCode secara otomatis menggunakan model default yang terotentikasi pada `opencode auth login`.

---

## 2. Tools (Alat Bantu Pengembangan & Operasional)

Sistem dibangun dan dioperasikan menggunakan seperangkat alat berikut:

1. **OpenCode CLI & OpenCode Serve (`opencode`)**:
   - Engine eksekusi agen AI otonom berbasis *headless background service* (Port `4096`).
   - Bertanggung jawab atas isolasi lingkungan pengerjaan kode (*workspace session*) dan pembatasan izin (*security guardrails* via `opencode.json`).
2. **Playwright Headless Chromium (`playwright`)**:
   - Menjalankan simulasi browser otomatis untuk memverifikasi ketersediaan website target (`siteUrl`), mendeteksi error konsol browser, kegagalan request jaringan (HTTP 4xx/5xx), serta mengambil tangkapan layar bukti live (`artifacts/<id>-live.png`).
3. **GitHub CLI (`gh`)**:
   - Digunakan oleh orchestrator untuk verifikasi kredensial repositori dan verifikasi Pull Request (`gh pr view`) yang dihasilkan oleh agen AI.
4. **Git Version Control System (`git`)**:
   - Melakukan *sparse checkout* / kloning repositori target, isolasi branch perbaikan, dan pelacakan riwayat kode.
5. **Prisma CLI (`prisma`)**:
   - Manajemen skema ORM, sinkronisasi skema database SQLite/PostgreSQL (`prisma db push`), dan eksekusi skrip data awal (`prisma/seed.ts`).
6. **Node.js (v20+) & TSX Execution Engine**:
   - Lingkungan runtime backend untuk Next.js App Router dan eksekutor TypeScript langsung untuk background orchestrator harness (`tsx harness/process-via-wrapper.ts`).
7. **Antigravity IDE & Modern Dev Tools**:
   - Editor kode, debugging environment, dan AI-assisted development terminal.

---

## 3. API (Antarmuka Pemrograman Aplikasi)

Sistem mengintegrasikan API internal dan eksternal secara terstruktur:

### A. Internal API Routes (Next.js App Router — Port 3000)
- `POST /api/reports`:
  - **Fungsi:** Penerimaan laporan publik dari formulir wizard 4 langkah.
  - **Proteksi:** Validasi skema Zod dan *Rate Limiter* (maksimal 1 laporan sukses per IP per 24 jam).
  - **Orkestrasi:** Memicu proses verifikasi dan harness di latar belakang (*background execution*).
- `GET /api/reports/[id]`:
  - **Fungsi:** Endpoint publik untuk memantau status laporan (*baru*, *diproses-ai*, *pr-dibuat*, *selesai*, *ditolak*) serta live activity feed.
- `GET /api/reports`:
  - **Fungsi:** Endpoint monitoring admin (read-only) untuk melihat ringkasan seluruh laporan.
  - **Proteksi:** Memeriksa autentikasi sesi admin Google OAuth dan header `x-admin-key`.

### B. OpenCode Wrapper Microservice API (Express — Port 3001)
- `GET /health`: Health check konektivitas ke daemon OpenCode Serve.
- `POST /sessions`: Membuat sesi kerja baru pada direktori repositori target dengan parameter konfigurasi model dan agen.
- `POST /chat`: Mengirimkan prompt perbaikan terstruktur ke OpenCode dan menunggu hingga proses penyelesaian tugas mencapai kondisi *idle*.
- `GET /sessions/:id/activity`: Mengambil riwayat pemanggilan tool (*file edit*, perintah shell, catatan analisa AI) untuk ditampilkan di timeline pelacak laporan.
- `GET /events`: Passthrough *Server-Sent Events (SSE)* untuk streaming aktivitas agen secara langsung.

### C. External Third-Party APIs
- **Google OAuth 2.0 API**: Digunakan oleh `next-auth` (Auth.js v5) untuk autentikasi admin via Google Workspace/Gmail yang terdaftar pada `ADMIN_ALLOWED_EMAILS`.
- **GitHub REST & GraphQL API**: Digunakan melalui GitHub CLI (`gh`) untuk pembuatan PR dan pengecekan metadata repositori.

---

## 4. Dataset & Data Pendukung

Sistem memanfaatkan dataset dan basis data konfigurasi terstruktur berikut:

1. **Pemetaan Repositori Pemerintah (`config/site-to-repo.json`)**:
   - Dataset pemetaan format JSON yang menghubungkan URL publik layanan pemerintah (`siteUrl`) dengan URL git repositori resmi (*source repository*).
   - Menjamin bahwa sistem tidak sembarangan menyentuh website yang tidak memiliki repositori resmi terdaftar.
2. **Allowlist Repositori (`config/allowed-repos.txt`)**:
   - Daftar URL repositori GitHub yang telah mendapatkan otorisasi resmi untuk menerima *automated Pull Request* dari sistem ReportGov (Basis validasi **Hierarki 1**).
3. **Database Relasional Laporan (`prisma/schema.prisma` & `dev.db`)**:
   - Basis data SQLite lokal untuk menyimpan entitas `Report`: ID, URL situs, kategori/judul, deskripsi masalah, screenshot pelapor, status penanganan, prompt teknis AI, harness log feed, PR URL, dan session ID.
4. **Seed Kasus Laporan Uji Coba (`prisma/seed.ts`)**:
   - Kumpulan data uji awal berupa 2 skenario laporan nyata (isu broken link dan form submit crash) untuk pengujian fungsional penilai/evaluator.
5. **Live Evidence Dataset (`artifacts/` & `/tmp/harness-<id>/EVIDENCE.md`)**:
   - Kumpulan data bukti runtime yang dihasilkan oleh Playwright: kode status HTTP, waktu respon, error log konsol, dan tangkapan visual situs.

---

## 5. Library & Dependensi Utama

Seluruh dependensi dideklarasikan pada [package.json](file:///d:/test/new/ReportGov/package.json) dengan rincian:

### Dependensi Aplikasi (Production)
- **Framework & UI:**
  - `next` (`14.2.18`): Core web application framework (React Server Components, App Router).
  - `react` (`18.3.1`) & `react-dom` (`18.3.1`): Library antarmuka reaktif.
  - `zod` (`3.23.8`): Validasi skema data runtime untuk formulir dan payload API.
- **AI & Automation Client:**
  - `@opencode/client` (`^2.0.32`): SDK resmi OpenCode untuk berinteraksi dengan OpenCode Serve daemon.
  - `playwright` (`^1.49.0`): Headless browser automation untuk live evidence capture.
- **Database & Backend Services:**
  - `@prisma/client` (`^5.22.0`): Type-safe ORM client untuk SQLite / PostgreSQL.
  - `express` (`^4.19.2`): Minimalist web server untuk OpenCode Wrapper service.
  - `cors` (`^2.8.5`): Middleware Cross-Origin Resource Sharing.
  - `dotenv` (`^16.4.5`): Pemuat variabel lingkungan konfigurasi `.env`.
  - `next-auth` (`^5.0.0-beta.32`): Library autentikasi Auth.js untuk proteksi dashboard admin.

### Dependensi Pengembangan (DevDependencies)
- `typescript` (`^5.6.3`): Static typing system.
- `prisma` (`^5.22.0`): Prisma CLI and schema engine.
- `tailwindcss` (`^3.4.15`), `postcss` (`^8.4.49`), `autoprefixer` (`^10.4.20`): Utilitas styling CSS modern.
- `tsx` (`^4.19.2`): Eksekutor TypeScript CLI cepat.
- `eslint` (`^8.57.1`) & `eslint-config-next` (`14.2.18`): Linter penjamin kualitas kode.

---

## 6. Lisensi

- **Lisensi Repositori ReportGov**:
  - Proyek ini dirilis di bawah lisensi **MIT License** (permissive open source license), mengizinkan penggunaan, modifikasi, dan distribusi secara bebas untuk kepentingan publik dan pengembangan tata kelola pemerintahan berbasis digital.
- **Lisensi Pihak Ketiga (Third-Party Licenses)**:
  - Seluruh pustaka eksternal yang dipakai (Next.js, React, Tailwind CSS, Prisma, Playwright, Express, Zod) berada di bawah lisensi terbuka berlisensi permisif (**MIT**, **Apache-2.0**, atau **BSD-3-Clause**), bebas dari konflik hak cipta *copyleft* tertutup (GPL non-permissive).

---

## 7. Komponen Terdahulu (Prior Work / Pre-existing Assets)

Pengembangan ReportGov memanfaatkan beberapa komponen dan pola arsitektur terdahulu sebagai fondasi:

1. **Next.js App Router Boilerplate**:
   - Struktur proyek dasar yang dibangun di atas template resmi Next.js dengan arsitektur folder `src/app`.
2. **Desain Sistem & Komponen UI (Vanilla Tailwind CSS)**:
   - Komponen formulir multi-langkah (*wizard*), kartu status, *alert box*, dan tabel data admin dibuat secara mandiri (*custom-built*) menggunakan utilitas Tailwind CSS tanpa menggunakan template UI komersial berbayar.
3. **Pola Microservice OpenCode Wrapper**:
   - Memanfaatkan modul wrapper Express mandiri (`services/opencode-wrapper/`) untuk menjembatani komunikasi asinkron antara Next.js dan OpenCode CLI Serve via SDK `@opencode/client`.
4. **Repositori Target Demo Terpisah**:
   - Menggunakan repositori uji coba terbuka `ukisyauqi/todo-list-buggy` sebagai lingkungan sandbox untuk mendemonstrasikan kemampuan kloning, deteksi bug, perbaikan kode, hingga penerbitan Pull Request otomatis secara aman tanpa menyentuh repositori produksi pemerintah yang sebenarnya.

---

## 8. Penggunaan AI dalam Pengembangan

Pemanfaatan kecerdasan buatan dalam pengembangan proyek ReportGov terbagi menjadi dua ranah utama:

### A. AI sebagai Asisten Pengembang (AI-Assisted Pair Programming)
Selama siklus pengembangan aplikasi, AI coding assistant digunakan secara kolaboratif untuk:
1. **Perancangan Arsitektur Sistem**: Membantu merancang arsitektur 3-tier (*Next.js Frontend/API* $\rightarrow$ *Express OpenCode Wrapper* $\rightarrow$ *OpenCode Serve Runtime*).
2. **Penyusunan Logika Validasi 2 Hierarki**: Merumuskan logika pengamanan ketat:
   - *Hierarki 1*: Pengecekan allowlist repositori agar sistem tidak mengeksekusi sembarang URL.
   - *Hierarki 2*: Pemeriksaan mendalam kombinasi live fetch, Playwright screenshot, dan AI reasoning untuk mengeliminasi laporan spam / halusinasi.
3. **Pembangunan UI Wizard Ramah Pengguna**: Mengembangkan komponen interaktif `src/components/lapor-ui.tsx` yang secara cerdas mengubah kategori pilihan menjadi judul laporan standar, serta memberikan visualisasi rincian field error yang dapat langsung diperbaiki.
4. **Proteksi & Kebutuhan Non-Fungsional**: Mengembangkan mekanisme *In-Memory IP Rate Limiting* (1 laporan berhasil per IP per 24 jam) untuk mengamankan backend dari lonjakan trafik dan spam bot.
5. **Refactoring & Debugging**: Mengidentifikasi inkonsistensi skema database Prisma dan mengoreksi penanganan tipe TypeScript.

### B. AI sebagai Agen Otonom Runtime (Autonomous Agentic System)
Di dalam sistem ReportGov yang berjalan (*production runtime*), AI bertindak sebagai **agen otonom tanpa intervensi manusia**:
1. Menginspeksi laporan masyarakat beserta bukti visual Playwright.
2. Membaca arsitektur kode dari repositori target secara mandiri.
3. Menemukan baris kode penyebab kegagalan (*root cause analysis*).
4. Menuliskan *patch* perbaikan kode yang bersih dan terisolasi pada branch git baru.
5. Menjalankan verifikasi mandiri (*self-test*) untuk memastikan tidak terjadi regresi.
6. Menerbitkan Pull Request formal ke GitHub lengkap dengan deskripsi teknis perbaikan yang komprehensif.
