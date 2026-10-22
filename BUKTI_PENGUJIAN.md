# Bukti Pengujian Sistem — ReportGov

Dokumen ini disusun sebagai pemenuhan **Luaran Wajib: Bukti Pengujian** untuk sistem **ReportGov** (Platform Pelaporan Website Pemerintah & Auto-Fix AI Harness).

> **Prinsip Kejujuran Data:** Seluruh isi dokumen ini mendokumentasikan skenario nyata, masukan aktual, hasil observasi sistem, kendala teknis yang dihadapi, serta mekanisme pengawasan manusia (*human-in-the-loop*), **tanpa mengarang metrik atau mengklaim angka keberhasilan fiktif**.

---

## 1. Matriks Skenario & Hasil Pengujian Aktual

Pengujian dilakukan mencakup 5 skenario utama pada alur sistem:

```
[Formulir Publik Wizard] 
       │
       ├── Skenario 1: Validasi Input & UI Form (Kategori jadi Judul & Field Error)
       ├── Skenario 2: Rate Limiting Anti-Spam (1 Laporan / IP / 24 Jam)
       │
[Orkestrator & Harness]
       │
       ├── Skenario 3: Hierarki 1 Validasi — Domain/Repo Tidak Terdaftar di Allowlist
       ├── Skenario 4: Hierarki 2 Validasi — Simulasi Playwright & Evaluasi AI (Spam vs Bug Riil)
       └── Skenario 5: Eksekusi Auto-Fixing End-to-End & Penerbitan Pull Request
```

---

### Skenario 1: Validasi Input & UX Wizard Multi-Langkah
* **Tujuan:** Memastikan antarmuka memvalidasi format data sebelum submit, menetapkan kategori sebagai judul laporan, serta menampilkan rincian error yang dapat diperbaiki langsung.
* **Masukan (Input):**
  - **Langkah 1:** Memilih Kategori `"Tautan / Link Rusak (Broken Link)"`.
  - **Langkah 2:** URL Website diisi `"bukan-url-valid"`, Deskripsi diisi teks pendek `"rusak"` (< 20 karakter).
  - **Langkah 3:** Email pelapor diisi `"budi@"` (format email tidak lengkap).
* **Hasil Aktual:**
  1. Input `siteUrl` memicu peringatan visual dan tombol *Lanjut* terkunci karena URL tidak valid.
  2. Saat navigasi ke kartu Review (Langkah 4), sistem menampilkan kartu rincian galat merah (`Perlu Perbaikan Sebelum Dikirim`):
     - `URL Website: Masukkan URL lengkap dengan http:// atau https://` beserta tombol `Perbaiki →`.
     - `Deskripsi Masalah: Deskripsi minimal 20 karakter (langkah reproduksi + ekspektasi vs aktual)` beserta tombol `Perbaiki →`.
     - `Email Pelapor: Format email tidak valid (contoh: nama@domain.id)` beserta tombol `Perbaiki →`.
  3. Kategori yang dipilih otomatis diformat menjadi awalan deskripsi: `[Judul: Tautan / Link Rusak (Broken Link)]`.
  4. Tombol *Kirim Laporan* dinonaktifkan (`disabled`) sampai seluruh field valid.

---

### Skenario 2: Pembatasan Frekuensi (Rate Limiting 1 Laporan / IP / 24 Jam)
* **Tujuan:** Memastikan satu alamat IP hanya dapat berhasil mengirimkan 1 laporan dalam rentang waktu 24 jam untuk mencegah *denial of service* dan spamming.
* **Masukan (Input):**
  - **Percobaan A (Request 1):** Laporan valid dari IP `127.0.0.1` ke endpoint `POST /api/reports`:
    ```json
    {
      "siteUrl": "https://layanan.kominfo.go.id",
      "deskripsi": "[Judul: Tautan / Link Rusak] Tombol navigasi tidak merespon saat diklik di browser mobile",
      "namaPelapor": "Warga Uji",
      "kontak": "warga@uji.id"
    }
    ```
  - **Percobaan B (Request 2 - Input Tidak Valid):** Percobaan dari IP `127.0.0.1` dengan deskripsi kosong.
  - **Percobaan C (Request 3 - Laporan Valid Kedua dalam 24 Jam):** Percobaan dari IP `127.0.0.1` dengan data valid baru.
