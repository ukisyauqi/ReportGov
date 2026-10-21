import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { LaporLogo } from "@/components/lapor-ui";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "ReportGov — Pengaduan Website Pemerintah",
  description:
    "Sampaikan keluhan Anda tentang website pemerintah. Bersama kita wujudkan layanan pemerintah yang lebih baik.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="min-h-screen flex flex-col font-sans">
        <header className="bg-cream/90 backdrop-blur border-b border-line sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[68px] flex items-center justify-between gap-4">
            <Link href="/">
              <LaporLogo />
            </Link>

            <div className="flex items-center gap-4 sm:gap-6">
              <p className="hidden md:block text-[10px] leading-tight text-right text-ink-faint">
                Bersama kita wujudkan
                <br />
                layanan pemerintah yang lebih baik.
              </p>
              <nav className="flex items-center gap-2 text-sm">
                <Link
                  href="/"
                  className="px-3 py-1.5 rounded-full text-ink-soft hover:text-ink hover:bg-cream-dark transition text-[13px] font-semibold"
                >
                  Buat Laporan
                </Link>
              </nav>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>

        <footer className="border-t border-line bg-cream py-5">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-ink-faint">
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-[5px] rounded-bl-[1px] bg-brand-600 inline-block" />
              ReportGov — Pengaduan Website Pemerintah
            </span>
            <span>Bersama kita wujudkan layanan pemerintah yang lebih baik.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
