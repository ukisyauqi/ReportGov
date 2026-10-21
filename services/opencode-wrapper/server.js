import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getClient, extractAssistantText, extractActivity } from './opencode.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3001;
const WORKDIR = process.env.OPENCODE_WORKDIR || process.cwd();
const WAIT_TIMEOUT_MS = Number(process.env.OPENCODE_WAIT_TIMEOUT_MS || 120_000);

// --- helper: pastikan client connect, return 503 kalau opencode belum jalan ---
async function withClient(req, res) {
  try {
    return await getClient();
  } catch (e) {
    res.status(503).json({
      error: 'opencode_unavailable',
      hint: 'Pastikan `opencode` terinstall dan bisa jalan (`opencode serve --service` atau set OPENCODE_URL).',
      detail: String(e?.message || e),
    });
    return null;
  }
}

// GET /health -> cek koneksi ke opencode
app.get('/health', async (req, res) => {
  const client = await withClient(req, res);
  if (!client) return;
  try {
    const info = await client.server.info();
    res.json({ ok: true, opencode: info });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /sessions { directory?, title?, agent?, model? } -> bikin session baru
app.post('/sessions', async (req, res) => {
  const client = await withClient(req, res);
  if (!client) return;
  try {
    const session = await client.session.create({
      title: req.body?.title,
      agent: req.body?.agent,
      model: req.body?.model, // { providerID, id }
      location: { directory: req.body?.directory || WORKDIR },
    });
    res.json(session);
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) });
  }
});

// GET /sessions/:id/messages?limit=50 -> ambil riwayat chat
app.get('/sessions/:id/messages', async (req, res) => {
  const client = await withClient(req, res);
  if (!client) return;
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const messages = await client.message.list({
      sessionID: req.params.id,
      limit,
    });
    res.json(messages);
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) });
  }
});

// GET /sessions/:id/activity?limit=100 -> ringkasan aktivitas AI yang simpel
// (satu baris per tool call / shell / catatan). Dipakai harness untuk live feed.
app.get('/sessions/:id/activity', async (req, res) => {
  const client = await withClient(req, res);
  if (!client) return;
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const messages = await client.message.list({
      sessionID: req.params.id,
      limit,
    });
    res.json({ sessionID: req.params.id, activity: extractActivity(messages) });
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) });
  }
});

// POST /chat { message, sessionID?, directory?, agent?, model?, timeoutMs? }
// Kalau sessionID kosong -> bikin session baru otomatis.
// Non-streaming: prompt -> wait -> ambil balasan assistant terakhir.
// timeoutMs opsional (ms) untuk tugas panjang end-to-end (default WAIT_TIMEOUT_MS).
app.post('/chat', async (req, res) => {
  const client = await withClient(req, res);
  if (!client) return;

  const { message, sessionID, directory, agent, model, timeoutMs } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: '`message` (string) wajib diisi' });
  }

  try {
    let sid = sessionID;
    if (!sid) {
      const s = await client.session.create({
        agent,
        model,
        location: { directory: directory || WORKDIR },
      });
      sid = s.id;
    }

    // kirim prompt (return-nya hanya inbox user, bukan jawaban final)
    await client.session.prompt({ sessionID: sid, text: message });

    // tunggu opencode selesai generate (idle). Timeout agar HTTP tidak gantung.
    try {
      await client.session.wait(
        { sessionID: sid },
        { signal: AbortSignal.timeout(Number(timeoutMs) > 0 ? Number(timeoutMs) : WAIT_TIMEOUT_MS) },
      );
    } catch {
      // timeout / abort -> lanjut ambil pesan parsial yang sudah ada
    }

    const messages = await client.message.list({ sessionID: sid, limit: 20 });
    const { text, message: assistantMsg } = extractAssistantText(messages);

    res.json({ sessionID: sid, reply: text, assistantMessage: assistantMsg, messages });
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) });
  }
});

// POST /sessions/:id/interrupt -> stop generate yang sedang jalan
app.post('/sessions/:id/interrupt', async (req, res) => {
  const client = await withClient(req, res);
  if (!client) return;
  try {
    const out = await client.session.interrupt({ sessionID: req.params.id });
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) });
  }
});

// GET /events -> SSE passthrough dari opencode (live-only, tanpa replay)
app.get('/events', async (req, res) => {
  const client = await withClient(req, res);
  if (!client) return;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(': connected\n\n');

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  try {
    for await (const event of client.event.subscribe()) {
      if (closed) break;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (e) {
    if (!closed) res.write(`event: error\ndata: ${JSON.stringify({ error: String(e?.message || e) })}\n\n`);
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`[opencode-wrapper] listening on http://localhost:${PORT}`);
  console.log(`[opencode-wrapper] workdir default: ${WORKDIR}`);
});
