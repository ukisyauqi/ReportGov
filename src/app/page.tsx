'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  KATEGORI_LABELS,
  KATEGORI_LIST,
  isGoIdUrl,
} from '@/lib/validation';
import { StatusBadge } from '@/components/StatusBadge';

interface PublicReportSummary {
  id: string;
  siteUrl: string;
  kategori: string;
  judul: string;
  status: string;
  prUrl: string | null;
  sessionId: string | null;
  createdAt: string;
}

const SAMPLE_SITES = [
  'https://layanan.kominfo.go.id',
  'https://dukcapil.kemendagri.go.id',
  'https://sscasn.bkn.go.id',
];

export default function HomePage() {
  const router = useRouter();

  const [siteUrl, setSiteUrl] = useState('https://layanan.kominfo.go.id');
  const [kategori, setKategori] =
    useState<(typeof KATEGORI_LIST)[number]>('bug-tampilan');
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [namaPelapor, setNamaPelapor] = useState('');
  const [kontak, setKontak] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<PublicReportSummary[]>([]);

  const showNonGoIdWarning =
    siteUrl.trim().length > 8 && !isGoIdUrl(siteUrl.trim());

  useEffect(() => {
    fetch('/api/reports?public=1')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.reports)) setRecentReports(d.reports);
      })
      .catch(() => {});
  }, []);

  function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setScreenshot(null);
      setScreenshotName('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrorMsg('File screenshot harus berupa gambar (PNG/JPG/WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran gambar maksimal 5MB.');
      return;
    }

    setErrorMsg(null);
    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setScreenshot(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setFieldErrors({});

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          kategori,
          judul,
          deskripsi,
          screenshot,
          namaPelapor: namaPelapor || undefined,
          kontak: kontak || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal mengirim laporan');
        if (data.issues) setFieldErrors(data.issues);
        setSubmitting(false);
        return;
      }

      setCreatedReportId(data.id);
      router.push(`/lapor/${data.id}`);
    } catch (err) {
      setErrorMsg(
        `Gagal menghubungi server: ${String((err as Error)?.message || err)}`
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Kolom Form Laporan */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 mb-3">
              Otomatis Diproses oleh AI Harness (OpenCode Serve)
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Laporkan Masalah Website Pemerintah
            </h1>
            <p className="text-sm text-slate-600 mt-1.5">
              Laporan yang dikirim akan langsung dicek secara live, diubah
              menjadi prompt teknis, dan dikirim ke OpenCode Server untuk
              memperbaiki bug serta membuat Pull Request secara otomatis.
            </p>
          </div>

          {createdReportId && (
            <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900">
              <p className="font-semibold">
                Laporan berhasil dikirim! Mengalihkan ke halaman pantauan...
              </p>
              <Link
                href={`/lapor/${createdReportId}`}
                className="inline-block mt-2 font-semibold underline text-emerald-700"
              >
                Buka Status Laporan #{createdReportId} &rarr;
              </Link>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
              <p className="font-semibold">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Site URL */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                URL Website Pemerintah <span className="text-red-600">*</span>
              </label>
              <input
                type="url"
                required
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://layanan.kominfo.go.id"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-xs text-slate-500">Contoh terdaftar:</span>
                {SAMPLE_SITES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSiteUrl(s)}
                    className={`text-xs px-2 py-0.5 rounded border transition ${
                      siteUrl === s
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {s.replace('https://', '')}
                  </button>
                ))}
              </div>

              {showNonGoIdWarning && (
                <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <strong>Peringatan:</strong> URL ini bukan domain{' '}
                  <code>*.go.id</code>. Sistem memprioritaskan website resmi
                  pemerintah yang terdaftar di allowlist.
                </div>
              )}
              {fieldErrors.siteUrl && (
                <p className="text-xs text-rose-600 mt-1">
                  {fieldErrors.siteUrl[0]}
                </p>
              )}
            </div>

            {/* Kategori */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Kategori Masalah <span className="text-red-600">*</span>
              </label>
              <select
                value={kategori}
                onChange={(e) =>
                  setKategori(e.target.value as (typeof KATEGORI_LIST)[number])
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {KATEGORI_LIST.map((kat) => (
                  <option key={kat} value={kat}>
                    {KATEGORI_LABELS[kat]} ({kat})
                  </option>
                ))}
              </select>
              {fieldErrors.kategori && (
                <p className="text-xs text-rose-600 mt-1">
                  {fieldErrors.kategori[0]}
                </p>
              )}
            </div>

            {/* Judul */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Judul Masalah <span className="text-red-600">*</span>{' '}
                <span className="text-xs font-normal text-slate-500">
                  (minimal 10 karakter)
                </span>
              </label>
              <input
                type="text"
                required
                minLength={10}
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Tombol Kirim Permohonan tidak bisa diklik pada layar HP"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
              {fieldErrors.judul && (
                <p className="text-xs text-rose-600 mt-1">
                  {fieldErrors.judul[0]}
                </p>
              )}
            </div>

            {/* Deskripsi */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Deskripsi Lengkap (Reproduksi + Ekspektasi vs Aktual){' '}
                <span className="text-red-600">*</span>{' '}
                <span className="text-xs font-normal text-slate-500">
                  (minimal 20 karakter)
                </span>
              </label>
              <textarea
                rows={5}
                required
                minLength={20}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder={`1. Langkah reproduksi: Buka halaman utama lalu klik menu Layanan Publik.\n2. Ekspektasi: Form pendaftaran tampil rapi.\n3. Aktual: Tombol submit tertutup banner footer pada resolusi mobile.`}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
              {fieldErrors.deskripsi && (
                <p className="text-xs text-rose-600 mt-1">
                  {fieldErrors.deskripsi[0]}
                </p>
              )}
            </div>

            {/* Screenshot */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Screenshot Bukti{' '}
                <span className="text-xs font-normal text-slate-500">
                  (Opsional, gambar maks 5MB)
                </span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleScreenshotChange}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
              />
              {screenshotName && (
                <p className="text-xs text-emerald-700 mt-1">
                  File terpilih: {screenshotName}
                </p>
              )}
              {fieldErrors.screenshot && (
                <p className="text-xs text-rose-600 mt-1">
                  {fieldErrors.screenshot[0]}
                </p>
              )}
            </div>

            {/* Nama & Kontak Pelapor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Nama Pelapor{' '}
                  <span className="text-xs font-normal text-slate-500">
                    (Opsional)
                  </span>
                </label>
                <input
                  type="text"
                  value={namaPelapor}
                  onChange={(e) => setNamaPelapor(e.target.value)}
                  placeholder="Anonim / Nama Anda"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Kontak Email / WA{' '}
                  <span className="text-xs font-normal text-slate-500">
                    (Opsional)
                  </span>
                </label>
                <input
                  type="text"
                  value={kontak}
                  onChange={(e) => setKontak(e.target.value)}
                  placeholder="warga@email.id"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold py-3 px-5 text-sm shadow-sm transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mengirim & Memicu AI Harness...
                </>
              ) : (
                'Kirim Laporan & Jalankan Auto-Fix AI'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Kolom Info Alur & Laporan Terbaru */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold mb-3">
            Alur Otomatis (End-to-End Tanpa Klik Admin)
          </h2>
          <ol className="space-y-3 text-xs text-slate-300">
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-red-600 text-white font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <strong className="text-white block">
                  Cek Live & Susun Prompt
                </strong>
                Sistem mengecek HTTP + screenshot Playwright ke URL terkait lalu
                menyusun prompt teknis dari template.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-red-600 text-white font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <strong className="text-white block">
                  Clone Repo & Pasang Guardrails
                </strong>
                Repo yang ada di allowlist di-clone ke{' '}
                <code>/tmp/harness-&lt;id&gt;/repo</code> dengan proteksi{' '}
                <code>opencode.json</code> (deny <code>.env*</code> &{' '}
                <code>git push</code>).
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-red-600 text-white font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <div>
                <strong className="text-white block">
                  Bugfix via OpenCode Wrapper (:3001/chat)
                </strong>
                Wrapper memanggil <code>opencode serve</code> via{' '}
                <code>@opencode/client</code> dan melakukan verifikasi{' '}
                <code>lint/test/build</code> (maks 3x iterasi).
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-red-600 text-white font-bold flex items-center justify-center shrink-0">
                4
              </span>
              <div>
                <strong className="text-white block">
                  Auto Push & Buat Pull Request
                </strong>
                Jika verifikasi lolos, orchestrator mem-push branch{' '}
                <code>fix/*</code> dan membuat PR otomatis via{' '}
                <code>gh pr create</code>.
              </div>
            </li>
          </ol>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">
              Laporan Terbaru
            </h2>
            <Link
              href="/admin"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
            >
              Semua di /admin &rarr;
            </Link>
          </div>

          {recentReports.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Belum ada laporan yang tercatat.
            </p>
          ) : (
            <div className="space-y-3">
              {recentReports.map((rep) => (
                <Link
                  key={rep.id}
                  href={`/lapor/${rep.id}`}
                  className="block rounded-xl border border-slate-200 p-3.5 hover:border-slate-400 transition bg-slate-50/50"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-[11px] text-slate-500">
                      #{rep.id.slice(0, 10)}
                    </span>
                    <StatusBadge status={rep.status} />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                    {rep.judul}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500">
                    <span className="truncate max-w-[200px]">{rep.siteUrl}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 text-[11px]">
                      {rep.kategori}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
