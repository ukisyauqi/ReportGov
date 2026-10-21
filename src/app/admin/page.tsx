'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { STATUS_LIST } from '@/lib/validation';

interface AdminReport {
  id: string;
  siteUrl: string;
  deskripsi: string;
  screenshot: string | null;
  namaPelapor: string | null;
  kontak: string | null;
  status: string;
  prompt: string | null;
  harnessLog: string | null;
  prUrl: string | null;
  repoUrl: string | null;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminMonitoringPage() {
  const [adminKey, setAdminKey] = useState('admin-secret-go-id-2026');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/reports?${params.toString()}`, {
        headers: {
          'x-admin-key': adminKey,
        },
        cache: 'no-store',
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Gagal memuat data admin');
        setReports([]);
        setLoading(false);
        return;
      }

      const list: AdminReport[] = data.reports || [];
      setReports(list);
      setSelectedReport((prev) => {
        if (!prev) return list[0] || null;
        return list.find((r) => r.id === prev.id) || list[0] || null;
      });
      setLoading(false);
    } catch (err) {
      setAuthError(String((err as Error)?.message || err));
      setLoading(false);
    }
  }, [adminKey, statusFilter, searchQuery]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-line shadow-card p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cream-dark text-ink-soft border border-line mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
              Monitoring read-only — tanpa trigger manual
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">
              Dashboard <span className="text-brand-600">monitoring.</span>
            </h1>
            <p className="text-[12px] text-ink-faint mt-1">
              Semua laporan diproses otomatis saat submit. Pantau sesi OpenCode,
              prompt, log iterasi, dan Pull Request di sini.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-bold text-ink-soft">
              x-admin-key:
            </label>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Masukkan ADMIN_KEY"
              className="rounded-full border border-line bg-cream/60 px-4 py-2 text-[12px] font-mono focus:border-brand-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={fetchReports}
              className="px-4 py-2 rounded-full bg-ink hover:bg-black text-white text-[12px] font-bold transition"
            >
              Muat Ulang
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 pt-5 border-t border-line">
          <div>
            <label className="block text-[11px] font-bold text-ink-soft mb-1">
              Filter status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] focus:border-brand-600 focus:outline-none"
            >
              <option value="">Semua status</option>
              {STATUS_LIST.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-soft mb-1">
              Cari URL / ID
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari *.go.id atau ID laporan..."
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] placeholder:text-stone-300 focus:border-brand-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {authError && (
        <div className="rounded-2xl bg-brand-50 border border-brand-200 p-4 text-[13px] text-brand-800">
          <strong>Akses ditolak:</strong> {authError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* List */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-line shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-ink">
              Daftar laporan ({reports.length})
            </h2>
            {loading && <span className="text-[11px] text-ink-faint">Memuat...</span>}
          </div>

          {reports.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-ink-faint">
              Tidak ada laporan yang cocok dengan filter.
            </div>
          ) : (
            <div className="divide-y divide-line/70 max-h-[680px] overflow-y-auto">
              {reports.map((rep) => {
                const isSelected = selectedReport?.id === rep.id;
                return (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => setSelectedReport(rep)}
                    className={`w-full text-left p-4 transition hover:bg-cream/70 ${
                      isSelected ? 'bg-brand-50/60 border-l-[3px] border-l-brand-600' : 'border-l-[3px] border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[11px] text-ink-faint">
                        #{rep.id}
                      </span>
                      <StatusBadge status={rep.status} />
                    </div>
                    <p className="text-[13px] font-bold text-ink line-clamp-1">
                      {rep.deskripsi.replace(/^\[Kategori:[^\]]+\]\s*/, '')}
                    </p>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] text-ink-faint">
                      <span className="truncate max-w-[190px]">{rep.siteUrl}</span>
                      <span>
                        {new Date(rep.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-7">
          {!selectedReport ? (
            <div className="bg-white rounded-3xl border border-line shadow-card p-10 text-center text-sm text-ink-faint">
              Pilih salah satu laporan di sebelah kiri untuk melihat detail sesi
              OpenCode, prompt, dan log iterasi.
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-line shadow-card p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                  <span className="font-mono text-[11px] text-ink-faint">
                    ID: {selectedReport.id}
                  </span>
                  <h2 className="text-lg font-extrabold tracking-tight text-ink mt-0.5 line-clamp-2">
                    {selectedReport.deskripsi.replace(/^\[Kategori:[^\]]+\]\s*/, '')}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedReport.status} />
                  <Link
                    href={`/lapor/${selectedReport.id}`}
                    className="text-[11px] font-bold px-3.5 py-1.5 rounded-full border border-line hover:border-ink text-ink-soft transition"
                  >
                    Halaman publik →
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                <div className="rounded-2xl bg-cream/70 p-3.5 border border-line/70">
                  <span className="text-ink-faint block">Site URL</span>
                  <a
                    href={selectedReport.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-brand-700 hover:underline break-all"
                  >
                    {selectedReport.siteUrl}
                  </a>
                </div>
                <div className="rounded-2xl bg-cream/70 p-3.5 border border-line/70">
                  <span className="text-ink-faint block">OpenCode Session ID</span>
                  <span className="font-mono font-bold text-ink break-all">
                    {selectedReport.sessionId || '-'}
                  </span>
                </div>
                <div className="rounded-2xl bg-cream/70 p-3.5 border border-line/70">
                  <span className="text-ink-faint block">Target repo</span>
                  <span className="font-mono text-ink break-all">
                    {selectedReport.repoUrl || '-'}
                  </span>
                </div>
                <div className="rounded-2xl bg-cream/70 p-3.5 border border-line/70">
                  <span className="text-ink-faint block">Pull Request URL</span>
                  {selectedReport.prUrl ? (
                    <a
                      href={selectedReport.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-emerald-700 hover:underline break-all"
                    >
                      {selectedReport.prUrl}
                    </a>
                  ) : (
                    <span className="text-ink-faint">-</span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint mb-1.5">
                  Deskripsi laporan
                </h3>
                <pre className="whitespace-pre-wrap font-sans text-[12px] text-ink-soft bg-cream/70 rounded-2xl p-4 border border-line/70">
                  {selectedReport.deskripsi}
                </pre>
              </div>

              <details className="rounded-2xl border border-line p-4">
                <summary className="cursor-pointer text-[12px] font-bold text-ink">
                  Prompt terkirim (read-only)
                </summary>
                <pre className="log-scroll mt-3 font-mono text-[11px] bg-ink text-stone-200 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {selectedReport.prompt || '(Belum ada prompt)'}
                </pre>
              </details>

              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint mb-1.5">
                  Aktivitas OpenCode
                </h3>
                <pre className="log-scroll font-mono text-[11px] bg-ink text-emerald-300/90 rounded-2xl p-4 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {selectedReport.harnessLog || '(Belum ada log)'}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
