import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createReportSchema } from '@/lib/validation';
import { processViaWrapper } from '@harness/process-via-wrapper';
import { auth } from '@/auth';
import { isAdminEmail } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
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
      'Bug / Fitur tidak jalan': 'bug-fitur',
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

  const session = await auth();
  const sessionEmail = session?.user?.email || '';

  if (!isAdminEmail(sessionEmail)) {
    return NextResponse.json(
      { error: 'Unauthorized: login dengan akun Google admin yang terdaftar' },
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
