import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

// Sumber kebenaran tunggal untuk daftar situs terdaftar:
// kunci-kunci dari config/site-to-repo.json
export async function GET() {
  try {
    const mapPath = path.join(process.cwd(), 'config', 'site-to-repo.json');
    const raw = await fs.readFile(mapPath, 'utf-8');
    const siteMap = JSON.parse(raw) as Record<string, string>;
    return NextResponse.json({ sites: Object.keys(siteMap) });
  } catch (err) {
    console.error('[GET /api/sites] Error:', err);
    return NextResponse.json({ sites: [] });
  }
}
