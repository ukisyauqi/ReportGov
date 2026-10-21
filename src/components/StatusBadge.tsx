import React from 'react';

const STATUS_STYLES: Record<
  string,
  { label: string; className: string; dotClass: string }
> = {
  baru: {
    label: 'Baru Masuk',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  'diproses-ai': {
    label: 'Diproses AI Harness',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500 animate-pulse',
  },
  'pr-dibuat': {
    label: 'PR Dibuat',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  selesai: {
    label: 'Selesai',
    className: 'bg-green-50 text-green-800 border-green-200',
    dotClass: 'bg-green-600',
  },
  ditolak: {
    label: 'Ditolak',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_STYLES[status] || {
    label: status,
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.className}`}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}
