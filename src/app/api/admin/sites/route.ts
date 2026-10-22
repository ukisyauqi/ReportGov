import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { isAdminEmail } from '@/lib/admin-auth';
import { registeredSiteSchema } from '@/lib/validation';
import { normalizeRepoInput, normalizeSiteInput } from '@/lib/sites';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await auth();
  const email = session?.user?.email || '';
  if (!isAdminEmail(email)) return null;
  return email;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json(
      { error: 'Unauthorized: login dengan akun Google admin yang terdaftar' },
      { status: 401 }
    );
  }
  const sites = await prisma.registeredSite.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ sites });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json(
      { error: 'Unauthorized: login dengan akun Google admin yang terdaftar' },
      { status: 401 }
    );
  }
  try {
    const body = await req.json();
    const parsed = registeredSiteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validasi website gagal',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const siteUrl = normalizeSiteInput(parsed.data.siteUrl);
    const repoUrl = normalizeRepoInput(parsed.data.repoUrl);

    const existing = await prisma.registeredSite.findUnique({
      where: { siteUrl },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Website ${siteUrl} sudah terdaftar` },
        { status: 409 }
      );
    }

    const created = await prisma.registeredSite.create({
      data: {
        siteUrl,
        repoUrl,
        note: parsed.data.note || null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return NextResponse.json({ site: created }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/sites] Error:', err);
    return NextResponse.json(
      { error: 'Gagal menambah website', detail: String((err as Error)?.message || err) },
      { status: 500 }
    );
  }
}