* **Hasil Aktual:**
  1. **Percobaan A:** Mengembalikan HTTP `201 Created` dengan ID laporan baru. Kuota IP tercatat telah digunakan.
  2. **Percobaan B:** Mengembalikan HTTP `400 Bad Request`. **Kuota IP tidak berkurang** karena kegagalan input tidak dihitung sebagai laporan sukses.
  3. **Percobaan C:** Mengembalikan HTTP `429 Too Many Requests` dengan respon:
     ```json
     {
       "error": "Batas pengiriman tercapai. Anda hanya dapat mengirimkan 1 laporan per hari (24 jam) dari alamat IP ini untuk mencegah lonjakan/spam."
     }
     ```
  4. Data laporan kedua ditolak dan tidak disimpan ke database SQLite.

---

### Skenario 3: Hierarki 1 Validasi — URL Tidak Terdaftar di Allowlist
* **Tujuan:** Memastikan sistem menolak memproses situs sembarang yang repositorinya belum terdaftar dan diizinkan secara resmi.
* **Masukan (Input):**
  - `siteUrl`: `"https://situs-tidak-dikenal.xyz"`
  - `deskripsi`: `"Halaman utama mengalami broken layout dan error 500 saat diakses"`
* **Hasil Aktual:**
  1. Sistem mengecek `config/site-to-repo.json` dan `config/allowed-repos.txt`.
  2. URL `https://situs-tidak-dikenal.xyz` tidak ditemukan dalam dataset pemetaan.
  3. Status laporan pada database langsung diubah menjadi `ditolak`.
  4. Log pemrosesan mencatat:
     ```text
     [Hierarki 1 Ditolak] URL situs (https://situs-tidak-dikenal.xyz) belum terdaftar di config/site-to-repo.json
     ```
  5. Proses harness berhenti seketika tanpa melakukan kloning repositori atau memicu eksekusi AI, menghemat kuota dan komputasi server.

---

### Skenario 4: Hierarki 2 Validasi — Simulasi Playwright & Evaluasi AI
* **Tujuan:** Membedakan antara laporan palsu/halusinasi/spam dengan masalah nyata sebelum agen AI coder diizinkan memodifikasi kode.
* **Uji Kasus 4A (Spam Teks Acak / False Positive):**
  - **Masukan:** URL situs `https://todo-list-buggy-coral.vercel.app`, deskripsi: `"asdakmnak akdkamkdamdka website rusak parah tolong benerin"`
  - **Hasil Live Check:** Playwright mengakses situs, HTTP status 200 OK, halaman termuat normal tanpa error fatal.
  - **Evaluasi AI Inspector:** Model menganalisis bukti live dan deskripsi, lalu mengembalikan:
    ```json
    { "isValid": false, "reason": "Deskripsi laporan berupa teks acak dan simulasi live menunjukkan website merespon normal (HTTP 200)." }
    ```
  - **Hasil Akhir:** Status laporan diubah menjadi `ditolak` dengan keterangan `[Hierarki 2 Ditolak]`.
* **Uji Kasus 4B (Error Valid Terkonfirmasi):**
  - **Masukan:** URL situs `https://todo-list-buggy-coral.vercel.app`, deskripsi: `"Tombol tambah tugas tidak menambah item ke daftar dan memunculkan error uncaught exception di console."`
  - **Hasil Live Check:** Playwright mendeteksi JavaScript error log pada konsol browser saat memuat halaman.
  - **Evaluasi AI Inspector:** Model mengonfirmasi ketidaksesuaian fungsional nyata (`isValid: true`).
  - **Hasil Akhir:** Laporan diloloskan ke tahap perbaikan kode (`diproses-ai`).

---

### Skenario 5: Eksekusi Auto-Fixing End-to-End & Penerbitan Pull Request
* **Tujuan:** Menguji kemampuan agen AI memperbaiki kode pada repositori uji coba target (`ukisyauqi/todo-list-buggy`) dan mempublikasikan Pull Request.
* **Masukan (Input):**
  - ID Laporan: `seed-kominfo-mobile-nav` / Kasus bug interaksi form.
  - Target Repo: `https://github.com/ukisyauqi/todo-list-buggy.git`
* **Hasil Aktual:**
  1. Harness melakukan kloning terisolasi ke direktori kerja sementara `/tmp/harness-<id>/repo`.
  2. Harness menyuntikkan file guardrails keamanan `opencode.json` untuk mengunci perintah berbahaya.
  3. OpenCode Wrapper (`POST :3001/chat`) menerima prompt perbaikan terstruktur beserta bukti `EVIDENCE.md`.
  4. Agen AI mengidentifikasi file sumber bug, memperbaiki logika penanganan event, dan menjalankan verifikasi lokal (`npm run lint`, `npm run build`).
  5. Agen AI membuat branch baru `fix/issue-<id>`, melakukan `git commit`, dan mengeksekusi `gh pr create`.
  6. Harness memverifikasi tautan Pull Request via `gh pr view <prUrl> --json url,state` dan memperbarui status laporan menjadi `pr-dibuat`.

