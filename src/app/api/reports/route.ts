import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createReportSchema } from '@/lib/validation';
import { processViaWrapper } from '@harness/process-via-wrapper';

export const dynamic = 'force-dynamic';

// In-memory rate limiter: maks 10 laporan per IP per jam
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const ipHits = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipHits.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  ipHits.set(ip, timestamps);
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          error:
            'Batas pengiriman laporan tercapai (maksimal 10 laporan per jam per IP). Silakan coba lagi nanti.',
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
    const report = await prisma.report.create({
      data: {
        siteUrl: data.siteUrl,
        deskripsi: data.deskripsi,
        screenshot: data.screenshot || null,
        namaPelapor: data.namaPelapor || null,
        kontak: data.kontak || null,
        status: 'baru',
      },
    });

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
      { error: 'Terjadi kesalahan pada server saat menyimpan laporan' },
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
