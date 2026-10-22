import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "../src/lib/prisma";
import { buildPrompt } from "./build-prompt";

const execFileAsync = promisify(execFile);

const WRAPPER_URL = process.env.WRAPPER_URL || "http://localhost:3001";
// Satu tugas end-to-end (fix + verifikasi + git + PR) bisa lama.
const AI_TASK_TIMEOUT_MS = Number(
  process.env.AI_TASK_TIMEOUT_MS || 15 * 60 * 1000,
);
const ACTIVITY_POLL_MS = 2500;
// Batas waktu Hierarki 2 agar log tidak stuck beku selamanya.
const LIVE_CHECK_TIMEOUT_MS = Number(
  process.env.LIVE_CHECK_TIMEOUT_MS || 60_000,
);
const VALIDATE_TIMEOUT_MS = Number(
  process.env.VALIDATE_TIMEOUT_MS || 180_000,
);
const WRAPPER_CALL_TIMEOUT_MS = Number(
  process.env.OPENCODE_WAIT_TIMEOUT_MS || 120_000,
);
// Single attempt: 1x runAiTask, tanpa kontinuasi / retry.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timeout setelah ${ms} ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Log = murni activity feed OpenCode, satu baris per aktivitas, tanpa timestamp.
async function appendActivityLine(
  reportId: string,
  line: string,
): Promise<void> {
  const clean = line.trim().slice(0, 500);
  if (!clean) return;
  const current = await prisma.report.findUnique({
    where: { id: reportId },
    select: { harnessLog: true },
  });
  const prev = current?.harnessLog || "";
  const updatedLog = prev ? `${prev}\n${clean}` : clean;
  await prisma.report.update({
    where: { id: reportId },
    data: { harnessLog: updatedLog.slice(-20000) },
  });
}

export async function resolveAllowedRepo(
  siteUrl: string,
): Promise<{ ok: true; repoUrl: string } | { ok: false; reason: string }> {
  // Sumber kebenaran tunggal: tabel DB `RegisteredSite` (isActive=true).
  // Fallback baca file config hanya bila DB kosong / tidak terjangkau (deprecated).
  try {
    try {
      const rows = await prisma.registeredSite.findMany({
        where: { isActive: true },
        select: { siteUrl: true, repoUrl: true },
      });
      if (rows.length > 0) {
        const { matchRepoForSiteUrl } = await import("../src/lib/sites");
        const matched = matchRepoForSiteUrl(siteUrl, rows);
        if (matched) return { ok: true, repoUrl: matched };
        try {
          const parsed = new URL(siteUrl);
          return {
            ok: false,
            reason: `URL situs (${parsed.origin}) belum terdaftar di database website terdaftar`,
          };
        } catch {
          return {
            ok: false,
            reason: `URL situs tidak valid / belum terdaftar di database website terdaftar`,
          };
        }
      }
      // DB kosong -> lanjut ke fallback file di bawah (migrasi awal).
    } catch (dbErr) {
      console.warn(
        "[resolveAllowedRepo] Gagal baca DB RegisteredSite, fallback ke file config:",
        dbErr,
      );
    }

    const mapPath = path.join(process.cwd(), "config", "site-to-repo.json");
    const allowlistPath = path.join(
      process.cwd(),
      "config",
      "allowed-repos.txt",
    );

    const [mapRaw, allowRaw] = await Promise.all([
      fs.readFile(mapPath, "utf-8"),
      fs.readFile(allowlistPath, "utf-8"),
    ]);

    const siteMap = JSON.parse(mapRaw) as Record<string, string>;
    const allowedRepos = new Set(
      allowRaw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#")),
    );

    const parsed = new URL(siteUrl);
    const origin = parsed.origin.toLowerCase();
    const normalizedFull = siteUrl.trim().replace(/\/+$/, "");
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
        reason: `URL situs (${origin}) belum terdaftar di database website terdaftar`,
      };
    }

    if (!allowedRepos.has(matchedRepo)) {
      return {
        ok: false,
        reason: `Repository (${matchedRepo}) tidak termasuk dalam daftar repo yang diizinkan`,
      };
    }

    return { ok: true, repoUrl: matchedRepo };
  } catch (err) {
    return {
      ok: false,
      reason: `Gagal membaca data website terdaftar: ${String((err as Error)?.message || err)}`,
    };
  }
}

