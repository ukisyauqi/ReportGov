'use client';

import React from 'react';
import { signIn } from 'next-auth/react';

export default function AdminLoginPage() {
  return (
    <div className="bg-white rounded-3xl border border-line shadow-card overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative overflow-hidden bg-ink text-white p-8 sm:p-10 flex flex-col justify-between min-h-[320px]">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-600/30 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-brand-600/20 blur-2xl"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 text-white/90 border border-white/15">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              Area admin — login required
            </span>
            <h1 className="text-[28px] sm:text-[32px] leading-[1.15] font-extrabold tracking-tight mt-4">
              Pantau semua laporan
              <br />
              dalam <span className="text-brand-200">satu dashboard.</span>
            </h1>
            <p className="text-[13px] text-white/70 mt-2 max-w-sm leading-relaxed">
              Dashboard monitoring read-only untuk admin terdaftar. Semua
              laporan diproses otomatis oleh AI harness.
            </p>
          </div>
          <ul className="relative mt-8 space-y-2.5 text-[12px] text-white/80">
            {[
              'Live feed aktivitas AI agent per laporan',
              'Prompt terkirim & Pull Request terverifikasi',
              'Filter status & pencarian URL / ID',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-400/15 border border-emerald-300/30 flex items-center justify-center shrink-0">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-3 h-3 text-emerald-300"
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
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Login panel */}
        <div className="p-8 sm:p-10 flex flex-col items-center justify-center text-center">
          <span className="w-14 h-14 rounded-2xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-7 h-7 text-brand-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
              <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <h2 className="text-xl font-extrabold tracking-tight text-ink mt-4">
            Login admin
          </h2>
          <p className="text-[12px] text-ink-faint mt-1 max-w-xs leading-relaxed">
            Masuk dengan akun Google yang terdaftar di allowlist untuk membuka
            dashboard monitoring.
          </p>
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/admin' })}
            className="mt-6 inline-flex w-full sm:w-auto items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-white border border-line hover:border-ink shadow-sm hover:shadow text-[13px] font-bold text-ink transition active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden>
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.5 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5l-.1.1-3.6 2.8v.1c2 4 6 6.6 10.5 6.6z"
              />
              <path
                fill="#FBBC05"
                d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.5-2.7-.1.1C.5 8.9 0 10.4 0 12s.5 3.1 1.5 4.5l3.7-2.1z"
              />
              <path
                fill="#EA4335"
                d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.6 1.5 6.9l3.7 2.9c.9-2.9 3.6-5.1 6.8-5.1z"
              />
            </svg>
            Login with Google
          </button>
          <p className="mt-4 text-[11px] text-ink-faint flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                d="M12 2l8 3v6c0 5-3.5 9.3-8 11-4.5-1.7-8-6-8-11V5z"
                strokeLinejoin="round"
              />
            </svg>
            Sesi aman via cookie httpOnly — hanya email allowlist yang lolos.
          </p>
        </div>
      </div>
    </div>
  );
}
