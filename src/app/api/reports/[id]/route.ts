import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const report = await prisma.report.findUnique({
      where: { id: params.id },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Laporan tidak ditemukan' },
        { status: 404 }
      );
    }

    // Jangan ekspos kontak pribadi pelapor di endpoint publik
    const { kontak: _kontak, ...publicReport } = report;

    return NextResponse.json(publicReport);
  } catch (err) {
    console.error(`[GET /api/reports/${params.id}] Error:`, err);
    return NextResponse.json(
      { error: 'Gagal mengambil detail laporan' },
      { status: 500 }
    );
  }
}
