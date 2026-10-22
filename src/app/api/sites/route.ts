import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Sumber kebenaran tunggal: tabel DB `RegisteredSite` (isActive=true).
// Response menjaga kompatibilitas lama: `sites: string[]`
// plus `detail` untuk kebutuhan admin / debugging.
export async function GET() {
  try {
    const rows = await prisma.registeredSite.findMany({
      where: { isActive: true },
      orderBy: { siteUrl: 'asc' },
      select: { siteUrl: true, repoUrl: true },
    });
    return NextResponse.json({
      sites: rows.map((r) => r.siteUrl),
      detail: rows,
    });
  } catch (err) {
    console.error('[GET /api/sites] Error:', err);
    return NextResponse.json({ sites: [], detail: [] });
  }
}
