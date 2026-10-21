import 'dotenv/config';
import { OpenCode } from '@opencode/client';
import { Service } from '@opencode/client/service';

let cached = null;

function headersFromEnv() {
  // OPENCODE_URL=http://localhost:4096
  // Optional: OPENCODE_USERNAME / OPENCODE_PASSWORD (basic auth dari `opencode serve`)
  // atau OPENCODE_TOKEN -> Authorization: Bearer ...
  const { OPENCODE_USERNAME, OPENCODE_PASSWORD, OPENCODE_TOKEN } = process.env;
  if (OPENCODE_TOKEN) return { authorization: `Bearer ${OPENCODE_TOKEN}` };
  if (OPENCODE_USERNAME && OPENCODE_PASSWORD) {
    const b64 = Buffer.from(`${OPENCODE_USERNAME}:${OPENCODE_PASSWORD}`).toString('base64');
    return { authorization: `Basic ${b64}` };
  }
  return undefined;
}

export async function getClient() {
  if (cached) return cached;

  // 1. Kalau OPENCODE_URL diset -> konek langsung (cocok untuk Docker / remote server)
  if (process.env.OPENCODE_URL) {
    const client = OpenCode.make({
      baseUrl: process.env.OPENCODE_URL,
      headers: headersFromEnv(),
    });
    // sanity check
    await client.server.info();
    cached = client;
    return client;
  }

  // 2. Default: pakai background service lokal (opencode harus terinstall di PATH)
  // Service.ensure() akan start `opencode serve --service` kalau belum jalan.
  const endpoint = await Service.ensure();
  const client = OpenCode.make({
    baseUrl: endpoint.url,
    headers: Service.headers(endpoint),
  });
  cached = client;
  return client;
}

export function extractAssistantText(messages) {
  const data = messages?.data ?? messages ?? [];
  // ambil assistant message terakhir yang punya content text
  for (let i = data.length - 1; i >= 0; i--) {
    const m = data[i];
    if (m?.type === 'assistant' && Array.isArray(m.content)) {
      const texts = m.content.filter((c) => c.type === 'text').map((c) => c.text);
      if (texts.length) return { text: texts.join('\n'), message: m };
    }
  }
  return { text: '', message: null };
}

// Ringkasan aktivitas AI yang simpel (seperti TUI opencode):
// satu baris per tool call / perintah shell / catatan asisten.
// Dipakai harness untuk live feed — polling endpoint /activity.
function summarizeToolInput(name, input) {
  if (input == null) return '';
  if (typeof input === 'string') return input.split('\n')[0].slice(0, 160);
  if (typeof input !== 'object') return '';
  const keysByTool = {
    edit: ['filePath', 'path', 'file'],
    write: ['filePath', 'path', 'file'],
    read: ['filePath', 'path', 'file'],
    bash: ['command', 'cmd', 'script'],
    glob: ['pattern', 'path'],
    grep: ['pattern', 'path'],
    task: ['description', 'prompt'],
    webfetch: ['url'],
  };
  const keys =
    keysByTool[name] ||
    ['filePath', 'path', 'file', 'pattern', 'command', 'description', 'title', 'url'];
  for (const k of keys) {
    const v = input[k];
    if (typeof v === 'string' && v.trim()) return v.trim().split('\n')[0].slice(0, 160);
  }
  return '';
}

function formatToolPart(part) {
  const summary = summarizeToolInput(part.name, part.state?.input);
  let line = part.name === 'bash' ? `$ ${summary}` : `${part.name} ${summary}`.trim();
  if (part.state?.status === 'error') {
    const msg = String(part.state?.error?.message || part.state?.error || 'gagal').split('\n')[0].slice(0, 120);
    line += ` → gagal: ${msg}`;
  }
  return line;
}

export function extractActivity(messages) {
  const data = messages?.data ?? messages ?? [];
  const activity = [];
  const upsert = (key, line) => {
    const clean = String(line || '').trim();
    if (!key || !clean) return;
    const existing = activity.find((a) => a.key === key);
    if (existing) existing.line = clean;
    else activity.push({ key, line: clean });
  };
  for (const m of data) {
    if (!m) continue;
    // Output shell session (opencode "shell" message)
    if (m.type === 'shell') {
      const cmd = String(m.command || '').split('\n')[0].slice(0, 160);
      const tail = m.status && m.status !== 'running' ? ` → ${m.status}${m.exit != null ? ` (exit ${m.exit})` : ''}` : '';
      upsert(`shell:${m.id}`, `$ ${cmd}${tail}`.trim());
      continue;
    }
    // Instruksi user (prompt harness) bukan aktivitas AI — lewati.
    if (!Array.isArray(m.content)) continue;
    for (const part of m.content) {
      if (!part) continue;
      if (part.type === 'tool') {
        upsert(`tool:${part.id}`, formatToolPart(part));
      } else if (part.type === 'text' && m.type === 'assistant') {
        const t = String(part.text || '').trim();
        if (t) upsert(`text:${m.id}`, `ai: ${t.slice(0, 200)}`);
      }
    }
  }
  return activity;
}
