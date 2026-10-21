import React from "react";

/* ------------------------------------------------------------------ */
/* Logo LAPOR — red speech bubble with megaphone mark                */
/* ------------------------------------------------------------------ */
export function LaporLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-9 h-9 shrink-0">
        <div className="absolute inset-0 rounded-[10px] rounded-bl-[3px] bg-brand-600 shadow-pop" />
        <svg
          viewBox="0 0 24 24"
          className="absolute inset-0 m-auto w-5 h-5 text-white"
          fill="currentColor"
          aria-hidden
        >
          <path d="M3 10.5v3c0 .83.67 1.5 1.5 1.5H6v2.5c0 .28.22.5.5.5.13 0 .26-.05.35-.15l3.15-3.1c.09-.09.21-.15.35-.15H15c2.48 0 4.5-2.02 4.5-4.5S17.48 6 15 6H6c-1.66 0-3 1.34-3 3v1.5zm3.5-1.5H15c1.38 0 2.5 1.12 2.5 2.5S16.38 14 15 14H9.5l-2 2v-2H6.5v-5z" />
          <circle cx="10" cy="11.5" r="1" fill="#C1121F" />
          <circle cx="13" cy="11.5" r="1" fill="#C1121F" />
        </svg>
      </div>
      {!compact && (
        <div className="flex items-center gap-2.5">
          <span className="font-extrabold tracking-tight text-lg text-ink leading-none">
            LAPOR
          </span>
          <span className="hidden sm:block w-px h-7 bg-line" />
          <span className="hidden sm:block text-[10px] leading-tight text-ink-faint font-medium">
            Pengaduan Website
            <br />
            Pemerintah
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Eyebrow label — small uppercase kicker like "DETAIL MASALAH"       */
/* ------------------------------------------------------------------ */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Step progress — "1 dari 4" + thin track with red fill              */
/* ------------------------------------------------------------------ */
export function StepProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const pct = Math.min(100, Math.max(0, (current / total) * 100));
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-ink-faint">
        <strong className="text-brand-600 font-extrabold">{current}</strong>{" "}
        dari {total}
      </span>
      <div className="relative h-[5px] w-28 rounded-full bg-cream-dark overflow-visible">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-brand-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        <span
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-brand-600 border-2 border-cream transition-all duration-500"
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons in design language                                         */
/* ------------------------------------------------------------------ */
export function NextButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-2 rounded-full bg-brand-600 hover:bg-brand-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-sm font-bold pl-6 pr-5 py-2.5 shadow-pop transition active:scale-[0.98] ${props.className || ""}`}
    >
      {children}
      <span aria-hidden>→</span>
    </button>
  );
}

export function BackLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink transition"
    >
      <span aria-hidden>←</span> {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Decorative right-side visual panel — abstract red shapes + motif   */
/* per step, evoking the reference without external assets.           */
/* ------------------------------------------------------------------ */
const MOTIFS: Record<number, React.ReactNode> = {
  1: (
    <div className="relative animate-drift">
      <div className="w-44 h-32 rounded-xl bg-white/95 shadow-card border border-white overflow-hidden">
        <div className="h-6 bg-cream-dark flex items-center gap-1 px-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
          <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
          <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
        </div>
        <div className="p-3">
          <div className="w-16 h-2 rounded bg-ink mb-1.5" />
          <div className="w-24 h-2 rounded bg-stone-200 mb-1" />
          <div className="w-20 h-2 rounded bg-stone-200 mb-2.5" />
          <div className="flex gap-1.5">
            <div className="w-10 h-10 rounded bg-stone-300/70" />
            <div className="flex-1">
              <div className="w-full h-1.5 rounded bg-cream-dark mb-1" />
              <div className="w-4/5 h-1.5 rounded bg-cream-dark" />
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -left-8 top-6 rounded-lg bg-ink/85 text-white text-[10px] font-bold px-2.5 py-2 leading-tight backdrop-blur">
        Layanan Publik
        <br />
        Digital untuk
        <br />
        Semua
      </div>
    </div>
  ),
  2: (
    <div className="relative animate-drift">
      <div className="flex items-center gap-2 bg-white/95 rounded-full pl-4 pr-2 py-2 shadow-card border border-white w-60">
        <span className="text-[11px] font-mono text-ink-faint">https://</span>
        <span className="flex-1 h-4 rounded bg-cream-dark" />
        <span className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-extrabold">
          !
        </span>
      </div>
      <div className="absolute -bottom-7 -left-4 w-52 h-3 rounded-full bg-ink/10 blur-[2px]" />
    </div>
  ),
  3: (
    <div className="relative animate-drift">
      <div className="w-52 h-36 rounded-2xl bg-white/90 shadow-card border border-white p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-extrabold flex items-center justify-center">
            !
          </span>
          <div className="w-20 h-2 rounded bg-cream-dark" />
        </div>
        <div className="space-y-1.5">
          <div className="h-2 rounded bg-stone-200 w-full" />
          <div className="h-2 rounded bg-stone-200 w-11/12" />
          <div className="h-2 rounded bg-stone-200 w-4/6" />
        </div>
        <div className="mt-3 h-8 rounded-lg bg-cream-dark" />
      </div>
    </div>
  ),
  4: (
    <div className="relative animate-drift">
      <div className="flex items-end gap-0">
        <div className="flex gap-[3px] items-end h-24">
          {["h-14", "h-20", "h-24", "h-16", "h-20", "h-14"].map((h, i) => (
            <div key={i} className={`w-5 rounded-t bg-ink/25 ${h}`} />
          ))}
        </div>
        <div className="w-[3px] h-28 bg-ink/40 rounded ml-2" />
        <div className="w-14 h-9 rounded-r-md rounded-l-[2px] bg-white shadow-card border border-white/60 -ml-[1px] mb-[68px] overflow-hidden flex flex-col">
          <div className="flex-1 bg-brand-600" />
          <div className="flex-1 bg-white" />
        </div>
      </div>
    </div>
  ),
};

export function VisualPanel({ step }: { step: number }) {
  return (
    <div className="relative h-full min-h-[280px] lg:min-h-[420px] overflow-hidden rounded-2xl bg-[#F6EEE5]">
      {/* faint map dots backdrop */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.35]"
        aria-hidden
      >
        <defs>
          <pattern id="lapordots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="#E4D5C5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lapordots)" />
      </svg>

      {/* big organic red shape */}
      <div className="absolute -right-16 -top-10 w-[130%] h-[62%] bg-brand-600 [border-radius:0_0_0_64px] rotate-[-4deg] opacity-95" />
      <div className="absolute -right-10 bottom-[-8%] w-[85%] h-[42%] bg-brand-600 [border-radius:48px_0_0_0] rotate-[3deg]" />
      <div className="absolute left-6 bottom-8 w-24 h-24 rounded-full bg-white/50 blur-[1px]" />

      {/* building silhouette strip */}
      <div className="absolute bottom-0 left-0 right-0 h-20 opacity-20 grayscale flex items-end gap-1 px-6">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-ink rounded-t-sm"
            style={{ height: `${28 + ((i * 37) % 44)}px` }}
          />
        ))}
      </div>

      {/* centered motif */}
      <div className="absolute inset-0 flex items-center justify-center">
        {MOTIFS[step] || MOTIFS[1]}
      </div>

      {step === 4 && (
        <p className="absolute top-8 left-8 text-white font-bold text-lg leading-snug drop-shadow">
          Pastikan data
          <br />
          sudah benar.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thank-you red panel (success screen, right side)                   */
/* ------------------------------------------------------------------ */
export function ThanksPanel() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-brand-600 text-white min-h-[260px] lg:min-h-[320px] flex">
      <div className="absolute -left-10 top-0 w-40 h-full bg-white/10 [transform:skewX(-12deg)]" />
      <div className="absolute -left-2 top-0 w-10 h-full bg-cream/90 [transform:skewX(-12deg)]" />
      <div className="relative flex-1 p-8 flex flex-col justify-center pl-24">
        <p className="font-serif italic text-2xl leading-snug">
          Terima kasih
          <br />
          atas partisipasi Anda.
        </p>
        <p className="mt-3 text-[11px] leading-relaxed text-white/85 max-w-[220px]">
          Suara Anda untuk pelayanan publik yang lebih baik.
        </p>
      </div>
      <div className="relative w-2/5 hidden sm:flex items-end opacity-90 grayscale">
        <div className="w-full h-3/4 flex items-end justify-center gap-1 pb-0">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="w-4 bg-white/70 rounded-t"
              style={{ height: `${40 + ((i * 53) % 60)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
