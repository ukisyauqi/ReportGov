import fs from 'node:fs/promises';
import path from 'node:path';

export interface PromptReportData {
  id: string;
  judul: string;
  kategori: string;
  siteUrl: string;
  deskripsi: string;
}

const DEFAULT_TEMPLATE_PATH = path.join(
  process.cwd(),
  'harness',
  'opencode-prompt.template.md'
);

export async function buildPrompt(
  report: PromptReportData,
  evidence: string,
  templatePath: string = DEFAULT_TEMPLATE_PATH
): Promise<string> {
  const rawTemplate = await fs.readFile(templatePath, 'utf-8');
  const safeKategori = report.kategori.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const branch = `fix/${report.id}-${safeKategori}`;

  return rawTemplate
    .replaceAll('{{reportId}}', report.id.trim())
    .replaceAll('{{branch}}', branch)
    .replaceAll('{{judul}}', report.judul.trim())
    .replaceAll('{{kategori}}', report.kategori.trim())
    .replaceAll('{{siteUrl}}', report.siteUrl.trim())
    .replaceAll('{{deskripsi}}', report.deskripsi.trim())
    .replaceAll('{{evidence}}', evidence.trim() || 'Tidak ada bukti live tambahan.');
}
