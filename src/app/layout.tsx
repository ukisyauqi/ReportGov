import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'LaporBug.go.id — Pelaporan & Auto-Fix AI Website Pemerintah',
  description:
    'Platform pelaporan masalah website pemerintah dengan perbaikan kode otomatis berbasis OpenCode Serve & AI Harness.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen flex flex-col">
        <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white shadow-sm group-hover:bg-red-500 transition">
                ID
              </div>
              <div>
                <span className="font-bold tracking-tight text-base sm:text-lg block leading-none">
                  LaporWeb<span className="text-red-400">.go.id</span>
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  OpenCode Serve Auto-Fix Harness
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-2 sm:gap-4 text-sm">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-slate-200 hover:text-white hover:bg-slate-800 transition"
              >
                Buat Laporan
              </Link>
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition"
              >
                Monitoring Admin
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Sistem Pelaporan Website Pemerintah + Auto-Fix AI Harness (OpenCode Serve)
            </span>
            <span className="font-mono text-slate-400">
              Next.js 14 • Prisma • @opencode/client (:3001)
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
