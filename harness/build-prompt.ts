import fs from 'node:fs/promises';
import path from 'node:path';

export interface PromptReportData {
  id: string;
  siteUrl: string;
  deskripsi: string;
  repoUrl?: string;
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
  const branch = `fix/${report.id.trim()}`;
  const repoUrl = (report.repoUrl || '').trim();

  return rawTemplate
    .replaceAll('{{reportId}}', report.id.trim())
    .replaceAll('{{branch}}', branch)
    .replaceAll('{{repoUrl}}', repoUrl)
    .replaceAll('{{siteUrl}}', report.siteUrl.trim())
    .replaceAll('{{deskripsi}}', report.deskripsi.trim())
    .replaceAll('{{evidence}}', evidence.trim() || 'Tidak ada bukti live tambahan.');
}
