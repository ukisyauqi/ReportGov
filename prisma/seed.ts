import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.report.deleteMany({});

  const report1 = await prisma.report.create({
    data: {
      id: 'seed-kominfo-mobile-nav',
      siteUrl: 'https://layanan.kominfo.go.id',
      kategori: 'tidak-bisa-diakses-hp',
      judul: 'Tombol Kirim Permohonan tertutup banner footer pada tampilan HP',
      deskripsi:
        '1. Reproduksi: Buka https://layanan.kominfo.go.id/permohonan di layar mobile (375x667).\n2. Ekspektasi: Tombol Kirim Permohonan dapat diklik dengan jelas.\n3. Aktual: Banner sticky footer menutupi area tombol submit sehingga form tidak bisa dikirim.',
      namaPelapor: 'Budi Santoso',
      kontak: 'budi.santoso@warga.id',
      status: 'pr-dibuat',
      repoUrl: 'https://github.com/pemerintah-id/portal-layanan-kominfo.git',
      sessionId: 'ses_demo_kominfo_001',
      prUrl: 'https://github.com/pemerintah-id/portal-layanan-kominfo/pull/42',
      prompt: `# Tugas Bugfix Otomatis — Website Pemerintah

## Informasi Laporan
- **Judul Laporan**: Tombol Kirim Permohonan tertutup banner footer pada tampilan HP
- **Kategori Masalah**: tidak-bisa-diakses-hp
- **URL Website**: https://layanan.kominfo.go.id

## Deskripsi Masalah (Reproduksi & Ekspektasi vs Aktual)
1. Reproduksi: Buka https://layanan.kominfo.go.id/permohonan di layar mobile (375x667).
2. Ekspektasi: Tombol Kirim Permohonan dapat diklik dengan jelas.
3. Aktual: Banner sticky footer menutupi area tombol submit sehingga form tidak bisa dikirim.

## Bukti Cek Live (EVIDENCE.md)
- **Target URL**: https://layanan.kominfo.go.id
- **HTTP Status**: 200 OK
- **Screenshot Live**: \`artifacts/seed-kominfo-mobile-nav-live.png\``,
      harnessLog: `[2026-10-21T08:00:01.000Z] Memulai pemrosesan otomatis laporan #seed-kominfo-mobile-nav (https://layanan.kominfo.go.id) - status=diproses-ai
[2026-10-21T08:00:02.000Z] Repo tervalidasi: https://github.com/pemerintah-id/portal-layanan-kominfo.git
[2026-10-21T08:00:04.000Z] Prompt berhasil disusun dan disimpan ke Report.prompt.
[2026-10-21T08:00:06.000Z] [Iterasi 1/3] POST http://localhost:3001/chat directory=/tmp/harness-seed-kominfo-mobile-nav/repo (session baru)
[2026-10-21T08:00:18.000Z] [Iterasi 1/3] Balasan OpenCode (sessionID=ses_demo_kominfo_001): Menambahkan padding-bottom pb-24 pada container form mobile di src/components/PermohonanForm.tsx agar tombol submit tidak tertutup sticky footer.
[2026-10-21T08:00:25.000Z] [Iterasi 1/3] Verifikasi LOLOS:
$ npm run lint -> OK
$ npm run test --if-present -> OK
$ npm run build -> OK
[2026-10-21T08:00:29.000Z] Pull Request berhasil dibuat: https://github.com/pemerintah-id/portal-layanan-kominfo/pull/42 (status=pr-dibuat).`,
    },
  });

  const report2 = await prisma.report.create({
    data: {
      id: 'seed-dukcapil-broken-link',
      siteUrl: 'https://dukcapil.kemendagri.go.id',
      kategori: 'link-rusak',
      judul: 'Link Unduh Formulir F-1.01 mengarah ke halaman 404 Not Found',
      deskripsi:
        '1. Reproduksi: Buka halaman Unduhan Dokumen lalu klik tombol "Formulir F-1.01".\n2. Ekspektasi: File PDF terunduh.\n3. Aktual: Mengarah ke URL /files/f101-lama.pdf yang mengembalikan 404.',
      namaPelapor: 'Siti Aminah',
      kontak: 'siti@warga.id',
      status: 'diproses-ai',
      repoUrl: 'https://github.com/pemerintah-id/web-dukcapil-kemendagri.git',
      sessionId: 'ses_demo_dukcapil_002',
      prompt: `# Tugas Bugfix Otomatis — Website Pemerintah

## Informasi Laporan
- **Judul Laporan**: Link Unduh Formulir F-1.01 mengarah ke halaman 404 Not Found
- **Kategori Masalah**: link-rusak
- **URL Website**: https://dukcapil.kemendagri.go.id`,
      harnessLog: `[2026-10-21T08:10:00.000Z] Memulai pemrosesan otomatis laporan #seed-dukcapil-broken-link (https://dukcapil.kemendagri.go.id) - status=diproses-ai
[2026-10-21T08:10:01.000Z] Repo tervalidasi: https://github.com/pemerintah-id/web-dukcapil-kemendagri.git
[2026-10-21T08:10:03.000Z] [Iterasi 1/3] POST http://localhost:3001/chat directory=/tmp/harness-seed-dukcapil-broken-link/repo sessionID=ses_demo_dukcapil_002`,
    },
  });

  console.log('Seed selesai:', { report1: report1.id, report2: report2.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