async function runLiveCheck(
  reportId: string,
  siteUrl: string,
  workRoot: string,
): Promise<string> {
  const inner = async (): Promise<string> => {
    try {
      await fs.mkdir(workRoot, { recursive: true });
    } catch {
      // /tmp seharusnya selalu writable; abaikan bila gagal.
    }
    // Screenshot utama ke workRoot (/tmp, selalu writable).
    // Mirror ke public/artifacts bersifat best-effort (Cloud Run read-only).
    const tmpScreenshotPath = path.join(workRoot, `${reportId}-live.png`);
    let screenshotRelPath = `artifacts/${reportId}-live.png`;
    let screenshotFullPath = tmpScreenshotPath;
    try {
      const artifactsDir = path.join(process.cwd(), "public", "artifacts");
      await fs.mkdir(artifactsDir, { recursive: true });
      const candidate = path.join(process.cwd(), "public", screenshotRelPath);
      // Uji tulis: jika public/ read-only, tetap pakai /tmp.
      await fs.writeFile(candidate + ".writetest", "ok").catch(() => {
        throw new Error("public not writable");
      });
      await fs.rm(candidate + ".writetest", { force: true }).catch(() => {});
      screenshotFullPath = candidate;
    } catch {
      screenshotRelPath = `tmp-harness-${reportId}/${reportId}-live.png (hanya di /tmp, tidak dipublikasi)`;
      screenshotFullPath = tmpScreenshotPath;
    }
    const evidencePath = path.join(workRoot, "EVIDENCE.md");

    const lines: string[] = [];
    lines.push(`- **Target URL**: ${siteUrl}`);
    lines.push(`- **Waktu Pengecekan**: ${new Date().toISOString()}`);

    // 1. HTTP Fetch Check (timeout 10s + batasi body 500KB agar tidak hang)
    const startMs = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(siteUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "GovWebHarnessBot/1.0" },
        });
        const latency = Date.now() - startMs;
        // Batasi body agar target streaming tak membuat hang/OOM.
        const buf = Buffer.from(await res.arrayBuffer());
        const html = buf.slice(0, 500_000).toString("utf-8");
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1].trim() : "(tanpa <title>)";

        lines.push(`- **HTTP Status**: ${res.status} ${res.statusText}`);
        lines.push(`- **Waktu Respons**: ${latency} ms`);
        lines.push(`- **Judul Halaman**: ${pageTitle}`);
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      const latency = Date.now() - startMs;
      lines.push(
        `- **HTTP Status**: GAGAL DIAKSES (${String((err as Error)?.message || err)}) setelah ${latency} ms`,
      );
    }

    // 2. Playwright Live Check & Screenshot (wajib --no-sandbox di Docker/Cloud Run)
    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({
        headless: true,
        timeout: 30_000,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 1280, height: 800 },
        });
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });
        page.on("pageerror", (err) => {
          consoleErrors.push(err.message);
        });

        await page.goto(siteUrl, {
          timeout: 12_000,
          waitUntil: "domcontentloaded",
        });
        await page.screenshot({
          path: screenshotFullPath,
          fullPage: false,
          timeout: 15_000,
        });

        lines.push(
          `- **Screenshot Live**: \`${screenshotRelPath}\` (berhasil diambil)`,
        );
        if (consoleErrors.length > 0) {
          lines.push(`- **Console Errors (${consoleErrors.length})**:`);
          for (const ce of consoleErrors.slice(0, 5)) {
            lines.push(`  - \`${ce.slice(0, 200)}\``);
          }
        } else {
          lines.push(
            `- **Console Errors**: Tidak ditemukan error console saat load awal`,
          );
        }
        await page.close().catch(() => {});
      } finally {
        // Jangan hang selamanya saat close di container.
        await withTimeout(browser.close(), 10_000, "browser.close").catch(
          () => {},
        );
      }
    } catch (pwErr) {
      lines.push(
        `- **Playwright Check**: Dilewati / tidak dapat mengambil screenshot live (${String(
          (pwErr as Error)?.message || pwErr,
        ).slice(0, 180)})`,
      );
    }

    const evidenceContent = lines.join("\n");
    try {
      await fs.writeFile(evidencePath, evidenceContent, "utf-8");
    } catch {
      // workRoot tak writable: kembalikan evidence tanpa persist.
    }
    return evidenceContent;
  };

  // Timeout global: runLiveCheck tidak boleh menggantung selamanya.
  try {
    return await withTimeout(inner(), LIVE_CHECK_TIMEOUT_MS, "runLiveCheck");
  } catch (err) {
    return [
      `- **Target URL**: ${siteUrl}`,
      `- **Waktu Pengecekan**: ${new Date().toISOString()}`,
      `- **HTTP Status**: TIDAK DIKETAHUI (live check timeout/gagal: ${String((err as Error)?.message || err).slice(0, 180)})`,
      `- **Playwright Check**: Dilewati karena timeout live check`,
    ].join("\n");
  }
}

