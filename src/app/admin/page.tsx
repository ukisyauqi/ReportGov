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
    <div className="space-y-6">
      {/* Header & Admin Key Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 mb-2">
              Read-Only Monitoring (Tanpa Trigger Manual)
            </span>
            <h1 className="text-2xl font-bold text-slate-900">
              Dashboard Monitoring AI Harness
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Semua laporan diproses otomatis saat submit. Halaman ini hanya
              untuk memantau sesi OpenCode, prompt, log iterasi, dan Pull
              Request.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">
              x-admin-key:
            </label>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Masukkan ADMIN_KEY"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono focus:border-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={fetchReports}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
            >
              Muat Ulang
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 pt-5 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Filter Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">Semua Status</option>
              {STATUS_LIST.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Cari URL / ID
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari *.go.id atau ID laporan..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      {authError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
          <strong>Akses Ditolak:</strong> {authError}
        </div>
      )}

      {/* Tabel & Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tabel Daftar Laporan */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Daftar Laporan ({reports.length})
            </h2>
            {loading && (
              <span className="text-xs text-slate-500">Memuat...</span>
            )}
          </div>

          {reports.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Tidak ada laporan yang cocok dengan filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
              {reports.map((rep) => {
                const isSelected = selectedReport?.id === rep.id;
                return (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => setSelectedReport(rep)}
                    className={`w-full text-left p-4 transition hover:bg-slate-50 ${
                      isSelected ? 'bg-slate-100/80' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[11px] text-slate-500">
                        #{rep.id}
                      </span>
                      <StatusBadge status={rep.status} />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                      {rep.deskripsi}
                    </p>
                    <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500">
                      <span className="truncate max-w-[190px]">
                        {rep.siteUrl}
                      </span>
                      <span className="text-[11px]">
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

        {/* Panel Detail Read-Only */}
        <div className="lg:col-span-7">
          {!selectedReport ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
              Pilih salah satu laporan di sebelah kiri untuk melihat detail sesi
              OpenCode, prompt, dan log iterasi.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="font-mono text-xs text-slate-500">
                    ID: {selectedReport.id}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5 line-clamp-2">
                    {selectedReport.deskripsi}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedReport.status} />
                  <Link
                    href={`/lapor/${selectedReport.id}`}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 font-medium text-slate-700"
                  >
                    Halaman Publik &rarr;
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Site URL</span>
                  <a
                    href={selectedReport.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-blue-700 hover:underline break-all"
                  >
                    {selectedReport.siteUrl}
                  </a>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">
                    OpenCode Session ID
                  </span>
                  <span className="font-mono font-semibold text-slate-900 break-all">
                    {selectedReport.sessionId || '-'}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Target Repo</span>
                  <span className="font-mono text-slate-800 break-all">
                    {selectedReport.repoUrl || '-'}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Pull Request URL</span>
                  {selectedReport.prUrl ? (
                    <a
                      href={selectedReport.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-emerald-700 hover:underline break-all"
                    >
                      {selectedReport.prUrl}
                    </a>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Deskripsi Laporan
                </h3>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                  {selectedReport.deskripsi}
                </pre>
              </div>

              <details className="rounded-xl border border-slate-200 p-3.5">
                <summary className="cursor-pointer text-xs font-bold text-slate-800">
                  Prompt Terkirim (Read-Only Collapsible)
                </summary>
                <pre className="mt-3 font-mono text-xs bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {selectedReport.prompt || '(Belum ada prompt)'}
                </pre>
              </details>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Aktivitas OpenCode
                </h3>
                <pre className="font-mono text-xs bg-slate-950 text-emerald-400 rounded-xl p-4 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
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
