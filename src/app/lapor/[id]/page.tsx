'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';

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

export default function LaporTrackingPage() {
  const params = useParams<{ id: string }>();
  const reportId = params?.id || '';

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!reportId) return;
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Laporan tidak ditemukan');
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

  // Auto-poll setiap 2.5 detik selama masih baru atau diproses-ai
  useEffect(() => {
    if (!report) return;
    if (report.status !== 'baru' && report.status !== 'diproses-ai') return;

    const timer = setInterval(() => {
      fetchReport();
    }, 2500);

    return () => clearInterval(timer);
  }, [report, fetchReport]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-600">
          Memuat detail laporan #{reportId}...
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center">
        <h1 className="text-lg font-bold text-rose-700 mb-2">
          Gagal Memuat Laporan
        </h1>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-semibold"
        >
          &larr; Kembali ke Beranda
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Status */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:underline">
                Beranda
              </Link>
              <span>/</span>
              <span className="font-mono">Laporan #{report.id}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 line-clamp-2">
              {report.deskripsi}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={report.status} />
            <button
              type="button"
              onClick={fetchReport}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 text-sm">
          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-xs text-slate-500 block">URL Website</span>
            <a
              href={report.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-blue-700 hover:underline break-all text-xs sm:text-sm"
            >
              {report.siteUrl}
            </a>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-xs text-slate-500 block">Dilaporkan</span>
            <span className="font-semibold text-slate-900 text-xs sm:text-sm">
              {new Date(report.createdAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-xs text-slate-500 block">
              OpenCode Session ID
            </span>
            <span className="font-mono text-xs font-semibold text-slate-900 break-all">
              {report.sessionId || 'Menunggu sesi OpenCode...'}
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-xs text-slate-500 block">Pull Request</span>
            {report.prUrl ? (
              <a
                href={report.prUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-700 hover:underline break-all text-xs sm:text-sm"
              >
                {report.prUrl} &rarr;
              </a>
            ) : (
              <span className="text-xs text-slate-500">Belum ada PR</span>
            )}
          </div>
        </div>

        {report.repoUrl && (
          <div className="mt-4 text-xs text-slate-500 flex flex-wrap items-center gap-2">
            <span>Target Repository:</span>
            <code className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono">
              {report.repoUrl}
            </code>
          </div>
        )}
      </div>

      {/* Detail Laporan & Screenshot */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          Deskripsi Masalah & Reproduksi
        </h2>
        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 bg-slate-50 rounded-xl p-4 border border-slate-100 leading-relaxed">
          {report.deskripsi}
        </pre>

        {report.screenshot && (
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-2">
              Lampiran Screenshot Pelapor:
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={report.screenshot}
              alt="Screenshot Laporan"
              className="max-h-80 rounded-xl border border-slate-200 object-contain"
            />
          </div>
        )}
      </div>

      {/* Prompt Terkirim (Read-Only Collapsible) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <details className="group" open={Boolean(report.prompt)}>
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Prompt Terkirim ke OpenCode (Read-Only)
              </h2>
              <p className="text-xs text-slate-500">
                Klik untuk membuka/menutup prompt yang disusun otomatis dari
                template + bukti live check
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-md bg-slate-100 text-slate-700 group-open:bg-slate-900 group-open:text-white transition">
              Toggle Prompt
            </span>
          </summary>

          <div className="mt-4">
            <textarea
              readOnly
              value={
                report.prompt ||
                'Prompt sedang disusun oleh backend harness...'
              }
              rows={12}
              className="w-full font-mono text-xs bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 focus:outline-none"
            />
          </div>
        </details>
      </div>

      {/* Harness Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Aktivitas OpenCode
            </h2>
            <p className="text-xs text-slate-500">
              Live feed: file yang dibaca/ditulis AI, perintah yang dijalankan,
              hingga Pull Request
            </p>
          </div>
          {(report.status === 'baru' || report.status === 'diproses-ai') && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              Auto-updating...
            </span>
          )}
        </div>

        <pre className="w-full font-mono text-xs bg-slate-950 text-emerald-400 rounded-xl p-4 overflow-x-auto max-h-[480px] overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
          {report.harnessLog || 'Menunggu log pertama dari orchestrator...'}
        </pre>
      </div>
    </div>
  );
}