function parseOpenCodeModel(
  rawModel?: string,
): { providerID: string; id: string } | undefined {
  if (!rawModel || !rawModel.trim()) return undefined;
  const trimmed = rawModel.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.providerID && parsed.id) {
        return { providerID: String(parsed.providerID), id: String(parsed.id) };
      }
    } catch {
      return undefined;
    }
  }
  if (trimmed.includes("/")) {
    const [providerID, ...rest] = trimmed.split("/");
    const id = rest.join("/");
    if (providerID && id) return { providerID, id };
  }
  return undefined;
}

async function writeWorkdirGuardrails(workdir: string): Promise<void> {
  // AI mengerjakan SEMUA operasi git sendiri (clone, branch/commit/push/PR).
  // Pola berbahaya tetap di-deny: force-push, push ke main/master/tags,
  // merge PR, hapus repo/branch, reset --hard, clean paksa, ubah remote,
  // rm -rf, sudo.
  const guardrails: Record<string, unknown> = {
    $schema: "https://opencode.ai/config.json",
    permission: {
      read: {
        "*.env*": "deny",
        ".env*": "deny",
      },
      edit: {
        ".env*": "deny",
        "*.env*": "deny",
      },
      bash: {
        "git clone*": "allow",
        "git config*": "allow",
        "gh repo fork*": "allow",
        "gh repo view*": "allow",
        "git push --force*": "deny",
        "git push -f*": "deny",
        "git push origin main*": "deny",
        "git push origin master*": "deny",
        "git push *--tags*": "deny",
        "git push *--delete*": "deny",
        "git reset --hard*": "deny",
        "git branch -D*": "deny",
        "git branch --delete --force*": "deny",
        "git clean -f*": "deny",
        "git remote add*": "deny",
        "git remote set-url*": "deny",
        "git remote remove*": "deny",
        "git remote rename*": "deny",
        "gh pr merge*": "deny",
        "gh repo delete*": "deny",
        "gh repo archive*": "deny",
        "gh repo transfer*": "deny",
        "rm -rf *": "deny",
        "sudo *": "deny",
        "git checkout*": "allow",
        "git status*": "allow",
        "git diff*": "allow",
        "git log*": "allow",
        "git add*": "allow",
        "git commit*": "allow",
        "git push*": "allow",
        "git ls-remote*": "allow",
        "git rev-parse*": "allow",
        "git show*": "allow",
        "git symbolic-ref*": "allow",
        "gh pr create*": "allow",
        "gh pr view*": "allow",
        "gh pr list*": "allow",
        "gh pr status*": "allow",
        "gh pr diff*": "allow",
        "npm *": "allow",
        "npx *": "allow",
      },
    },
  };

  if (process.env.OPENCODE_MODEL?.trim()) {
    guardrails.model = process.env.OPENCODE_MODEL.trim();
  }

  await fs.writeFile(
    path.join(workdir, "opencode.json"),
    JSON.stringify(guardrails, null, 2),
    "utf-8",
  );
}

async function runShellCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 180_000,
): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, CI: "true" },
    });
    return { ok: true, output: `${stdout || ""}\n${stderr || ""}`.trim() };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const combined =
      `${e.stdout || ""}\n${e.stderr || ""}\n${e.message || ""}`.trim();
    return { ok: false, output: combined };
  }
}

function extractPrUrl(text: string): string {
  const m = text.match(/https:\/\/github\.com\/\S+\/pull\/\d+/);
  if (!m) return "";
  return m[0].replace(/[),.\]]+$/, "");
}

