import React from "react";

const STATUS_STYLES: Record<
  string,
  { label: string; className: string; dotClass: string }
> = {
  baru: {
    label: "Baru Masuk",
    className: "bg-sky-50 text-sky-700 border-sky-200",
    dotClass: "bg-sky-500",
  },
  "diproses-ai": {
    label: "Dalam Proses",
    className: "bg-brand-50 text-brand-700 border-brand-200",
    dotClass: "bg-brand-600 animate-pulse-dot",
  },
  "pr-dibuat": {
    label: "PR Dibuat",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  selesai: {
    label: "Selesai",
    className: "bg-green-50 text-green-800 border-green-200",
    dotClass: "bg-green-600",
  },
  ditolak: {
    label: "Ditolak",
    className: "bg-stone-100 text-stone-600 border-stone-200",
    dotClass: "bg-stone-400",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_STYLES[status] || {
    label: status,
    className: "bg-cream-dark text-ink-soft border-line",
    dotClass: "bg-ink-faint",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}
