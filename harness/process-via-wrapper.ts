import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prisma } from '../src/lib/prisma';
import { buildPrompt } from './build-prompt';

const execFileAsync = promisify(execFile);

const WRAPPER_URL = process.env.WRAPPER_URL || 'http://localhost:3001';
// Satu tugas end-to-end (fix + verifikasi + git + PR) bisa lama.
const AI_TASK_TIMEOUT_MS = Number(process.env.AI_TASK_TIMEOUT_MS || 15 * 60 * 1000);
const ACTIVITY_POLL_MS = 2500;
const MAX_CONTINUATIONS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Log = murni activity feed OpenCode, satu baris per aktivitas, tanpa timestamp.
async function appendActivityLine(reportId: string, line: string): Promise<void> {
  const clean = line.trim().slice(0, 500);
  if (!clean) return;
  const current = await prisma.report.findUnique({
    where: { id: reportId },
    select: { harnessLog: true },
  });
  const prev = current?.harnessLog || '';
  const updatedLog = prev ? `${prev}\n${clean}` : clean;
  await prisma.report.update({
    where: { id: reportId },
    data: { harnessLog: updatedLog.slice(-20000) },
  });
}

export async function resolveAllowedRepo(
  siteUrl: string
): Promise<{ ok: true; repoUrl: string } | { ok: false; reason: string }> {
  try {
    const mapPath = path.join(process.cwd(), 'config', 'site-to-repo.json');
    const allowlistPath = path.join(process.cwd(), 'config', 'allowed-repos.txt');

    const [mapRaw, allowRaw] = await Promise.all([
      fs.readFile(mapPath, 'utf-8'),
      fs.readFile(allowlistPath, 'utf-8'),
    ]);

    const siteMap = JSON.parse(mapRaw) as Record<string, string>;
    const allowedRepos = new Set(
      allowRaw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'))
    );

    const parsed = new URL(siteUrl);
    const origin = parsed.origin.toLowerCase();
    const normalizedFull = siteUrl.trim().replace(/\/+$/, '');
    const hostname = parsed.hostname.toLowerCase();

    let matchedRepo: string | undefined =
      siteMap[normalizedFull] || siteMap[origin] || siteMap[hostname];

    if (!matchedRepo) {
      for (const [key, repo] of Object.entries(siteMap)) {
        try {
          const kUrl = new URL(key);
          if (kUrl.hostname.toLowerCase() === hostname) {
            matchedRepo = repo;
            break;
          }
        } catch {
          if (key.toLowerCase() === hostname) {
            matchedRepo = repo;
            break;
          }
        }
      }
    }

    if (!matchedRepo) {
      return {
        ok: false,
        reason: `URL situs (${origin}) belum terdaftar di config/site-to-repo.json`,
      };
    }

    if (!allowedRepos.has(matchedRepo)) {
      return {
        ok: false,
        reason: `Repository (${matchedRepo}) tidak termasuk dalam daftar config/allowed-repos.txt`,
      };
    }

    return { ok: true, repoUrl: matchedRepo };
  } catch (err) {
    return {
      ok: false,
      reason: `Gagal membaca konfigurasi mapping repo: ${String((err as Error)?.message || err)}`,
    };
  }
}

async function runLiveCheck(
  reportId: string,
  siteUrl: string,
  workRoot: string
): Promise<string> {
  await fs.mkdir(workRoot, { recursive: true });
  const artifactsDir = path.join(process.cwd(), 'public', 'artifacts');
  await fs.mkdir(artifactsDir, { recursive: true });

  const screenshotRelPath = `artifacts/${reportId}-live.png`;
  const screenshotFullPath = path.join(process.cwd(), 'public', screenshotRelPath);
  const evidencePath = path.join(workRoot, 'EVIDENCE.md');

  const lines: string[] = [];
  lines.push(`- **Target URL**: ${siteUrl}`);
  lines.push(`- **Waktu Pengecekan**: ${new Date().toISOString()}`);

  // 1. HTTP Fetch Check
  const startMs = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(siteUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'GovWebHarnessBot/1.0' },
    });
    clearTimeout(timer);
    const latency = Date.now() - startMs;
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : '(tanpa <title>)';

    lines.push(`- **HTTP Status**: ${res.status} ${res.statusText}`);
    lines.push(`- **Waktu Respons**: ${latency} ms`);
    lines.push(`- **Judul Halaman**: ${pageTitle}`);
  } catch (err) {
    const latency = Date.now() - startMs;
    lines.push(
      `- **HTTP Status**: GAGAL DIAKSES (${String((err as Error)?.message || err)}) setelah ${latency} ms`
    );
  }

  // 2. Playwright Live Check & Screenshot
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      await page.goto(siteUrl, { timeout: 12_000, waitUntil: 'domcontentloaded' });
      await page.screenshot({ path: screenshotFullPath, fullPage: false });

      lines.push(`- **Screenshot Live**: \`${screenshotRelPath}\` (berhasil diambil)`);
      if (consoleErrors.length > 0) {
        lines.push(`- **Console Errors (${consoleErrors.length})**:`);
        for (const ce of consoleErrors.slice(0, 5)) {
          lines.push(`  - \`${ce.slice(0, 200)}\``);
        }
      } else {
        lines.push(`- **Console Errors**: Tidak ditemukan error console saat load awal`);
      }
    } finally {
      await browser.close();
    }
  } catch (pwErr) {
    lines.push(
      `- **Playwright Check**: Dilewati / tidak dapat mengambil screenshot live (${String(
        (pwErr as Error)?.message || pwErr
      ).slice(0, 180)})`
    );
  }

  const evidenceContent = lines.join('\n');
  await fs.writeFile(evidencePath, evidenceContent, 'utf-8');
  return evidenceContent;
}

