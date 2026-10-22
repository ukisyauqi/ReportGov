"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { ThanksPanel } from "@/components/lapor-ui";

interface ReportDetail {
  id: string;
  siteUrl: string;
  deskripsi: string;
  screenshot: string | null;
  namaPelapor: string | null;
  status: string;
  prompt: string | null;
  harnessLog: string | null;
  prUrl: string | null;
  repoUrl: string | null;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROCESSING = new Set(["baru", "diproses-ai"]);

export default function LaporTrackingPage() {
  const params = useParams<{ id: string }>();
  const reportId = params?.id || "";

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!reportId) return;
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Laporan tidak ditemukan");
        setLoading(false);
        return;
      }
      setReport(data);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(String((err as Error)?.message || err));
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    if (!report) return;
    if (!PROCESSING.has(report.status)) return;
    const timer = setInterval(fetchReport, 2500);
    return () => clearInterval(timer);
  }, [report, fetchReport]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-line shadow-card p-12 text-center">
        <div className="w-8 h-8 border-[3px] border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-ink-soft">
          Memuat detail laporan #{reportId}...
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-white rounded-3xl border border-brand-200 p-10 text-center shadow-card">
        <h1 className="text-lg font-extrabold text-brand-700 mb-2">
          Gagal memuat laporan
        </h1>
        <p className="text-sm text-ink-soft mb-5">{error}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-5 py-2 text-xs font-bold"
        >
          ← Kembali ke Beranda
        </Link>
      </div>
    );
  }

  const done = !PROCESSING.has(report.status);
  const reportNo = `#WBP-${new Date(report.createdAt).getFullYear()}${String(
    new Date(report.createdAt).getMonth() + 1,
  ).padStart(
    2,
    "0",
  )}${String(new Date(report.createdAt).getDate()).padStart(2, "0")}-${report.id.slice(-6).toUpperCase()}`;

  return (
    <div className="space-y-5">
      {/* Success / status card */}
      <div className="bg-white rounded-3xl border border-line shadow-card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-6 sm:p-8">
          <div className="lg:col-span-3">
            <div className="flex items-start gap-4">
              <span
                className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-white text-xl font-extrabold ${
                  done ? "bg-brand-600 shadow-pop" : "bg-ink"
                }`}
              >
                {done ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    aria-hidden
                  >
                    <path
                      d="M4 12.5l5 5L20 6.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
                )}
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
                  {done
                    ? "Laporan Anda telah terkirim!"
                    : "Laporan Anda sedang diproses..."}
                </h1>
                <p className="text-[12px] text-ink-soft mt-1 leading-relaxed">
                  {done
                    ? "Terima kasih, laporan Anda sudah berhasil dikirim. Kami akan meninjau dan menindaklanjuti pengaduan ini secepatnya."
                    : "Laporan Anda sudah diterima dan sedang dicek otomatis oleh AI harness. Halaman ini akan diperbarui secara langsung."}
                </p>
              </div>
            </div>

            {/* Meta strip: nomor / status / tanggal */}
            <div className="mt-6 rounded-2xl border border-line divide-y sm:divide-y-0 sm:divide-x sm:flex divide-line/80 overflow-hidden">
              <div className="flex-1 px-4 py-3.5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-ink-faint mb-1">
                  Nomor Laporan
                </p>
                <p className="text-[13px] font-extrabold text-ink flex items-center gap-2">
                  <span className="truncate">{reportNo}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(report.id).catch(() => {});
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    aria-label="Salin ID laporan"
                    className="text-ink-faint hover:text-brand-700 transition shrink-0"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden
                    >
                      <rect x="9" y="9" width="12" height="12" rx="2" />
                      <path
                        d="M5 15V5a2 2 0 0 1 2-2h10"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  {copied && (
                    <span className="text-[10px] font-bold text-emerald-600">
                      Disalin!
                    </span>
                  )}
                </p>
              </div>
              <div className="flex-1 px-4 py-3.5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-ink-faint mb-1">
                  Status
                </p>
                <StatusBadge status={report.status} />
              </div>
              <div className="flex-1 px-4 py-3.5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-ink-faint mb-1">
                  Tanggal
                </p>
                <p className="text-[13px] font-bold text-ink">
                  {new Date(report.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {", "}
                  {new Date(report.createdAt).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-bold px-5 py-2.5 shadow-pop transition"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 3l9 8h-3v9h-4v-6H10v6H6v-9H3z" />
                </svg>
                Kembali ke Beranda
              </Link>
              {report.prUrl && (
                <a
                  href={report.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-5 py-2.5 text-[13px] font-bold text-emerald-700 hover:border-emerald-400 transition"
                >
                  Lihat Pull Request →
                </a>
              )}
              {!done && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-brand-700 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse-dot" />
                  Memperbarui otomatis...
                </span>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <ThanksPanel />
          </div>
        </div>
      </div>

      {/* Detail laporan */}
      <div className="bg-white rounded-3xl border border-line shadow-card p-6 sm:p-8">
        <h2 className="text-base font-extrabold text-ink tracking-tight">
          Detail Laporan
        </h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-cream/70 border border-line/70 p-4">
            <span className="text-[11px] text-ink-faint block mb-0.5">
              Judul Laporan
            </span>
            <span className="font-bold text-ink text-[13px]">
              {report.deskripsi.match(
                /^\[(?:Judul|Kategori):\s*([^\]]+)\]/i,
              )?.[1] || "Laporan Masalah"}
            </span>
          </div>
          <div className="rounded-2xl bg-cream/70 border border-line/70 p-4">
            <span className="text-[11px] text-ink-faint block mb-0.5">
              URL Website
            </span>
            <a
              href={report.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-brand-700 hover:underline break-all text-[13px]"
            >
              {report.siteUrl}
            </a>
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-cream/70 border border-line/70 p-4">
          <span className="text-[11px] text-ink-faint block mb-0.5">
            Deskripsi Laporan
          </span>
          <pre className="whitespace-pre-wrap font-sans text-[13px] text-ink-soft leading-relaxed">
            {report.deskripsi.replace(/^\[(?:Judul|Kategori):[^\]]+\]\s*/i, "")}
          </pre>
        </div>
        {report.screenshot && (
          <div className="mt-3">
            <span className="text-[11px] font-bold text-ink-soft block mb-2">
              Lampiran screenshot:
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={report.screenshot}
              alt="Screenshot laporan"
              className="max-h-80 rounded-2xl border border-line object-contain"
            />
          </div>
        )}
      </div>

      {/* Live feed */}
      <div className="bg-white rounded-3xl border border-line shadow-card p-6 sm:p-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-extrabold text-ink tracking-tight">
              Log Aktifitas AI Agent
            </h2>
            <p className="text-[12px] text-ink-faint">
              Live feed kegiatan bug fixing oleh AI Agent
            </p>
          </div>
          <button
            type="button"
            onClick={fetchReport}
            className="px-4 py-1.5 rounded-full border border-line hover:border-ink text-[12px] font-bold text-ink-soft transition"
          >
            Muat ulang
          </button>
        </div>
        <pre className="log-scroll w-full font-mono text-[11px] bg-ink text-emerald-300/90 rounded-2xl p-4 overflow-x-auto max-h-[420px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {report.harnessLog || "Menunggu log pertama dari orchestrator..."}
        </pre>
      </div>
    </div>
  );
}
