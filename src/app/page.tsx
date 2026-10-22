"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BackLink,
  Eyebrow,
  NextButton,
  StepProgress,
  VisualPanel,
} from "@/components/lapor-ui";

const TOTAL_STEPS = 5;
const DESC_MAX = 500;

const CATEGORIES = [
  {
    value: "Website tidak bisa diakses",
    desc: "Halaman tidak muncul, error, atau tidak bisa dibuka.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path
          d="M9 20h6M12 16v4M7.5 9.5l-2 2 2 2M16.5 9.5l2 2-2 2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    value: "Website lambat",
    desc: "Membuka halaman terlalu lama.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden
      >
        <path d="M12 13l4-4" strokeLinecap="round" />
        <path d="M3.5 17a9 9 0 1 1 17 0" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    value: "Bug / Fitur tidak jalan",
    desc: "Tombol, form, atau fitur tidak berfungsi sebagaimana mestinya.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden
      >
        <path d="M6 2h9l5 5v15H6z" strokeLinejoin="round" />
        <path d="M14 2v6h6" strokeLinejoin="round" />
        <path d="M12 11v5M12 18.2v.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "Masalah lainnya",
    desc: "Pilih ini jika masalah Anda tidak termasuk kategori di atas.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden
      >
        <path d="M6 2h12v20H6z" strokeLinejoin="round" />
        <path d="M9 6h6M9 10h6M9 14h4" strokeLinecap="round" />
      </svg>
    ),
  },
];