function parseOpenCodeModel(
  rawModel?: string
): { providerID: string; id: string } | undefined {
  if (!rawModel || !rawModel.trim()) return undefined;
  const trimmed = rawModel.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.providerID && parsed.id) {
        return { providerID: String(parsed.providerID), id: String(parsed.id) };
      }
    } catch {
      return undefined;
    }
  }
  if (trimmed.includes('/')) {
    const [providerID, ...rest] = trimmed.split('/');
    const id = rest.join('/');
    if (providerID && id) return { providerID, id };
  }
  return undefined;
}

async function writeWorkdirGuardrails(workdir: string): Promise<void> {
  // AI mengerjakan SEMUA operasi git sendiri (branch/commit/push/PR).
  // Pola berbahaya tetap di-deny: force-push, push ke main/master/tags,
  // merge PR, hapus repo/branch, reset --hard, clean paksa, ubah remote,
  // rm -rf, sudo.
  const guardrails: Record<string, unknown> = {
    $schema: 'https://opencode.ai/config.json',
    permission: {
      read: {
        '*.env*': 'deny',
        '.env*': 'deny',
      },
      edit: {
        '.env*': 'deny',
        '*.env*': 'deny',
      },
      bash: {
        'git push --force*': 'deny',
        'git push -f*': 'deny',
        'git push origin main*': 'deny',
        'git push origin master*': 'deny',
        'git push *--tags*': 'deny',
        'git push *--delete*': 'deny',
        'git reset --hard*': 'deny',
        'git branch -D*': 'deny',
        'git branch --delete --force*': 'deny',
        'git clean -f*': 'deny',
        'git remote add*': 'deny',
        'git remote set-url*': 'deny',
        'git remote remove*': 'deny',
        'git remote rename*': 'deny',
        'gh pr merge*': 'deny',
        'gh repo delete*': 'deny',
        'gh repo archive*': 'deny',
        'gh repo transfer*': 'deny',
        'rm -rf *': 'deny',
        'sudo *': 'deny',
        'git checkout*': 'allow',
        'git status*': 'allow',
        'git diff*': 'allow',
        'git log*': 'allow',
        'git add*': 'allow',
        'git commit*': 'allow',
        'git push*': 'allow',
        'git ls-remote*': 'allow',
        'git rev-parse*': 'allow',
        'git show*': 'allow',
        'git symbolic-ref*': 'allow',
        'gh pr create*': 'allow',
        'gh pr view*': 'allow',
        'gh pr list*': 'allow',
        'gh pr status*': 'allow',
        'gh pr diff*': 'allow',
        'npm *': 'allow',
        'npx *': 'allow',
      },
    },
  };

  if (process.env.OPENCODE_MODEL?.trim()) {
    guardrails.model = process.env.OPENCODE_MODEL.trim();
  }

  await fs.writeFile(
    path.join(workdir, 'opencode.json'),
    JSON.stringify(guardrails, null, 2),
    'utf-8'
  );
}

async function runShellCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 180_000
): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, CI: 'true' },
    });
    return { ok: true, output: `${stdout || ''}\n${stderr || ''}`.trim() };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const combined = `${e.stdout || ''}\n${e.stderr || ''}\n${e.message || ''}`.trim();
    return { ok: false, output: combined };
  }
}

