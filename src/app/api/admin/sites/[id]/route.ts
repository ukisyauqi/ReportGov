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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    // Partial update: validasi tiap field yang dikirim
    const parsed = registeredSiteSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validasi website gagal',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const data: Record<string, unknown> = {};
    if (parsed.data.siteUrl !== undefined)
      data.siteUrl = normalizeSiteInput(parsed.data.siteUrl);
    if (parsed.data.repoUrl !== undefined)
      data.repoUrl = normalizeRepoInput(parsed.data.repoUrl);
    if (parsed.data.note !== undefined) data.note = parsed.data.note || null;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada perubahan yang dikirim' },
        { status: 400 }
      );
    }

    const updated = await prisma.registeredSite.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ site: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'Alamat website tersebut sudah dipakai entri lain' },
        { status: 409 }
      );
    }
    if (code === 'P2025') {
      return NextResponse.json(
        { error: 'Data website tidak ditemukan' },
        { status: 404 }
      );
    }
    console.error(`[PATCH /api/admin/sites/${params.id}] Error:`, err);
    return NextResponse.json(
      { error: 'Gagal memperbarui website' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await prisma.registeredSite.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2025') {
      return NextResponse.json(
        { error: 'Data website tidak ditemukan' },
        { status: 404 }
      );
    }
    console.error(`[DELETE /api/admin/sites/${params.id}] Error:`, err);
    return NextResponse.json(
      { error: 'Gagal menghapus website' },
      { status: 500 }
    );
  }
}