// Status terminal untuk kegagalan otomatisasi: bukan "ditolak" (laporan
// tidak layak), melainkan "gagal" (sistem mentok, butuh perhatian manusia).
// Selalu membersihkan workdir agar /tmp tidak menumpuk.
async function failReport(
  reportId: string,
  workRoot: string,
  reason: string,
): Promise<void> {
  await prisma.report.update({
    where: { id: reportId },
    data: { status: "gagal" },
  });
  await appendActivityLine(reportId, `[Gagal diproses] ${reason}`);
  await fs.rm(workRoot, { recursive: true, force: true }).catch(() => {});
}

// Fallback: AI kadang berhasil push + buka PR tapi tidak menulis URL PR
// pada balasannya. Cek langsung daftar PR open yang head branch-nya
// memuat ID laporan.
async function findPrByBranch(
  reportId: string,
  workdir: string,
): Promise<string> {
  const listRes = await runShellCommand(
    "gh",
    ["pr", "list", "--state", "open", "--json", "url,headRefName"],
    workdir,
  );
  if (!listRes.ok) return "";
  try {
    const start = listRes.output.indexOf("[");
    const end = listRes.output.lastIndexOf("]");
    if (start < 0 || end <= start) return "";
    const prs = JSON.parse(listRes.output.slice(start, end + 1)) as Array<{
      url?: string;
      headRefName?: string;
    }>;
    const match = prs.find(
      (p) =>
        typeof p.headRefName === "string" &&
        p.headRefName.includes(reportId) &&
        typeof p.url === "string",
    );
    return match?.url || "";
  } catch {
    return "";
  }
}

function tryParseJsonObject(output: string): Record<string, unknown> | null {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(output.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function createSession(workdir: string, retries = 3): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WRAPPER_CALL_TIMEOUT_MS);
    try {
      const response = await fetch(`${WRAPPER_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directory: workdir,
          agent: "build",
          model: parseOpenCodeModel(process.env.OPENCODE_MODEL),
        }),
        signal: controller.signal,
      });
      const data = (await response.json()) as {
        id?: string;
        sessionID?: string;
      };
      const sid = data?.id || data?.sessionID;
      if (!response.ok || !sid) {
        throw new Error(
          `Gagal membuat session AI: ${JSON.stringify(data).slice(0, 300)}`,
        );
      }
      return sid;
    } catch (err) {
      lastErr = err;
      const isAbort = (err as Error)?.name === "AbortError";
      console.warn(
        `[createSession] attempt ${attempt}/${retries} ke ${WRAPPER_URL} gagal: ${String((err as Error)?.message || err).slice(0, 200)}`,
      );
      if (attempt < retries) await sleep(attempt * 3000);
      else if (isAbort) {
        throw new Error(
          `Gagal membuat session AI: timeout ${WRAPPER_CALL_TIMEOUT_MS} ms ke wrapper ${WRAPPER_URL} (${retries}x percobaan)`,
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(
    `Gagal membuat session AI: fetch ke ${WRAPPER_URL} gagal (${retries}x percobaan): ${String((lastErr as Error)?.message || lastErr)}`,
  );
}

type ActivityItem = { key: string; line: string };

async function fetchActivity(sessionId: string): Promise<ActivityItem[]> {
  try {
    const res = await fetch(
      `${WRAPPER_URL}/sessions/${sessionId}/activity?limit=100`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { activity?: ActivityItem[] };
    return Array.isArray(data?.activity) ? data.activity : [];
  } catch {
    return [];
  }
}

// Dedup global per (report, session): runAiTask dipanggil 1x untuk validasi +
// 1x fix + hingga MAX_CONTINUATIONSx lanjutan dengan sessionId yang sama.
// Set `seen` harus bertahan antar panggilan, kalau tidak seluruh history
// activity akan di-log ulang setiap kontinuasi (kelihatan 3x duplikat).
const seenBySession = new Map<string, Set<string>>();

// Kirim prompt ke AI, lalu streaming activity feed-nya ke log selama AI bekerja.
async function runAiTask(
  reportId: string,
  sessionId: string,
  workdir: string,
  text: string,
): Promise<{ reply: string; error?: string }> {
  // Fetch wrapper wajib punya timeout sendiri; sebelumnya tanpa AbortSignal
  // sehingga wrapper hang = while(!settled) polling selamanya.
  const chatTimeoutMs = AI_TASK_TIMEOUT_MS + 60_000;
  const chatPromise = fetch(`${WRAPPER_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: text,
      sessionID: sessionId,
      directory: workdir,
      agent: "build",
      model: parseOpenCodeModel(process.env.OPENCODE_MODEL),
      timeoutMs: AI_TASK_TIMEOUT_MS,
    }),
    signal: AbortSignal.timeout(chatTimeoutMs),
  }).then(async (r) => ({
    ok: r.ok,
    data: (await r.json()) as Record<string, unknown>,
  }));

  let settled = false;
  chatPromise
    .then(() => {
      settled = true;
    })
    .catch(() => {
      settled = true;
    });

  const seenKey = `${reportId}:${sessionId}`;
  const existing = seenBySession.get(seenKey);
  const seen: Set<string> = existing ?? new Set<string>();
  if (!existing) seenBySession.set(seenKey, seen);
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

  // Batas polling agar tidak loop selamanya bila wrapper hang.
  const pollDeadline = Date.now() + chatTimeoutMs;
  while (!settled) {
    if (Date.now() > pollDeadline) break;
    await sleep(ACTIVITY_POLL_MS);
    await drain();
  }
  await drain();

  let outcome: { ok: boolean; data: Record<string, unknown> };
  try {
    outcome = await chatPromise;
  } catch (e) {
    return { reply: "", error: String((e as Error)?.message || e) };
  }
  if (!outcome.ok) {
    const d = outcome.data || {};
    return {
      reply: "",
      error:
        `Wrapper: ${String(d.error || "")} ${String(d.detail || d.hint || "")}`.trim(),
    };
  }
  return { reply: String(outcome.data?.reply || "") };
}

