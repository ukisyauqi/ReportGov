import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createReportSchema } from '@/lib/validation';
import { processViaWrapper } from '@harness/process-via-wrapper';

export const dynamic = 'force-dynamic';

// In-memory rate limiter: Hanya menerima 1 laporan berhasil per IP selama 1 hari (24 jam)
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 jam
const RATE_LIMIT_MAX = 1; // 1 laporan sukses
const successfulSubmissionsByIp = new Map<string, number[]>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterHours?: number } {
  const now = Date.now();
  const timestamps = (successfulSubmissionsByIp.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  successfulSubmissionsByIp.set(ip, timestamps);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    const oldest = timestamps[0];
    const msRemaining = RATE_LIMIT_WINDOW_MS - (now - oldest);
    const retryAfterHours = Math.max(1, Math.ceil(msRemaining / (60 * 60 * 1000)));
    return { allowed: false, retryAfterHours };
  }

  return { allowed: true };
}

function recordSuccessfulSubmission(ip: string): void {
  const now = Date.now();
  const timestamps = (successfulSubmissionsByIp.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  timestamps.push(now);
  successfulSubmissionsByIp.set(ip, timestamps);
}

export async function POST(req: NextRequest) {
  try {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

    const limitCheck = checkRateLimit(ip);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Batas pengiriman laporan tercapai (maksimal 1 laporan per hari per IP). Anda telah berhasil mengirimkan laporan hari ini. Silakan coba lagi dalam ${limitCheck.retryAfterHours} jam untuk mencegah lonjakan dan spam.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validasi data laporan gagal',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Ekstrak judul dan kategori (kategori adalah pilihan judul)
    const match = data.deskripsi.match(/^\[Judul:\s*([^\]]+)\]/i);
    const judul = match
      ? match[1].trim()
      : typeof body.judul === 'string' && body.judul.trim()
        ? body.judul.trim()
        : 'Laporan Kendala Website';

    const KATEGORI_MAP: Record<string, string> = {
      'Website tidak bisa diakses': 'down',
      'Website lambat': 'lambat',
      'Konten tidak sesuai / tidak akurat': 'konten-salah',
      'Masalah lainnya': 'lainnya',
    };
    const kategori =
      KATEGORI_MAP[judul] ||
      (typeof body.kategori === 'string' && body.kategori.trim()
        ? body.kategori.trim()
        : 'lainnya');

    const report = await prisma.report.create({
      data: {
        siteUrl: data.siteUrl,
        kategori,
        judul,
        deskripsi: data.deskripsi,
        screenshot: data.screenshot || null,
        namaPelapor: data.namaPelapor || null,
        kontak: data.kontak || null,
        status: 'baru',
      },
    });

    // Catat bahwa IP ini berhasil mengirimkan 1 laporan valid (mencegah spam & lonjakan)
    recordSuccessfulSubmission(ip);

    // Trigger otomatis tanpa klik admin (async background execution)
    setImmediate(() => {
      processViaWrapper(report.id).catch((err) => {
        console.error(`[after] Gagal memproses report ${report.id}:`, err);
      });
    });

    return NextResponse.json(
      {
        id: report.id,
        status: report.status,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/reports] Error:', err);
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan pada server saat menyimpan laporan',
        detail: String((err as Error)?.message || err),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isPublicSummary = searchParams.get('public') === '1';

  if (isPublicSummary) {
    const recent = await prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        siteUrl: true,
        deskripsi: true,
        status: true,
        prUrl: true,
        sessionId: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ reports: recent });
  }

  const adminKeyHeader = req.headers.get('x-admin-key');
  const expectedAdminKey = process.env.ADMIN_KEY || 'admin-secret-go-id-2026';

  if (!adminKeyHeader || adminKeyHeader !== expectedAdminKey) {
    return NextResponse.json(
      { error: 'Unauthorized: Header x-admin-key tidak valid' },
      { status: 401 }
    );
  }

  const statusFilter = searchParams.get('status') || '';
  const searchQuery = searchParams.get('q') || '';

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;
  if (searchQuery) {
    where.OR = [
      { siteUrl: { contains: searchQuery } },
      { deskripsi: { contains: searchQuery } },
      { id: { contains: searchQuery } },
    ];
  }

  const reports = await prisma.report.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ reports });
}