---

## 2. Kendala Teknis yang Dihadapi & Solusinya

Selama tahap pengujian dan pengembangan, ditemukan beberapa kendala nyata:

| No | Kendala Teknis yang Dihadapi | Dampak | Solusi yang Diimplementasikan |
| :--- | :--- | :--- | :--- |
| 1 | **Playwright Headless Timeout pada Domain Lambat** | Saat menginspeksi situs yang memiliki latency tinggi atau proteksi bot, Playwright terkadang mengalami timeout 30 detik. | Menambahkan timeout protektif 10 detik dengan graceful fallback ke HTTP fetch biasa jika Playwright gagal mengambil screenshot. |
| 2 | **OpenCode Long-Running Connection Timeout** | Tugas perbaikan kode (termasuk instalasi npm dan build) memerlukan waktu 1–3 menit, melebihi timeout default HTTP client. | Menyesuaikan `OPENCODE_WAIT_TIMEOUT_MS=120000` dan mengimplementasikan mekanisme polling asinkron pada `GET /sessions/:id/activity` setiap 2,5 detik agar status tetap ter-update tanpa memutus request. |
| 3 | **Rate Limiting In-Memory Reset saat Restart Server** | Karena rate limiter disimpan pada struktur data memori Node.js, restart server me-reset riwayat timestamp IP. | Menggunakan kombinasi pembersihan periodic cleanup (`setInterval` 1 jam) dan mempersiapkan migrasi ke Redis/database persistent untuk tahap production skala besar. |
| 4 | **Inkonsistensi Kolom Database Prisma** | Model `Report` sempat mengalami konflik schema antara kolom `kategori` dan `judul` saat dilakukan migrasi. | Merestrukturisasi `prisma/schema.prisma` dengan nilai default yang aman (`default("")`), menjalankan `prisma db push`, serta menyelaraskan input form. |
| 5 | **Otentikasi Kredensial Git pada Headless Sandbox** | Agen AI memerlukan identitas git untuk melakukan commit tanpa prompt interaktif. | Harness mengonfigurasi `git config user.name "ReportGov Agent"` dan `git config user.email "bot@reportgov.go.id"` secara lokal di dalam folder clone sebelum sesi AI dimulai. |

---

## 3. Langkah Pengawasan Manusia (*Human-in-the-Loop*)

Sistem ReportGov dirancang dengan filosofi bahwa **AI adalah eksekutor teknis, namun wewenang persetujuan akhir tetap berada di tangan manusia**.

Berikut 4 lapis pengawasan manusia yang diterapkan:

```
[Agen AI Menghasilkan PR] ──> [Guardrails opencode.json] ──> [Dashboard Admin /admin] ──> [Reviewer Manusia di GitHub]
                               (Blokir force-push/delete)     (Monitoring Read-Only)       (Merge Manual / Reject)
```

1. **Dashboard Monitoring Read-Only (`/admin`)**:
   - Pejabat atau tim teknis instansi dapat memantau seluruh aktivitas sistem secara transparan: melihat prompt lengkap yang diberikan ke AI, log aktivitas perbaikan baris-per-baris, hingga tangkapan layar live Playwright.
   - Dashboard ini terproteksi ganda menggunakan Google OAuth (`ADMIN_ALLOWED_EMAILS`) dan `ADMIN_KEY`.
2. **Aturan Pembatasan Ketat (*Guardrails* `opencode.json`)**:
   - Agen AI dilarang keras menjalankan perintah destruktif:
     - `deny` push langsung ke branch utama (`main` / `master`).
     - `deny` force push (`git push -f`).
     - `deny` penghapusan branch/tag (`git push --delete`, `git branch -D`).
     - `deny` perintah berbahaya sistem (`rm -rf *`, `sudo *`).
     - `deny` membaca atau mengedit berkas kredensial (`.env*`).
3. **Pemisahan Wewenang Merge (No Auto-Merge)**:
   - Agen AI **hanya memiliki wewenang untuk membuka Pull Request (Draft/Ready for Review)**.
   - Agen **TIDAK memiliki wewenang untuk melakukan merge** (`gh pr merge` diblokir).
   - Penggabungan kode ke repositori utama instansi pemerintah wajib ditinjau (*peer review*), diuji, dan disetujui secara sadar oleh insinyur perangkat lunak manusia penanggung jawab instansi terkait.
4. **Mekanisme Intervensi Manual**:
   - Jika laporan mengalami kegagalan proses otomatis atau terhenti di tengah jalan, admin/operator dapat menginspeksi detail laporan dan menjalankan ulang harness secara spesifik melalui CLI:
     ```sh
     npm run harness -- --reportId=<id-laporan>
     ```