async function ensureGitIdentity(workdir: string, reportId: string): Promise<void> {
  const nameRes = await runShellCommand('git', ['config', '--get', 'user.name'], workdir);
  if (!nameRes.ok || !nameRes.output.trim()) {
    await runShellCommand('git', ['config', 'user.name', 'gov-harness-bot'], workdir);
  }
  const emailRes = await runShellCommand('git', ['config', '--get', 'user.email'], workdir);
  if (!emailRes.ok || !emailRes.output.trim()) {
    await runShellCommand(
      'git',
      ['config', 'user.email', `harness-${reportId}@localhost`],
      workdir
    );
  }
}

function extractPrUrl(text: string): string {
  const m = text.match(/https:\/\/github\.com\/\S+\/pull\/\d+/);
  if (!m) return '';
  return m[0].replace(/[),.\]]+$/, '');
}

function tryParseJsonObject(output: string): Record<string, unknown> | null {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(output.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function createSession(workdir: string): Promise<string> {
  const response = await fetch(`${WRAPPER_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directory: workdir,
      agent: 'build',
      model: parseOpenCodeModel(process.env.OPENCODE_MODEL),
    }),
  });
  const data = (await response.json()) as { id?: string; sessionID?: string };
  const sid = data?.id || data?.sessionID;
  if (!response.ok || !sid) {
    throw new Error(`Gagal membuat session AI: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return sid;
}

type ActivityItem = { key: string; line: string };

async function fetchActivity(sessionId: string): Promise<ActivityItem[]> {
  const res = await fetch(`${WRAPPER_URL}/sessions/${sessionId}/activity?limit=100`);
  if (!res.ok) return [];
  const data = (await res.json()) as { activity?: ActivityItem[] };
  return Array.isArray(data?.activity) ? data.activity : [];
}

// Kirim prompt ke AI, lalu streaming activity feed-nya ke log selama AI bekerja.
async function runAiTask(
  reportId: string,
  sessionId: string,
  workdir: string,
  text: string
): Promise<{ reply: string; error?: string }> {
  const chatPromise = fetch(`${WRAPPER_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: text,
      sessionID: sessionId,
      directory: workdir,
      agent: 'build',
      model: parseOpenCodeModel(process.env.OPENCODE_MODEL),
      timeoutMs: AI_TASK_TIMEOUT_MS,
    }),
  }).then(async (r) => ({ ok: r.ok, data: (await r.json()) as Record<string, unknown> }));

  let settled = false;
  chatPromise
    .then(() => {
      settled = true;
    })
    .catch(() => {
      settled = true;
    });

  const seen = new Set<string>();
  const drain = async () => {
    try {
      for (const item of await fetchActivity(sessionId)) {
        if (!item?.key || seen.has(item.key)) continue;
        seen.add(item.key);
        await appendActivityLine(reportId, item.line);
      }
    } catch {
      // abaikan, coba lagi di poll berikutnya
    }
  };

  while (!settled) {
    await sleep(ACTIVITY_POLL_MS);
    await drain();
  }
  await drain();

  let outcome: { ok: boolean; data: Record<string, unknown> };
  try {
    outcome = await chatPromise;
  } catch (e) {
    return { reply: '', error: String((e as Error)?.message || e) };
  }
  if (!outcome.ok) {
    const d = outcome.data || {};
    return { reply: '', error: `Wrapper: ${String(d.error || '')} ${String(d.detail || d.hint || '')}`.trim() };
  }
  return { reply: String(outcome.data?.reply || '') };
}

async function validateBugWithAi(
  report: { id: string; siteUrl: string; deskripsi: string },
  evidence: string,
  workRoot: string
): Promise<{ isValid: boolean; reason: string }> {
  const cleanDesc = report.deskripsi.replace(/^\[(?:Judul|Kategori):[^\]]+\]\s*/i, '').trim();
  const words = cleanDesc.split(/\s+/).filter(Boolean);

  // 1. Deteksi teks acak / keyboard smash tanpa arti
  const isGibberish =
    cleanDesc.length < 15 ||
    words.length < 2 ||
    (words.length <= 4 && words.some((w) => w.length > 12 && !/[aeiou]{2,}/i.test(w)));

  if (isGibberish) {
    return {
      isValid: false,
      reason: 'Deskripsi laporan berupa teks acak atau tidak mendeskripsikan kendala nyata.',
    };
  }

  // 2. Evaluasi AI via OpenCode session jika service wrapper tersedia
  try {
    const valSessionId = await createSession(workRoot);
    const inspectPrompt = `Kamu adalah Quality Assurance & Bug Inspector independen.
Tugasmu adalah menganalisis apakah laporan kendala website pemerintah ini BENAR ADANYA (Valid Bug) atau TIDAK VALID (False Positive / Spam / Teks Acak / Masalah Tidak Terbukti).

Informasi Laporan:
- Target URL: ${report.siteUrl}
- Isi Laporan:
${report.deskripsi}

Hasil Simulasi Browser & Bukti Live:
${evidence}

Kriteria Penilaian:
1. Nyatakan "isValid": false jika:
   - Isi laporan adalah teks acak/keyboard mash (contoh: "asdakmnak akdkamkdamdka"), kata tanpa makna, atau keluhan spam.
   - Pelapor mengklaim website down atau error fatal, padahal simulasi live membuktikan website berstatus HTTP 200 OK, responsif, dan tidak ada console error/broken page.
   - Laporan tidak dapat direplikasi atau tidak ada bukti masalah yang sesuai.
2. Nyatakan "isValid": true jika:
   - Terdapat error nyata saat simulasi live (HTTP 4xx/5xx, koneksi putus, timeout, broken link, atau JavaScript console error).
   - Laporan menjelaskan bug fungsional/tampilan yang logis dan relevan untuk diperiksa pada repositori kode.

Format balasan WAJIB berupa JSON saja:
{
  "isValid": true atau false,
  "reason": "Alasan singkat (1-2 kalimat bahasa Indonesia) mengapa laporan ini valid atau ditolak"
}`;

    const res = await runAiTask(report.id, valSessionId, workRoot, inspectPrompt);
    const parsed = tryParseJsonObject(res.reply);
    if (parsed && typeof parsed.isValid === 'boolean') {
      return {
        isValid: parsed.isValid,
        reason: String(
          parsed.reason ||
            (parsed.isValid ? 'Bug terkonfirmasi valid' : 'Error tidak terbukti / false positive')
        ),
      };
    }
  } catch (err) {
    console.warn('[validateBugWithAi] Gagal memanggil AI inspector, menggunakan analisis heuristik:', err);
  }

  // Fallback analisa heuristik jika AI inspector tidak dapat dihubungi:
  const hasLiveError =
    evidence.includes('GAGAL DIAKSES') ||
    /HTTP Status: [45]\d\d/.test(evidence) ||
    /Console Errors \(\d+\)/.test(evidence);

  if (hasLiveError) {
    return {
      isValid: true,
      reason: 'Simulasi live mendeteksi anomali/error nyata pada halaman target.',
    };
  }

  const claimsDown =
    /tidak bisa diakses|website down|halaman tidak muncul|error 404|error 500/i.test(report.deskripsi);
  const isLive200 = /HTTP Status: 200/i.test(evidence);

  if (claimsDown && isLive200) {
    return {
      isValid: false,
      reason: 'Simulasi live menunjukkan website aktif normal (HTTP 200 OK) tanpa error, kendala down tidak terbukti.',
    };
  }

  return {
    isValid: true,
    reason: 'Laporan memiliki deskripsi kendala yang dapat dianalisis pada basis kode.',
  };
}

export async function processViaWrapper(reportId: string): Promise<void> {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new Error(`Report ${reportId} tidak ditemukan`);
  }

  // Log fresh: hanya activity feed OpenCode.
  await prisma.report.update({
    where: { id: reportId },
    data: { status: 'diproses-ai', harnessLog: '' },
  });
  await appendActivityLine(reportId, `memulai pemrosesan laporan untuk ${report.siteUrl} ...`);

  // =========================================================================
  // HIERARKI 1: Validasi URL terhadap data repositori sistem
  // =========================================================================
  await appendActivityLine(reportId, `[Hierarki 1] Memvalidasi URL target pada data sistem...`);
  const resolved = await resolveAllowedRepo(report.siteUrl);
  if (!resolved.ok) {
    await prisma.report.update({
      where: { id: reportId },
      data: { status: 'ditolak' },
    });
    await appendActivityLine(reportId, `[Hierarki 1 Ditolak] ${resolved.reason}`);
    return;
  }

  const repoUrl = resolved.repoUrl;
  await prisma.report.update({
    where: { id: reportId },
    data: { repoUrl },
  });
  await appendActivityLine(
    reportId,
    `[Hierarki 1 Lolos] URL terdaftar pada repositori (${repoUrl}). Melanjutkan ke Hierarki 2...`
  );

  // =========================================================================
  // HIERARKI 2: Simulasi & Pemeriksaan AI atas Kebenaran Error
  // =========================================================================
  const workRoot = path.join('/tmp', `harness-${reportId}`);
  await appendActivityLine(
    reportId,
    `[Hierarki 2] Menjalankan simulasi browser & pemeriksaan live ke ${report.siteUrl}...`
  );
  const evidence = await runLiveCheck(reportId, report.siteUrl, workRoot);

  await appendActivityLine(
    reportId,
    `[Hierarki 2] Agen AI memeriksa apakah error benar adanya...`
  );
  const validation = await validateBugWithAi(report, evidence, workRoot);

  if (!validation.isValid) {
    await prisma.report.update({
      where: { id: reportId },
      data: { status: 'ditolak' },
    });
    await appendActivityLine(
      reportId,
      `[Hierarki 2 Ditolak] Laporan tidak valid: ${validation.reason}`
    );
    await fs.rm(workRoot, { recursive: true, force: true }).catch(() => {});
    return;
  }

  await appendActivityLine(
    reportId,
    `[Hierarki 2 Lolos] Error terbukti valid: ${validation.reason}`
  );

  // =========================================================================
  // EKSEKUSI PERBAIKAN: Persiapan Kode, Patching oleh AI, Verifikasi & PR
  // =========================================================================
  await appendActivityLine(reportId, `Error layak diperbaiki. Mengunduh basis kode...`);
  const workdir = path.join(workRoot, 'repo');
  const prompt = await buildPrompt(report, evidence);
  await prisma.report.update({
    where: { id: reportId },
    data: { prompt },
  });

  await fs.rm(workdir, { recursive: true, force: true });
  await fs.mkdir(workRoot, { recursive: true });
  const cloneRes = await runShellCommand('git', ['clone', '--depth', '1', repoUrl, workdir], workRoot);
  if (!cloneRes.ok) {
    await appendActivityLine(reportId, `gagal clone ${repoUrl}`);
    return;
  }
  await ensureGitIdentity(workdir, reportId);
  await writeWorkdirGuardrails(workdir);
  await appendActivityLine(reportId, 'repo siap, menyerahkan perbaikan ke AI ...');

  // 3. Sisanya kerjaan AI: fix, verifikasi, git, PR.
  let sessionId: string;
  try {
    sessionId = await createSession(workdir);
  } catch (err) {
    await appendActivityLine(reportId, `gagal membuat sesi AI: ${String((err as Error)?.message || err)}`);
    return;
  }
  await prisma.report.update({
    where: { id: reportId },
    data: { sessionId },
  });

  const first = await runAiTask(reportId, sessionId, workdir, prompt);
  if (first.error) {
    await appendActivityLine(reportId, `AI berhenti: ${first.error}`);
    return;
  }
  let prUrl = extractPrUrl(first.reply);
  for (let n = 1; n <= MAX_CONTINUATIONS && !prUrl; n++) {
    const cont = await runAiTask(
      reportId,
      sessionId,
      workdir,
      'Lanjutkan pekerjaan sampai Pull Request terbuat, lalu balas dengan baris `PR_URL: <url>`. ' +
        'Jika ada yang menghalangimu dan tidak bisa kamu atasi sendiri, jelaskan singkat apa penghalangnya lalu berhenti.'
    );
    if (cont.error) {
      await appendActivityLine(reportId, `AI berhenti: ${cont.error}`);
      return;
    }
    prUrl = extractPrUrl(cont.reply);
  }
  if (!prUrl) {
    await appendActivityLine(reportId, 'AI selesai tanpa memberikan URL PR.');
    return;
  }

  // 4. Verifikasi read-only + catat. Bukan operasi git — hanya membaca status PR.
  const viewRes = await runShellCommand('gh', ['pr', 'view', prUrl, '--json', 'url,state'], workdir);
  const viewed = tryParseJsonObject(viewRes.output);
  if (!viewRes.ok || !viewed || typeof viewed.url !== 'string') {
    await appendActivityLine(reportId, `URL PR tidak terverifikasi: ${prUrl}`);
    return;
  }

  await prisma.report.update({
    where: { id: reportId },
    data: {
      prUrl,
      status: 'pr-dibuat',
    },
  });

  await appendActivityLine(reportId, `PR: ${prUrl}`);
  await fs.rm(workRoot, { recursive: true, force: true }).catch(() => {});
}

// CLI runner: `npm run harness -- --reportId=<id>`
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].includes('process-via-wrapper');

if (isMainModule) {
  const arg = process.argv.find((a) => a.startsWith('--reportId='));
  const reportId = arg ? arg.split('=')[1] : process.argv[2];
  if (!reportId) {
    console.error('Gunakan: npm run harness -- --reportId=<ID_REPORT>');
    process.exit(1);
  }
  processViaWrapper(reportId)
    .then(() => {
      console.log(`Selesai memproses report ${reportId}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`Gagal memproses report ${reportId}:`, err);
      process.exit(1);
    });
}
