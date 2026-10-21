'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isGoIdUrl } from '@/lib/validation';
import { StatusBadge } from '@/components/StatusBadge';
import {
  BackLink,
  Eyebrow,
  NextButton,
  StepProgress,
  VisualPanel,
} from '@/components/lapor-ui';

interface PublicReportSummary {
  id: string;
  siteUrl: string;
  deskripsi: string;
  status: string;
  prUrl: string | null;
  sessionId: string | null;
  createdAt: string;
}

const TOTAL_STEPS = 4;
const DESC_MAX = 500;

const CATEGORIES = [
  {
    value: 'Website tidak bisa diakses',
    desc: 'Halaman tidak muncul, error, atau tidak bisa dibuka.',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M9 20h6M12 16v4M7.5 9.5l-2 2 2 2M16.5 9.5l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: 'Website lambat',
    desc: 'Membuka halaman terlalu lama.',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path d="M12 13l4-4" strokeLinecap="round" />
        <path d="M3.5 17a9 9 0 1 1 17 0" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    value: 'Konten tidak sesuai / tidak akurat',
    desc: 'Informasi, data, atau tautan tidak benar.',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path d="M6 2h9l5 5v15H6z" strokeLinejoin="round" />
        <path d="M14 2v6h6" strokeLinejoin="round" />
        <path d="M12 11v5M12 18.2v.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: 'Masalah lainnya',
    desc: 'Pilih ini jika masalah Anda tidak termasuk kategori di atas.',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path d="M6 2h12v20H6z" strokeLinejoin="round" />
        <path d="M9 6h6M9 10h6M9 14h4" strokeLinecap="round" />
      </svg>
    ),
  },
];

const SAMPLE_SITES = [
  'https://layanan.kominfo.go.id',
  'https://dukcapil.kemendagri.go.id',
  'https://sscasn.bkn.go.id',
];

