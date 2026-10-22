"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { useClientSession } from "@/components/navbar-auth";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_LIST } from "@/lib/validation";

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

interface RegisteredSite {
  id: string;
  siteUrl: string;
  repoUrl: string;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminMonitoringPage() {
  const { status: sessionStatus } = useClientSession();
  const [tab, setTab] = useState<"laporan" | "situs">("laporan");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // --- Website terdaftar (DB) ---
  const [sites, setSites] = useState<RegisteredSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [sitesMsg, setSitesMsg] = useState<string | null>(null);
  const [formSiteUrl, setFormSiteUrl] = useState("");
  const [formRepoUrl, setFormRepoUrl] = useState("");
  const [formNote, setFormNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      // Session Auth.js terkirim otomatis via cookie httpOnly.
      const res = await fetch(`/api/reports?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Gagal memuat data admin");
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
  }, [statusFilter, searchQuery]);

  const fetchSites = useCallback(async () => {
    setSitesLoading(true);
    setSitesError(null);
    try {
      const res = await fetch("/api/admin/sites", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setSitesError(data.error || "Gagal memuat website terdaftar");
        setSites([]);
        return;
      }
      setSites(data.sites || []);
    } catch (err) {
      setSitesError(String((err as Error)?.message || err));
    } finally {
      setSitesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchReports();
      fetchSites();
    }
  }, [fetchReports, fetchSites, sessionStatus]);

  async function handleSaveSite(e: React.FormEvent) {
    e.preventDefault();
    setSitesError(null);
    setSitesMsg(null);
    if (!formSiteUrl.trim() || !formRepoUrl.trim()) {
      setSitesError("Alamat website dan URL repo wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        siteUrl: formSiteUrl.trim(),
        repoUrl: formRepoUrl.trim(),
        note: formNote.trim() || null,
      };
      const res = await fetch(
        editingId ? `/api/admin/sites/${editingId}` : "/api/admin/sites",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        const detail = data.issues
          ? Object.values(data.issues as Record<string, string[]>)
              .flat()
              .join(", ")
          : data.error;
        setSitesError(detail || "Gagal menyimpan website");
        return;
      }
      setSitesMsg(
        editingId ? "Website berhasil diperbarui." : "Website berhasil ditambahkan.",
      );
      setFormSiteUrl("");
      setFormRepoUrl("");
      setFormNote("");
      setEditingId(null);
      await fetchSites();
    } catch (err) {
      setSitesError(String((err as Error)?.message || err));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(s: RegisteredSite) {
    setEditingId(s.id);
    setFormSiteUrl(s.siteUrl);
    setFormRepoUrl(s.repoUrl);
    setFormNote(s.note || "");
    setSitesMsg(null);
    setSitesError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setFormSiteUrl("");
    setFormRepoUrl("");
    setFormNote("");
  }

  async function handleToggleActive(s: RegisteredSite) {
    setSitesError(null);
    try {
      const res = await fetch(`/api/admin/sites/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSitesError(data.error || "Gagal mengubah status");
        return;
      }
      await fetchSites();
    } catch (err) {
      setSitesError(String((err as Error)?.message || err));
    }
  }

