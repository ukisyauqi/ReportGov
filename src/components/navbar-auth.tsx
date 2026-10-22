'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

export type ClientSessionStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated';

/**
 * Baca sesi langsung dari /api/auth/session tanpa React context.
 * Deterministik untuk navbar & gating halaman (tidak tergantung
 * SessionProvider).
 */
export function useClientSession(): {
  email: string | null;
  status: ClientSessionStatus;
} {
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<ClientSessionStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`session HTTP ${r.status}`);
        const data = (await r.json().catch(() => null)) as {
          user?: { email?: string };
        } | null;
        if (cancelled) return;
        const mail =
          typeof data?.user?.email === 'string' ? data.user.email : null;
        setEmail(mail);
        setStatus(mail ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!cancelled) {
          setEmail(null);
          setStatus('unauthenticated');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { email, status };
}

export function NavbarAuth() {
  const pathname = usePathname();
  const { email, status } = useClientSession();

  // Portal lapor publik (/, /lapor/[id], /login) bersih tanpa ikon akun.
  // Ikon akun hanya tampil di area admin.
  if (!pathname?.startsWith('/admin')) {
    return null;
  }

  if (status === 'loading') {
    return (
      <span className="w-8 h-8 rounded-full bg-cream-dark border border-line animate-pulse" />
    );
  }

  if (status === 'unauthenticated') {
    return (
      <Link
        href="/login"
        title="Login admin"
        aria-label="Login admin"
        className="w-8 h-8 rounded-full border border-line bg-white hover:border-ink text-ink-soft hover:text-ink flex items-center justify-center transition"
      >
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
        </svg>
      </Link>
    );
  }

  const initial = (email || 'A').trim().charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/admin"
        title={email || 'Dashboard admin'}
        aria-label="Dashboard admin"
        className="w-8 h-8 rounded-full bg-ink text-white text-[13px] font-extrabold flex items-center justify-center hover:bg-black transition"
      >
        {initial}
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/' })}
        title="Keluar"
        aria-label="Keluar"
        className="w-8 h-8 rounded-full border border-line bg-white hover:border-ink text-ink-soft hover:text-ink flex items-center justify-center transition"
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
            d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