function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function HomePage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [kategori, setKategori] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [namaPelapor, setNamaPelapor] = useState('');
  const [kontak, setKontak] = useState('');
  const [showExtra, setShowExtra] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [recentReports, setRecentReports] = useState<PublicReportSummary[]>([]);

  const showNonGoIdWarning =
    siteUrl.trim().length > 8 &&
    isValidUrl(siteUrl) &&
    !isGoIdUrl(siteUrl.trim());
  const siteUrlInvalid = siteUrl.trim().length > 0 && !isValidUrl(siteUrl);

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
      if (typeof reader.result === 'string') setScreenshot(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function canNext(): boolean {
    if (step === 1) return kategori !== '';
    if (step === 2) return isValidUrl(siteUrl);
    if (step === 3) return deskripsi.trim().length >= 20;
    return true;
  }

  function handleNext() {
    setErrorMsg(null);
    if (!canNext()) {
      if (step === 1) setErrorMsg('Pilih salah satu jenis masalah terlebih dahulu.');
      if (step === 2)
        setErrorMsg(
          siteUrl.trim()
            ? 'Alamat website belum valid. Pastikan menyertakan https://'
            : 'Isi alamat website yang bermasalah terlebih dahulu.'
        );
      if (step === 3)
        setErrorMsg('Ceritakan kendala Anda minimal 20 karakter agar mudah ditindaklanjuti.');
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setErrorMsg(null);
    setFieldErrors({});
    try {
      const finalDeskripsi = `[Kategori: ${kategori}]\n\n${deskripsi.trim()}`;
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: siteUrl.trim(),
          deskripsi: finalDeskripsi,
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
      router.push(`/lapor/${data.id}`);
    } catch (err) {
      setErrorMsg(`Gagal menghubungi server: ${String((err as Error)?.message || err)}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Wizard card */}
      <div className="bg-white rounded-3xl border border-line shadow-card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left: form side */}
          <div className="p-6 sm:p-10 flex flex-col min-h-[480px]">
            <StepProgress current={step} total={TOTAL_STEPS} />

            <div className="mt-6 flex-1">
              {step === 1 && (
                <>
                  <h1 className="text-[28px] sm:text-[32px] leading-[1.15] font-extrabold tracking-tight text-ink">
                    Apa yang ingin
                    <br />
                    Anda <span className="text-brand-600">laporkan?</span>
                  </h1>
                  <p className="text-[13px] text-ink-soft mt-2 max-w-sm">
                    Pilih jenis masalah yang Anda alami saat mengakses website
                    resmi pemerintah.
                  </p>

                  <div className="mt-6 space-y-2.5">
                    {CATEGORIES.map((c) => {
                      const active = kategori === c.value;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => {
                            setKategori(c.value);
                            setErrorMsg(null);
                          }}
                          className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                            active
                              ? 'border-brand-600 bg-brand-50/60 shadow-sm'
                              : 'border-line bg-white hover:border-stone-300'
                          }`}
                        >
                          <span className={active ? 'text-brand-600' : 'text-ink'}>
                            {c.icon}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-bold text-ink leading-snug">
                              {c.value}
                            </span>
                            <span className="block text-[11px] text-ink-faint leading-snug mt-0.5">
                              {c.desc}
                            </span>
                          </span>
                          <span
                            className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                              active ? 'border-brand-600' : 'border-stone-300'
                            }`}
                          >
                            {active && (
                              <span className="w-2 h-2 rounded-full bg-brand-600" />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <Eyebrow>Detail Masalah</Eyebrow>
                  <h1 className="text-[28px] sm:text-[32px] leading-[1.15] font-extrabold tracking-tight text-ink mt-1.5">
                    Sebutkan alamat website yang bermasalah.
                  </h1>
                  <p className="text-[13px] text-ink-soft mt-2 max-w-md">
                    Masukkan alamat lengkap website pemerintah yang mengalami
                    kendala, misalnya: https://www.kemenkeu.go.id
                  </p>

                  <div className="mt-6">
                    <div
                      className={`flex items-center gap-2 rounded-xl border px-4 py-3 bg-white transition focus-within:ring-2 focus-within:ring-brand-600/15 ${
                        siteUrlInvalid ? 'border-brand-600' : 'border-line focus-within:border-brand-600'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-ink-faint shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" strokeLinecap="round" />
                        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" strokeLinecap="round" />
                      </svg>
                      <input
                        type="url"
                        value={siteUrl}
                        onChange={(e) => {
                          setSiteUrl(e.target.value);
                          setErrorMsg(null);
                        }}
                        placeholder="https://"
                        autoFocus
                        className="flex-1 min-w-0 text-sm text-ink placeholder:text-stone-300 focus:outline-none bg-transparent"
                      />
                      {siteUrl && (
                        <button
                          type="button"
                          onClick={() => setSiteUrl('')}
                          aria-label="Hapus alamat"
                          className="w-5 h-5 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-500 text-[11px] leading-none flex items-center justify-center transition"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      <span className="text-[11px] text-ink-faint">Contoh terdaftar:</span>
                      {SAMPLE_SITES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSiteUrl(s);
                            setErrorMsg(null);
                          }}
                          className="text-[11px] px-2 py-0.5 rounded-full border border-line bg-cream text-ink-soft hover:border-brand-600 hover:text-brand-700 transition"
                        >
                          {s.replace('https://', '')}
                        </button>
                      ))}
                    </div>

                    {siteUrlInvalid && (
                      <p className="text-[11px] text-brand-700 mt-2">
                        Alamat belum valid — pastikan menyertakan awalan https://
                      </p>
                    )}
                    {showNonGoIdWarning && (
                      <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
                        <strong>Peringatan:</strong> URL ini bukan domain{' '}
                        <code>*.go.id</code>. Sistem memprioritaskan website resmi
                        yang terdaftar di allowlist.
                      </div>
                    )}
                    {!siteUrlInvalid && !showNonGoIdWarning && (
                      <p className="text-[11px] text-ink-faint mt-2">
                        Pastikan alamat website sudah benar, termasuk awalan https://
                      </p>
                    )}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <Eyebrow>Deskripsi Masalah</Eyebrow>
                  <h1 className="text-[28px] sm:text-[32px] leading-[1.15] font-extrabold tracking-tight text-ink mt-1.5">
                    Ceritakan kendala yang Anda alami.
                  </h1>
                  <p className="text-[13px] text-ink-soft mt-2 max-w-md">
                    Jelaskan secara singkat dan jelas, apa yang terjadi, kapan
                    terjadi, dan jika ada pesan error yang muncul.
                  </p>

                  <div className="mt-6">
                    <textarea
                      rows={7}
                      value={deskripsi}
                      maxLength={DESC_MAX}
                      onChange={(e) => {
                        setDeskripsi(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="Contoh: Website tidak bisa diakses sejak pagi hari, muncul pesan &#8220;404 Not Found&#8221; saat dibuka melalui browser Chrome..."
                      autoFocus
                      className="w-full rounded-xl border border-line px-4 py-3 text-[13px] leading-relaxed text-ink placeholder:text-stone-300 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15 resize-none"
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-ink-faint">
                        Minimal 20 karakter agar mudah ditindaklanjuti.
                      </span>
                      <span className="text-[11px] text-ink-faint tabular-nums">
                        {deskripsi.length}/{DESC_MAX}
                      </span>
                    </div>
                    {fieldErrors.deskripsi && (
                      <p className="text-[11px] text-brand-700 mt-1">
                        {fieldErrors.deskripsi[0]}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowExtra((v) => !v)}
                      className="mt-3 text-[12px] font-bold text-brand-700 hover:text-brand-600 transition"
                    >
                      {showExtra ? '− Sembunyikan' : '+ Tambahkan'} bukti &amp; identitas (opsional)
                    </button>
                    {showExtra && (
                      <div className="mt-3 rounded-xl border border-line bg-cream/60 p-4 space-y-3">
                        <div>
                          <label className="block text-[12px] font-bold text-ink mb-1">
                            Screenshot bukti{' '}
                            <span className="font-normal text-ink-faint">(gambar, maks 5MB)</span>
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleScreenshotChange}
                            className="block w-full text-[12px] text-ink-soft file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-[11px] file:font-bold file:bg-white file:text-ink file:border file:border-line hover:file:border-brand-600"
                          />
                          {screenshotName && (
                            <p className="text-[11px] text-emerald-700 mt-1">
                              Terpilih: {screenshotName}
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={namaPelapor}
                            onChange={(e) => setNamaPelapor(e.target.value)}
                            placeholder="Nama Anda (opsional)"
                            className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:border-brand-600 focus:outline-none"
                          />
                          <input
                            type="email"
                            value={kontak}
                            onChange={(e) => setKontak(e.target.value)}
                            placeholder="Email (opsional)"
                            className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:border-brand-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <Eyebrow>Tinjau Laporan</Eyebrow>
                  <h1 className="text-[28px] sm:text-[32px] leading-[1.15] font-extrabold tracking-tight text-ink mt-1.5">
                    Pastikan data yang Anda isi sudah benar.
                  </h1>
                  <p className="text-[13px] text-ink-soft mt-2 max-w-md">
                    Jika sudah sesuai, klik Kirim Laporan untuk menyampaikan
                    pengaduan Anda.
                  </p>

                  <div className="mt-6 rounded-2xl border border-line bg-white divide-y divide-line/80 overflow-hidden">
                    <div className="flex gap-3 px-4 py-3.5">
                      <span className="text-brand-600 mt-0.5">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <rect x="3" y="4" width="18" height="12" rx="2" />
                          <path d="M9 20h6M12 16v4" strokeLinecap="round" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-ink-faint">Kategori masalah</p>
                        <p className="text-[13px] font-bold text-ink">{kategori}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 px-4 py-3.5">
                      <span className="text-brand-600 mt-0.5">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" strokeLinecap="round" />
                          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" strokeLinecap="round" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-ink-faint">Alamat website</p>
                        <p className="text-[13px] font-bold text-ink break-all">{siteUrl}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 px-4 py-3.5">
                      <span className="text-brand-600 mt-0.5">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path d="M6 2h12v20H6z" strokeLinejoin="round" />
                          <path d="M9 6h6M9 10h6M9 14h4" strokeLinecap="round" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-ink-faint">Deskripsi</p>
                        <p className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">
                          {deskripsi.length > 160 ? `${deskripsi.slice(0, 160)}...` : deskripsi}
                        </p>
                        {(namaPelapor || kontak || screenshotName) && (
                          <p className="text-[11px] text-ink-faint mt-1">
                            {[namaPelapor, kontak, screenshotName].filter(Boolean).join(' • ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {errorMsg && (
                <div className="mt-4 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-[12px] font-medium text-brand-800">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Footer nav */}
            <div className="mt-8 flex items-center justify-between">
              {step > 1 ? (
                <BackLink onClick={() => { setStep((s) => s - 1); setErrorMsg(null); }}>
                  Kembali
                </BackLink>
              ) : (
                <span className="text-[11px] text-ink-faint hidden sm:block">
                  Laporan diproses otomatis oleh AI
                </span>
              )}
              {step < TOTAL_STEPS ? (
                <NextButton type="button" onClick={handleNext} disabled={!canNext()}>
                  Lanjut
                </NextButton>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 hover:bg-brand-700 disabled:bg-stone-300 text-white text-sm font-bold pl-6 pr-5 py-2.5 shadow-pop transition active:scale-[0.98]"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
                        <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
                      </svg>
                      Kirim Laporan
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Right: visual side */}
          <div className="p-4 sm:p-6 lg:pl-0">
            <VisualPanel step={step} />
          </div>
        </div>
      </div>

      {/* Recent reports strip */}
      <div className="bg-white rounded-3xl border border-line shadow-card p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-ink tracking-tight">
            Laporan terbaru
          </h2>
          <Link href="/admin" className="text-[12px] font-semibold text-ink-faint hover:text-brand-700 underline underline-offset-2">
            Semua di /admin →
          </Link>
        </div>
        {recentReports.length === 0 ? (
          <p className="text-[12px] text-ink-faint py-4 text-center">
            Belum ada laporan yang tercatat.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentReports.slice(0, 4).map((rep) => (
              <Link
                key={rep.id}
                href={`/lapor/${rep.id}`}
                className="block rounded-2xl border border-line p-4 hover:border-brand-600/50 hover:shadow-card transition bg-cream/50"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-[11px] text-ink-faint">
                    #{rep.id.slice(0, 10)}
                  </span>
                  <StatusBadge status={rep.status} />
                </div>
                <p className="text-[13px] font-bold text-ink line-clamp-1">
                  {rep.deskripsi.replace(/^\[Kategori:[^\]]+\]\s*/, '')}
                </p>
                <div className="flex items-center justify-between mt-1.5 text-[11px] text-ink-faint">
                  <span className="truncate max-w-[200px]">{rep.siteUrl}</span>
                  <span>
                    {new Date(rep.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