  async function handleDeleteSite(s: RegisteredSite) {
    if (!confirm(`Hapus ${s.siteUrl} dari website terdaftar?`)) return;
    setSitesError(null);
    try {
      const res = await fetch(`/api/admin/sites/${s.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setSitesError(data.error || "Gagal menghapus website");
        return;
      }
      if (editingId === s.id) cancelEdit();
      await fetchSites();
    } catch (err) {
      setSitesError(String((err as Error)?.message || err));
    }
  }

  if (sessionStatus === "loading") {
    return (
      <div className="bg-white rounded-3xl border border-line shadow-card p-12 text-center">
        <div className="w-8 h-8 border-[3px] border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-ink-soft">Memeriksa sesi login...</p>
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    // Middleware normalnya sudah mengarahkan ke /login; fallback ini
    // hanya untuk kasus sesi kedaluwarsa di client.
    return (
      <div className="bg-white rounded-3xl border border-line shadow-card p-12 text-center">
        <div className="w-8 h-8 border-[3px] border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-ink-soft mb-4">
          Sesi berakhir, mengalihkan ke halaman login...
        </p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/admin" })}
          className="text-[13px] font-bold text-brand-700 hover:underline"
        >
          Klik di sini jika tidak teralihkan
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-line shadow-card p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cream-dark text-ink-soft border border-line mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
              {tab === "laporan"
                ? "Monitoring read-only — tanpa trigger manual"
                : "Sumber kebenaran: database"}
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">
              Dashboard <span className="text-brand-600">monitoring.</span>
            </h1>
            <p className="text-[12px] text-ink-faint mt-1">
              {tab === "laporan"
                ? "Semua laporan diproses otomatis saat submit. Pantau sesi OpenCode, prompt, log iterasi, dan Pull Request di sini."
                : "Daftar website yang boleh dilaporkan. Laporan dengan URL di luar daftar ini otomatis ditolak (Hierarki 1)."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tab === "laporan" && (
              <button
                type="button"
                onClick={fetchReports}
                title="Muat ulang"
                aria-label="Muat ulang"
                className="w-9 h-9 rounded-full border border-line bg-white hover:border-ink text-ink-soft hover:text-ink flex items-center justify-center transition"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    d="M4 4v5h5M20 20v-5h-5M5 9a8 8 0 0 1 14-3M19 15a8 8 0 0 1-14 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-5 pt-5 border-t border-line">
          <button
            type="button"
            onClick={() => setTab("laporan")}
            className={`px-4 py-2 rounded-full text-[13px] font-bold transition ${
              tab === "laporan"
                ? "bg-ink text-white"
                : "bg-cream text-ink-soft hover:text-ink border border-line"
            }`}
          >
            Laporan ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("situs")}
            className={`px-4 py-2 rounded-full text-[13px] font-bold transition ${
              tab === "situs"
                ? "bg-ink text-white"
                : "bg-cream text-ink-soft hover:text-ink border border-line"
            }`}
          >
            Website terdaftar ({sites.length})
          </button>
        </div>

        {tab === "laporan" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
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
        )}
      </div>

      {authError && tab === "laporan" && (
        <div className="rounded-2xl bg-brand-50 border border-brand-200 p-4 text-[13px] text-brand-800">
          <strong>Akses ditolak:</strong> {authError}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="ml-2 underline font-bold"
          >
            Keluar
          </button>
        </div>
      )}

      {tab === "laporan" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* List */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-line shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-ink">
                Daftar laporan ({reports.length})
              </h2>
              {loading && (
                <span className="text-[11px] text-ink-faint">Memuat...</span>
              )}
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
                        isSelected
                          ? "bg-brand-50/60 border-l-[3px] border-l-brand-600"
                          : "border-l-[3px] border-l-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-[11px] text-ink-faint">
                          #{rep.id}
                        </span>
                        <StatusBadge status={rep.status} />
                      </div>
                      <p className="text-[13px] font-bold text-ink line-clamp-1">
                        {rep.deskripsi.match(
                          /^\[(?:Judul|Kategori):\s*([^\]]+)\]/i,
                        )?.[1] || rep.deskripsi}
                      </p>
                      <div className="flex items-center justify-between mt-1.5 text-[11px] text-ink-faint">
                        <span className="truncate max-w-[190px]">
                          {rep.siteUrl}
                        </span>
                        <span>
                          {new Date(rep.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
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
                Pilih salah satu laporan di sebelah kiri untuk melihat detail
                sesi OpenCode, prompt, dan log iterasi.
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-line shadow-card p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <span className="font-mono text-[11px] text-ink-faint">
                      ID: {selectedReport.id}
                    </span>
                    <h2 className="text-lg font-extrabold tracking-tight text-ink mt-0.5 line-clamp-2">
                      {selectedReport.deskripsi.match(
                        /^\[(?:Judul|Kategori):\s*([^\]]+)\]/i,
                      )?.[1] || selectedReport.deskripsi}
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
                    <span className="text-ink-faint block">
                      OpenCode Session ID
                    </span>
                    <span className="font-mono font-bold text-ink break-all">
                      {selectedReport.sessionId || "-"}
                    </span>
                  </div>
                  <div className="rounded-2xl bg-cream/70 p-3.5 border border-line/70">
                    <span className="text-ink-faint block">Target repo</span>
                    <span className="font-mono text-ink break-all">
                      {selectedReport.repoUrl || "-"}
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
                    {selectedReport.prompt || "(Belum ada prompt)"}
                  </pre>
                </details>

                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint mb-1.5">
                    Aktivitas OpenCode
                  </h3>
                  <pre className="log-scroll font-mono text-[11px] bg-ink text-emerald-300/90 rounded-2xl p-4 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {selectedReport.harnessLog || "(Belum ada log)"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Form tambah/edit */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-line shadow-card p-6 h-fit">
            <h2 className="text-sm font-extrabold text-ink">
              {editingId ? "Ubah website" : "Tambah website + repo"}
            </h2>
            <p className="text-[12px] text-ink-faint mt-1">
              Website di sini yang tampil sebagai pilihan di form lapor dan
              lolos Hierarki 1.
            </p>
            <form onSubmit={handleSaveSite} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-ink-soft mb-1">
                  Alamat website
                </label>
                <input
                  type="url"
                  value={formSiteUrl}
                  onChange={(e) => setFormSiteUrl(e.target.value)}
                  placeholder="https://layanan.contoh.go.id"
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-soft mb-1">
                  URL repo GitHub
                </label>
                <input
                  type="url"
                  value={formRepoUrl}
                  onChange={(e) => setFormRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] font-mono focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-soft mb-1">
                  Catatan (opsional)
                </label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="cth: Portal layanan utama"
                  maxLength={500}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] focus:border-brand-600 focus:outline-none"
                />
              </div>
              {sitesError && (
                <p className="text-[12px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  {sitesError}
                </p>
              )}
              {sitesMsg && (
                <p className="text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  {sitesMsg}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-full bg-ink text-white text-[13px] font-bold px-5 py-2.5 hover:bg-brand-700 disabled:bg-stone-300 transition"
                >
                  {saving
                    ? "Menyimpan..."
                    : editingId
                      ? "Simpan perubahan"
                      : "Tambah website"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-full border border-line px-4 py-2.5 text-[13px] font-bold text-ink-soft hover:text-ink transition"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Tabel daftar */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-line shadow-card overflow-hidden h-fit">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-ink">
                Website terdaftar ({sites.length})
              </h2>
              <button
                type="button"
                onClick={fetchSites}
                className="text-[12px] font-bold text-brand-700 hover:underline"
              >
                {sitesLoading ? "Memuat..." : "Muat ulang"}
              </button>
            </div>
            {sites.length === 0 ? (
              <div className="p-8 text-center text-[12px] text-ink-faint">
                Belum ada website terdaftar. Tambahkan lewat form di samping.
              </div>
            ) : (
              <div className="divide-y divide-line/70 max-h-[680px] overflow-y-auto">
                {sites.map((s) => (
                  <div key={s.id} className="p-4 hover:bg-cream/50 transition">
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={s.siteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13px] font-bold text-brand-700 hover:underline break-all"
                      >
                        {s.siteUrl}
                      </a>
                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          s.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-stone-100 text-stone-500 border-stone-200"
                        }`}
                      >
                        {s.isActive ? "aktif" : "nonaktif"}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-ink-soft break-all mt-1">
                      {s.repoUrl}
                    </p>
                    {s.note && (
                      <p className="text-[11px] text-ink-faint mt-0.5">
                        {s.note}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-full border border-line hover:border-ink text-ink-soft hover:text-ink transition"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s)}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-full border border-line hover:border-ink text-ink-soft hover:text-ink transition"
                      >
                        {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSite(s)}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-full border border-rose-200 text-rose-700 hover:bg-rose-50 transition"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