async function validateBugWithAi(
  report: { id: string; siteUrl: string; deskripsi: string },
  evidence: string,
  workRoot: string,
): Promise<{ isValid: boolean; reason: string }> {
  const cleanDesc = report.deskripsi
    .replace(/^\[(?:Judul|Kategori):[^\]]+\]\s*/i, "")
    .trim();
  const words = cleanDesc.split(/\s+/).filter(Boolean);

  // 1. Deteksi teks acak / keyboard smash tanpa arti
  const isGibberish =
    cleanDesc.length < 15 ||
    words.length < 2 ||
    (words.length <= 4 &&
      words.some((w) => w.length > 12 && !/[aeiou]{2,}/i.test(w)));

  if (isGibberish) {
    return {
      isValid: false,
      reason:
        "Deskripsi laporan berupa teks acak atau tidak mendeskripsikan kendala nyata.",
    };
  }

  // 2. Evaluasi AI via OpenCode session jika service wrapper tersedia
  try {
    const valSessionId = await createSession(workRoot);
    const inspectPrompt = `Kamu adalah Quality Assurance & Bug Inspector independen.
Tugasmu adalah menganalisis apakah laporan kendala website ini BENAR ADANYA (Valid Bug) atau TIDAK VALID (False Positive / Spam / Teks Acak / Masalah Tidak Terbukti).

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

    const res = await runAiTask(
      report.id,
      valSessionId,
      workRoot,
      inspectPrompt,
    );
    const parsed = tryParseJsonObject(res.reply);
    if (parsed && typeof parsed.isValid === "boolean") {
      return {
        isValid: parsed.isValid,
        reason: String(
          parsed.reason ||
            (parsed.isValid
              ? "Bug terkonfirmasi valid"
              : "Error tidak terbukti / false positive"),
        ),
      };
    }
  } catch (err) {
    console.warn(
      "[validateBugWithAi] Gagal memanggil AI inspector, menggunakan analisis heuristik:",
      err,
    );
  }

  // Fallback analisa heuristik jika AI inspector tidak dapat dihubungi:
  const hasLiveError =
    evidence.includes("GAGAL DIAKSES") ||
    /HTTP Status: [45]\d\d/.test(evidence) ||
    /Console Errors \(\d+\)/.test(evidence);

  if (hasLiveError) {
    return {
      isValid: true,
      reason:
        "Simulasi live mendeteksi anomali/error nyata pada halaman target.",
    };
  }

  const claimsDown =
    /tidak bisa diakses|website down|halaman tidak muncul|error 404|error 500/i.test(
      report.deskripsi,
    );
  const isLive200 = /HTTP Status: 200/i.test(evidence);

  if (claimsDown && isLive200) {
    return {
      isValid: false,
      reason:
        "Simulasi live menunjukkan website aktif normal (HTTP 200 OK) tanpa error, kendala down tidak terbukti.",
    };
  }

  return {
    isValid: true,
    reason:
      "Laporan memiliki deskripsi kendala yang dapat dianalisis pada basis kode.",
  };
}

export async function processViaWrapper(reportId: string): Promise<void> {
  const workRootFallback = path.join("/tmp", `harness-${reportId}`);
  try {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new Error(`Report ${reportId} tidak ditemukan`);
    }

    // Log fresh: hanya activity feed OpenCode.
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "diproses-ai", harnessLog: "" },
    });
    await appendActivityLine(
      reportId,
      `memulai pemrosesan laporan untuk ${report.siteUrl} ...`,
    );

    // =========================================================================
    // HIERARKI 1: Validasi URL terhadap data repositori sistem
    // =========================================================================
    await appendActivityLine(
      reportId,
      `[Hierarki 1] Memvalidasi URL target pada data sistem...`,
    );
    const resolved = await resolveAllowedRepo(report.siteUrl);
    if (!resolved.ok) {
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "ditolak" },
      });
      await appendActivityLine(
        reportId,
        `[Hierarki 1 Ditolak] ${resolved.reason}`,
      );
      return;
    }

    const repoUrl = resolved.repoUrl;
    await prisma.report.update({
      where: { id: reportId },
      data: { repoUrl },
    });
    await appendActivityLine(
      reportId,
      `[Hierarki 1 Lolos] URL terdaftar pada repositori (${repoUrl}). Melanjutkan ke Hierarki 2...`,
    );

    // =========================================================================
    // HIERARKI 2: Simulasi & Pemeriksaan AI atas Kebenaran Error
    // =========================================================================
    const workRoot = path.join("/tmp", `harness-${reportId}`);
    await appendActivityLine(
      reportId,
      `[Hierarki 2] Menjalankan simulasi browser & pemeriksaan live ke ${report.siteUrl}...`,
    );
    // runLiveCheck sudah punya timeout internal; withTimeout di sini sebagai
    // jaring pengaman agar log tidak stuck beku bila ada hang tak terduga.
    const evidence = await withTimeout(
      runLiveCheck(reportId, report.siteUrl, workRoot),
      LIVE_CHECK_TIMEOUT_MS + 10_000,
      "Hierarki 2 live check",
    );

    await appendActivityLine(
      reportId,
      `[Hierarki 2] Agen AI memeriksa apakah error benar adanya...`,
    );
    const validateTimeout = Math.max(
      VALIDATE_TIMEOUT_MS,
      AI_TASK_TIMEOUT_MS + 60_000,
    );
    const validation = await withTimeout(
      validateBugWithAi(report, evidence, workRoot),
      validateTimeout,
      "Hierarki 2 validasi AI",
    );

  if (!validation.isValid) {
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "ditolak" },
    });
    await appendActivityLine(
      reportId,
      `[Hierarki 2 Ditolak] Laporan tidak valid: ${validation.reason}`,
    );
    await fs.rm(workRoot, { recursive: true, force: true }).catch(() => {});
    return;
  }

  await appendActivityLine(
    reportId,
    `[Hierarki 2 Lolos] Error terbukti valid: ${validation.reason}`,
  );

  // =========================================================================
  // EKSEKUSI PERBAIKAN: Persiapan Kode, Patching oleh AI, Verifikasi & PR
  // =========================================================================
  await appendActivityLine(
    reportId,
    `Error layak diperbaiki. Mengunduh basis kode...`,
  );
  const workdir = path.join(workRoot, "repo");
  const prompt = await buildPrompt({ ...report, repoUrl }, evidence);
  await prisma.report.update({
    where: { id: reportId },
    data: { prompt },
  });

  // Clone dikerjakan AGEN (Langkah 0 di prompt), bukan oleh kode.
  // Siapkan workRoot kosong + guardrails sesi, lalu serahkan ke AI.
  await fs.rm(workdir, { recursive: true, force: true });
  await fs.mkdir(workRoot, { recursive: true });
  await writeWorkdirGuardrails(workRoot);
  await appendActivityLine(
    reportId,
    "menyiapkan agen AI (agen akan clone repo dulu, lalu perbaiki) ...",
  );

  // 3. Sisanya kerjaan AI: clone, fix, verifikasi, git, PR.
  let sessionId: string;
  try {
    sessionId = await createSession(workRoot);
  } catch (err) {
    await failReport(
      reportId,
      workRoot,
      `gagal membuat sesi AI: ${String((err as Error)?.message || err)}`,
    );
    return;
  }
  await prisma.report.update({
    where: { id: reportId },
    data: { sessionId },
  });

  const first = await runAiTask(reportId, sessionId, workRoot, prompt);
  if (first.error) {
    await failReport(reportId, workRoot, `AI berhenti: ${first.error}`);
    return;
  }
  if (/CLONE_FAILED:/i.test(first.reply)) {
    await failReport(
      reportId,
      workRoot,
      `agen gagal clone ${repoUrl}: ${first.reply.slice(0, 300)}`,
    );
    return;
  }
  // Sukses = PR benar ada di remote (ground truth), bukan sekadar AI menulis
  // `PR_URL:` di balasan. Single attempt: tanpa kontinuasi.
  // Repo hasil clone agen ada di ./repo; fallback ke workRoot bila beda.
  let repoDir = workdir;
  try {
    const st = await fs.stat(workdir);
    if (!st.isDirectory()) repoDir = workRoot;
  } catch {
    repoDir = workRoot;
  }
  const prUrl =
    extractPrUrl(first.reply) || (await findPrByBranch(reportId, repoDir));
  if (!prUrl) {
    await failReport(reportId, workRoot, "AI selesai tanpa memberikan URL PR.");
    return;
  }

  // 4. Verifikasi read-only + catat. Bukan operasi git — hanya membaca status PR.
  const viewRes = await runShellCommand(
    "gh",
    ["pr", "view", prUrl, "--json", "url,state"],
    repoDir,
  );
  const viewed = tryParseJsonObject(viewRes.output);
  if (!viewRes.ok || !viewed || typeof viewed.url !== "string") {
    await failReport(
      reportId,
      workRoot,
      `URL PR tidak terverifikasi: ${prUrl}`,
    );
    return;
  }

  await prisma.report.update({
    where: { id: reportId },
    data: {
      prUrl,
      status: "pr-dibuat",
    },
  });

  await appendActivityLine(reportId, `PR: ${prUrl}`);
  await fs.rm(workRoot, { recursive: true, force: true }).catch(() => {});
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    // Pertahankan perilaku lama untuk report hilang: tetap throw agar CLI exit 1.
    if (msg.includes("tidak ditemukan")) throw err;
    // Jaring pengaman terakhir: exception tak terduga (mis. mkdir public/
    // EROFS, Playwright throw, DB sesaat down) tidak boleh membuat log stuck
    // di "Menjalankan simulasi..." selamanya. Tandai gagal agar terlihat.
    console.error(`[processViaWrapper] Unhandled untuk ${reportId}:`, err);
    try {
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "gagal" },
      });
    } catch {
      // DB tidak terjangkau: tidak ada yang bisa dilakukan selain log server.
    }
    try {
      await appendActivityLine(
        reportId,
        `[Gagal diproses] ${String((err as Error)?.message || err).slice(0, 300)}`,
      );
    } catch {
      // Abaikan agar tidak throw berlapis.
    }
    await fs
      .rm(workRootFallback, { recursive: true, force: true })
      .catch(() => {});
  }
}

// CLI runner: `npm run harness -- --reportId=<id>`
const isMainModule =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].includes("process-via-wrapper");

if (isMainModule) {
  const arg = process.argv.find((a) => a.startsWith("--reportId="));
  const reportId = arg ? arg.split("=")[1] : process.argv[2];
  if (!reportId) {
    console.error("Gunakan: npm run harness -- --reportId=<ID_REPORT>");
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