function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function HomePage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [kategori, setKategori] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState("");
  const [namaPelapor, setNamaPelapor] = useState("");
  const [kontak, setKontak] = useState("");
  const [showIdentity, setShowIdentity] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [registeredSites, setRegisteredSites] = useState<string[]>([]);
  const [trackId, setTrackId] = useState("");
  const [mode, setMode] = useState<"form" | "track">("form");
  const siteUrlInvalid = siteUrl.trim().length > 0 && !isValidUrl(siteUrl);

  useEffect(() => {
    fetch("/api/sites")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.sites)) setRegisteredSites(data.sites);
      })
      .catch(() => {
        // abaikan, daftar contoh tetap kosong
      });
  }, []);

  function handleScreenshotFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("File screenshot harus berupa gambar (PNG/JPG/WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Ukuran gambar maksimal 5MB.");
      return;
    }
    setErrorMsg(null);
    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setScreenshot(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleScreenshotFile(e.target.files?.[0]);
  }

  function clearScreenshot() {
    setScreenshot(null);
    setScreenshotName("");
  }

  function canNext(): boolean {
    if (step === 1) return kategori !== "";
    if (step === 2) return isValidUrl(siteUrl);
    if (step === 3) return deskripsi.trim().length >= 20;
    return true;
  }

  function handleNext() {
    setErrorMsg(null);
    if (!canNext()) {
      if (step === 1)
        setErrorMsg("Pilih salah satu judul laporan terlebih dahulu.");
      if (step === 2)
        setErrorMsg(
          siteUrl.trim()
            ? "Alamat website belum valid. Pastikan menyertakan https://"
            : "Isi alamat website yang bermasalah terlebih dahulu.",
        );
      if (step === 3)
        setErrorMsg(
          "Ceritakan kendala Anda minimal 20 karakter agar mudah ditindaklanjuti.",
        );
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setErrorMsg(null);
    setFieldErrors({});
    try {
      const finalDeskripsi = `[Judul: ${kategori}]\n\n${deskripsi.trim()}`;
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        setErrorMsg(data.error || "Gagal mengirim laporan");
        if (data.issues) setFieldErrors(data.issues);
        setSubmitting(false);
        return;
      }
      router.push(`/lapor/${data.id}`);
    } catch (err) {
      setErrorMsg(
        `Gagal menghubungi server: ${String((err as Error)?.message || err)}`,
      );
      setSubmitting(false);
    }
  }

  if (mode === "track") {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-line shadow-card overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-6 sm:p-10 flex flex-col justify-center min-h-[480px]">
              <Eyebrow>Lacak Laporan</Eyebrow>
              <h1 className="text-[28px] sm:text-[32px] leading-[1.15] font-extrabold tracking-tight text-ink mt-1.5">
                Sudah punya kode laporan?
              </h1>
              <p className="text-[13px] text-ink-soft mt-2 max-w-md">
                Masukkan ID/kode laporan yang pernah dibuat untuk melihat
                statusnya.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const id = trackId.trim();
                  if (id) router.push(`/lapor/${id}`);
                }}
                className="mt-6"
              >
                <label
                  htmlFor="track-id-input"
                  className="block text-[11px] font-bold text-ink-soft mb-1.5"
                >
                  ID / Kode laporan
                </label>
                <input
                  id="track-id-input"
                  type="text"
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  placeholder="cth: cm3abc123"
                  autoFocus
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 font-mono text-sm text-ink placeholder:text-stone-300 placeholder:font-sans focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15"
                />
                <button
                  type="submit"
                  disabled={!trackId.trim()}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-600 hover:bg-brand-700 disabled:bg-stone-300 text-white text-sm font-bold px-6 py-2.5 shadow-pop transition active:scale-[0.98]"
                >
                  Lacak Laporan
                </button>
              </form>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => setMode("form")}
                  className="text-[12px] font-bold text-brand-700 hover:text-brand-600 hover:underline transition"
                >
                  ← Kembali ke form laporan
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 lg:pl-0">
              <VisualPanel step={1} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wizard card */}
      <div className="bg-white rounded-3xl border border-line shadow-card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left: form side */}
          <div className="p-6 sm:p-10 flex flex-col min-h-[480px]">
            <>
              <StepProgress current={step} total={TOTAL_STEPS} />

              <div className="mt-6 flex-1">
              {step === 1 && (
                <>
                  <Eyebrow>Pilih Judul Laporan</Eyebrow>
                  <h1 className="text-[28px] sm:text-[32px] leading-[1.15] font-extrabold tracking-tight text-ink mt-1.5">
                    Pilih judul laporan
                    <br />
                    yang paling <span className="text-brand-600">sesuai.</span>
                  </h1>

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
                              ? "border-brand-600 bg-sky-50 shadow-sm"
                              : "border-line bg-white hover:border-stone-300"
                          }`}
                        >
                          <span
                            className={active ? "text-brand-600" : "text-ink"}
                          >
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
                              active ? "border-brand-600" : "border-stone-300"
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

                  <div className="mt-6">
                    <div
                      className={`flex items-center gap-2 rounded-xl border px-4 py-3 bg-white transition focus-within:ring-2 focus-within:ring-brand-600/15 ${
                        siteUrlInvalid
                          ? "border-brand-600"
                          : "border-line focus-within:border-brand-600"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 text-ink-faint shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                      >
                        <path
                          d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"
                          strokeLinecap="round"
                        />
                        <path
                          d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"
                          strokeLinecap="round"
                        />
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
                          onClick={() => setSiteUrl("")}
                          aria-label="Hapus alamat"
                          className="w-5 h-5 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-500 text-[11px] leading-none flex items-center justify-center transition"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {registeredSites.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        <span className="text-[11px] text-ink-faint">
                          Website terdaftar:
                        </span>
                        {registeredSites.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setSiteUrl(s);
                              setErrorMsg(null);
                            }}
                            className="text-[11px] px-2 py-0.5 rounded-full border border-line bg-cream text-ink-soft hover:border-brand-600 hover:text-brand-700 transition"
                          >
                            {s.replace(/^https?:\/\//, "")}
                          </button>
                        ))}
                      </div>
                    )}

                    {siteUrlInvalid && (
                      <p className="text-[11px] text-brand-700 mt-2">
                        Alamat belum valid — pastikan menyertakan awalan
                        https://
                      </p>
                    )}
                    {fieldErrors.siteUrl && (
                      <p className="text-[11px] text-rose-700 font-semibold mt-2">
                        {fieldErrors.siteUrl.join(", ")}
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

                  <div className="mt-6">
                    <textarea
                      rows={7}
                      value={deskripsi}
                      maxLength={DESC_MAX}
                      onChange={(e) => {
                        setDeskripsi(e.target.value);
                        setErrorMsg(null);
                        if (fieldErrors.deskripsi) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.deskripsi;
                            return next;
                          });
                        }
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
                      <p className="text-[11px] text-rose-700 font-semibold mt-1">
                        {fieldErrors.deskripsi[0]}
                      </p>
                    )}
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <Eyebrow>Bukti &amp; Identitas</Eyebrow>
                  <h1 className="text-[28px] sm:text-[32px] leading-[1.15] font-extrabold tracking-tight text-ink mt-1.5">
                    Tambahkan bukti screenshoot.
                  </h1>
                  <p className="text-[13px] text-ink-soft mt-2 max-w-md">
                    (opsional)
                  </p>

                  <div className="mt-6">
                    <div>
                      <label
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragging(false);
                          handleScreenshotFile(e.dataTransfer.files?.[0]);
                        }}
                        className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${
                          dragging
                            ? "border-brand-600 bg-sky-50"
                            : "border-line bg-cream/60 hover:border-brand-600 hover:bg-sky-50/50"
                        }`}
                      >
                        <input
                          key={screenshotName || "empty"}
                          type="file"
                          accept="image/*"
                          onChange={handleScreenshotChange}
                          className="hidden"
                        />
                        {screenshot ? (
                          <img
                            src={screenshot}
                            alt="Pratinjau screenshot"
                            className="max-h-40 rounded-xl border border-line object-contain shadow-sm"
                          />
                        ) : (
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm border border-line">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              aria-hidden
                            >
                              <path
                                d="M12 16V4m0 0l-4 4m4-4l4 4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
                                strokeLinecap="round"
                              />
                            </svg>
                          </span>
                        )}
                        <span className="text-[13px] font-bold text-ink">
                          {screenshot
                            ? "Klik atau seret gambar lain untuk mengganti"
                            : "Klik untuk pilih gambar"}
                        </span>
                        <span className="text-[11px] text-ink-faint">
                          {screenshot
                            ? screenshotName
                            : "atau seret file ke sini — PNG/JPG/WebP, maks 5MB"}
                        </span>
                      </label>
                      {screenshotName && (
                        <button
                          type="button"
                          onClick={clearScreenshot}
                          className="mt-1.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 transition"
                        >
                          Hapus gambar
                        </button>
                      )}
                      {fieldErrors.screenshot && (
                        <p className="text-[11px] text-rose-700 font-semibold mt-1">
                          {fieldErrors.screenshot[0]}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowIdentity((v) => !v)}
                      className="mt-8 text-[12px] font-bold text-brand-700 hover:text-brand-600 transition"
                    >
                      {showIdentity
                        ? "− Sembunyikan kontak"
                        : "+ Tambahkan kontak"}{" "}
                      pelapor (opsional)
                    </button>
                    {showIdentity && (
                      <div className="mt-3 rounded-xl border border-line bg-cream/60 p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <input
                              type="text"
                              value={namaPelapor}
                              onChange={(e) => {
                                setNamaPelapor(e.target.value);
                                if (fieldErrors.namaPelapor) {
                                  setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.namaPelapor;
                                    return next;
                                  });
                                }
                              }}
                              placeholder="Nama Anda (opsional)"
                              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:border-brand-600 focus:outline-none"
                            />
                            {fieldErrors.namaPelapor && (
                              <p className="text-[11px] text-rose-700 font-semibold mt-1">
                                {fieldErrors.namaPelapor[0]}
                              </p>
                            )}
                          </div>
                          <div>
                            <input
                              type="email"
                              value={kontak}
                              onChange={(e) => {
                                setKontak(e.target.value);
                                setErrorMsg(null);
                                if (fieldErrors.kontak) {
                                  setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.kontak;
                                    return next;
                                  });
                                }
                              }}
                              placeholder="Email (opsional, cth: nama@email.com)"
                              className={`w-full rounded-lg border bg-white px-3 py-2 text-[13px] focus:outline-none ${
                                fieldErrors.kontak
                                  ? "border-rose-500 focus:border-rose-600"
                                  : "border-line focus:border-brand-600"
                              }`}
                            />
                            {fieldErrors.kontak && (
                              <p className="text-[11px] text-rose-700 font-semibold mt-1">
                                {fieldErrors.kontak[0]}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {step === 5 && (
                <>
                  <Eyebrow>Tinjau Laporan</Eyebrow>
                  <h1 className="text-[28px] sm:text-[32px] leading-[1.15] font-extrabold tracking-tight text-ink mt-1.5">
                    Pastikan data laporan sudah benar.
                  </h1>

                  <div className="mt-6 rounded-2xl border border-line bg-white divide-y divide-line/80 overflow-hidden">
                    <div className="flex gap-3 px-4 py-3.5">
                      <span className="text-brand-600 mt-0.5">
                        <svg
                          viewBox="0 0 24 24"
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                        >
                          <rect x="3" y="4" width="18" height="12" rx="2" />
                          <path d="M9 20h6M12 16v4" strokeLinecap="round" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-ink-faint">
                          Judul Laporan
                        </p>
                        <p className="text-[13px] font-bold text-ink">
                          {kategori}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 px-4 py-3.5">
                      <span className="text-brand-600 mt-0.5">
                        <svg
                          viewBox="0 0 24 24"
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                        >
                          <path
                            d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"
                            strokeLinecap="round"
                          />
                          <path
                            d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-ink-faint">
                          Alamat website
                        </p>
                        <p className="text-[13px] font-bold text-ink break-all">
                          {siteUrl}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 px-4 py-3.5">
                      <span className="text-brand-600 mt-0.5">
                        <svg
                          viewBox="0 0 24 24"
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                        >
                          <path d="M6 2h12v20H6z" strokeLinejoin="round" />
                          <path
                            d="M9 6h6M9 10h6M9 14h4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-ink-faint">Deskripsi</p>
                        <p className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">
                          {deskripsi.length > 160
                            ? `${deskripsi.slice(0, 160)}...`
                            : deskripsi}
                        </p>
                        {(namaPelapor || kontak || screenshotName) && (
                          <p className="text-[11px] text-ink-faint mt-1">
                            {[namaPelapor, kontak, screenshotName]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {errorMsg && (
                <div className="mt-5 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-[12px] text-rose-900 shadow-sm animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-rose-900 text-[13px]">
                        {errorMsg}
                      </p>
                      {Object.keys(fieldErrors).length > 0 ? (
                        <div className="mt-3 space-y-2 border-t border-rose-200/80 pt-2.5">
                          <p className="text-[11px] font-bold text-rose-800">
                            Rincian isian yang belum valid:
                          </p>
                          <ul className="space-y-1.5 text-[11px]">
                            {fieldErrors.siteUrl && (
                              <li className="flex items-center justify-between gap-3 bg-white/80 rounded-xl p-2.5 border border-rose-200/60">
                                <span>
                                  <strong>
                                    🌐 Alamat Website (Langkah 2):
                                  </strong>{" "}
                                  {fieldErrors.siteUrl.join(", ")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStep(2);
                                    setErrorMsg(null);
                                  }}
                                  className="text-brand-700 underline font-bold shrink-0 hover:text-brand-800 text-[11px]"
                                >
                                  Perbaiki →
                                </button>
                              </li>
                            )}
                            {fieldErrors.deskripsi && (
                              <li className="flex items-center justify-between gap-3 bg-white/80 rounded-xl p-2.5 border border-rose-200/60">
                                <span>
                                  <strong>
                                    📝 Deskripsi Kendala (Langkah 3):
                                  </strong>{" "}
                                  {fieldErrors.deskripsi.join(", ")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStep(3);
                                    setErrorMsg(null);
                                  }}
                                  className="text-brand-700 underline font-bold shrink-0 hover:text-brand-800 text-[11px]"
                                >
                                  Perbaiki →
                                </button>
                              </li>
                            )}
                            {fieldErrors.kontak && (
                              <li className="flex items-center justify-between gap-3 bg-white/80 rounded-xl p-2.5 border border-rose-200/60">
                                <span>
                                  <strong>
                                    ✉️ Kontak / Email (Langkah 4):
                                  </strong>{" "}
                                  {fieldErrors.kontak.join(", ")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStep(4);
                                    setShowIdentity(true);
                                    setErrorMsg(null);
                                  }}
                                  className="text-brand-700 underline font-bold shrink-0 hover:text-brand-800 text-[11px]"
                                >
                                  Perbaiki →
                                </button>
                              </li>
                            )}
                            {fieldErrors.screenshot && (
                              <li className="flex items-center justify-between gap-3 bg-white/80 rounded-xl p-2.5 border border-rose-200/60">
                                <span>
                                  <strong>🖼️ Screenshot (Langkah 4):</strong>{" "}
                                  {fieldErrors.screenshot.join(", ")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStep(4);
                                    setShowIdentity(true);
                                    setErrorMsg(null);
                                  }}
                                  className="text-brand-700 underline font-bold shrink-0 hover:text-brand-800 text-[11px]"
                                >
                                  Perbaiki →
                                </button>
                              </li>
                            )}
                            {fieldErrors.namaPelapor && (
                              <li className="flex items-center justify-between gap-3 bg-white/80 rounded-xl p-2.5 border border-rose-200/60">
                                <span>
                                  <strong>👤 Nama Pelapor (Langkah 4):</strong>{" "}
                                  {fieldErrors.namaPelapor.join(", ")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStep(4);
                                    setShowIdentity(true);
                                    setErrorMsg(null);
                                  }}
                                  className="text-brand-700 underline font-bold shrink-0 hover:text-brand-800 text-[11px]"
                                >
                                  Perbaiki →
                                </button>
                              </li>
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer nav */}
            <div className="mt-8 flex items-center justify-between">
              {step > 1 ? (
                <BackLink
                  onClick={() => {
                    setStep((s) => s - 1);
                    setErrorMsg(null);
                  }}
                >
                  Kembali
                </BackLink>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("track")}
                  className="text-[11px] text-ink-faint hover:text-brand-700 hover:underline transition text-left"
                >
                  Sudah punya kode laporan?{" "}
                  <span className="font-bold">Lacak di sini →</span>
                </button>
              )}
              {step < TOTAL_STEPS ? (
                <NextButton
                  type="button"
                  onClick={handleNext}
                  disabled={!canNext()}
                >
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
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
                      </svg>
                      Kirim Laporan
                    </>
                  )}
                </button>
              )}
            </div>
            </>
          </div>

          {/* Right: visual side */}
          <div className="p-4 sm:p-6 lg:pl-0">
            <VisualPanel step={step} />
          </div>
        </div>
      </div>
    </div>
  );
}
