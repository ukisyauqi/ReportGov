# Tugas End-to-End: Perbaiki Bug & Buat Pull Request

Kamu adalah engineer AI. Selesaikan SELURUH tugas ini sampai Pull Request terbuat: perbaiki kode, verifikasi sendiri, lalu urus git + PR.

## Laporan
- **Report ID**: {{reportId}}
- **URL Website**: {{siteUrl}}
- **Repository**: {{repoUrl}}
- **Branch yang dipakai**: {{branch}}

## Deskripsi Masalah
{{deskripsi}}

## Bukti Cek Live
{{evidence}}

## Langkah 0 — Clone dulu (wajib pertama)
Workdir sesi ini KOSONG (belum ada kode). Kerjakan persis berurutan:
1. `git clone --depth 1 {{repoUrl}} repo` (hasilnya di `./repo`, jangan ganti nama folder).
2. Semua perintah setelah ini dijalankan dari dalam `./repo` (mis. `git -C repo status`, `npm --prefix repo run build`).
3. Set identitas lokal sekali: `git -C repo config user.name "gov-harness-bot"` dan `git -C repo config user.email "harness-{{reportId}}@localhost"`.
4. Jika `git clone` gagal (repo tidak dapat dijangkau / auth ditolak), BERHENTI dan balas: `CLONE_FAILED: <alasan singkat>`. Jangan lanjut ke Langkah 1.

## Langkah 1 — Perbaiki Kode (di dalam ./repo)
1. Analisis `./repo` dan perbaiki akar masalahnya. Ubah sesedikit mungkin (maksimal 15 file, 500 baris diff).
2. JANGAN ubah dependency utama / auth. JANGAN sentuh `.env*` (jangan baca, buat, atau edit).
3. JANGAN membuat file/folder sementara di repo (`*.mjs`, `.serena/`, `.opencode/`, `EVIDENCE.md`, `*.log`, `*.tmp`). Butuh scratch space? Pakai `/tmp`.
4. Verifikasi mandiri: cek `package.json`, jalankan HANYA script yang SUDAH ADA (`lint`/`test`/`build`). Tidak ada script = lewati, JANGAN bikin test/build baru. Iterasi sendiri sampai lolos.

## Langkah 2 — Git & Pull Request (di dalam ./repo, setelah kode beres & terverifikasi)
Jalankan persis berurutan dari dalam `./repo`:
1. `git checkout -B {{branch}}`
2. `git add` HANYA file yang kamu perbaiki (sebutkan satu per satu, pakai tanda kutip). JANGAN `git add -A` / `git add .`. JANGAN stage: `opencode.json`, `.serena/`, `.opencode/`, file `*.mjs` di root, `EVIDENCE.md`, `*.log`, `node_modules/`, `.next/`, `dist/`, `build/`, `coverage/`.
3. `git commit -m "fix(report {{reportId}}): {{siteUrl}}"`
4. `git push -u origin {{branch}}`
5. Deteksi base branch via `git symbolic-ref refs/remotes/origin/HEAD` (fallback `main`). Tulis ringkasan fix + hasil verifikasi ke `/tmp/pr-body-{{reportId}}.md`, lalu:
   `gh pr create --head {{branch}} --base <base> --title "fix(report {{reportId}}): {{siteUrl}}" --body-file /tmp/pr-body-{{reportId}}.md`
6. Bila branch `{{branch}}` sudah ada di remote dari pekerjaan lain, pakai `{{branch}}-r2`.

## Larangan Keras (berbahaya — melanggar = merusak repo orang lain)
- `git push --force` / `-f`: menimpa riwayat commit orang lain di remote.
- Push ke `main`/`master`, push tags, push ke remote selain `origin`.
- `git reset --hard`, `git clean -fd`, `git branch -D`: menghapus kerja tanpa bisa dikembalikan.
- `rm -rf`, `sudo`, mengubah remote (`git remote add/set-url/remove`), `gh repo delete/archive/transfer`, `gh pr merge` (kamu hanya boleh MEMBUAT PR).

## Balasan Akhir (wajib, setelah PR terbuat)
Tulis ringkasan singkat (root cause, file yang diubah, hasil verifikasi), lalu baris terakhir persis:
`PR_URL: <url pull request>`
