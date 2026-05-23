import express from 'express';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../lib/logger.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { dbEnabled, runMigrations, closePool, getPool } from '../lib/db.js';
import { resolveTenantId } from '../lib/tenant.js';
import { tenantSuspendedMiddleware } from '../lib/tenant-guard.js';
import { fetchUsageLimits } from '../_shared/lib/billing-limits.js';
import { requireFeature } from '../_shared/lib/features.js';
import { chatCompletions } from '../lib/llm/gateway.js';
import { startSttWorker } from '../lib/stt/adapter.js';
import * as rag from '../lib/rag/service.js';
import * as assist from '../lib/assist/service.js';
import * as voice from '../lib/voicebot/fsm.js';
import { synthesize } from '../lib/tts/piper.js';

const log = createLogger('ai');
const PORT = parseInt(process.env.PORT || '8793', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const CHATWOOT_URL = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '5000', 10);

const auth = bearerAuth(TOKEN);
const agentAssist = requireFeature('agent_assist', resolveTenantId, fail);
const ragFeature = requireFeature('rag', resolveTenantId, fail);
const voiceFeature = requireFeature('voice_bot', resolveTenantId, fail);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(requestId);
app.use(tenantSuspendedMiddleware(resolveTenantId, fail));
healthRouter(app, 'ai');

const quota = new Map();

async function checkQuota(tenantId) {
  const limits = await fetchUsageLimits(tenantId);
  if (limits.blocked) return { ok: false, code: 'LIMIT_EXCEEDED', message: limits.reason || 'Usage limit exceeded' };
  const key = `${tenantId}:${new Date().toISOString().slice(0, 10)}`;
  const n = (quota.get(key) ?? 0) + 1;
  quota.set(key, n);
  if (n > DAILY_LIMIT) return { ok: false, code: 'QUOTA_EXCEEDED', message: 'Daily limit' };
  return { ok: true };
}

app.get('/readyz', async (_req, res) => {
  if (!dbEnabled()) return res.json({ status: 'ready', db: false });
  try {
    await getPool().query('SELECT 1');
    return res.json({ status: 'ready', db: true });
  } catch (e) {
    return res.status(503).json({ status: 'not_ready', error: e.message });
  }
});

app.get('/v1/health', (_req, res) =>
  res.json({
    status: 'ok',
    provider: process.env.OPENAI_API_KEY ? 'openai' : 'stub',
    pii: process.env.PII_REDACT_ENABLED !== '0',
  }),
);

// ─── LLM gateway ─────────────────────────────────────────────────────────────
async function meterAiUsage(tenantId, dimension, quantity = 1) {
  const url = (process.env.BILLING_URL || 'http://billing:8794').replace(/\/$/, '');
  const token = (process.env.BILLING_TOKEN || '').trim();
  if (!token) return;
  try {
    await fetch(`${url}/v1/usage/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tenantId,
        dimension: dimension === 'ai_token' ? 'ai_token' : dimension,
        quantity,
        sourceService: 'ai',
        sourceEventId: `ai-${tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
    });
  } catch {
    /* non-fatal */
  }
}

app.post('/v1/chat/completions', auth, agentAssist, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const quotaCheck = await checkQuota(tenantId);
  if (!quotaCheck.ok) return fail(res, quotaCheck.code, quotaCheck.message, quotaCheck.code === 'LIMIT_EXCEEDED' ? 402 : 429);
  try {
    const result = await chatCompletions(tenantId, {
      messages: req.body?.messages ?? [],
      model: req.body?.model,
      maxTokens: req.body?.max_tokens ?? 1000,
      stream: !!req.body?.stream,
    });
    await meterAiUsage(tenantId, 'ai_token', result?.usage?.total_tokens ?? 1);
    return ok(res, result);
  } catch (e) {
    log.error({ err: e.message }, 'chat completions');
    return fail(res, 'AI_ERROR', e.message, 500);
  }
});

// ─── STT ─────────────────────────────────────────────────────────────────────
app.post('/v1/stt/jobs', auth, agentAssist, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const tenantId = resolveTenantId(req);
  const { audio_minio_key, language_hint, diarize, context_phrases } = req.body ?? {};
  if (!audio_minio_key) return fail(res, 'VALIDATION_ERROR', 'audio_minio_key required');
  const { rows } = await getPool().query(
    `INSERT INTO stt_jobs (tenant_id, audio_minio_key, language_hint, diarize, context_phrases)
     VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
    [
      tenantId,
      audio_minio_key,
      language_hint || 'ar-OM',
      diarize !== false,
      JSON.stringify(context_phrases ?? []),
    ],
  );
  return ok(res, { job_id: rows[0].id, status: 'queued' }, 202);
});

app.get('/v1/stt/jobs/:id', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { rows } = await getPool().query('SELECT * FROM stt_jobs WHERE id = $1', [req.params.id]);
  if (!rows.length) return fail(res, 'NOT_FOUND', 'Job not found', 404);
  const j = rows[0];
  return ok(res, {
    status: j.status,
    transcript: j.transcript,
    words: j.words,
    detected_language: j.detected_language,
    error: j.error_message,
  });
});

// ─── TTS ─────────────────────────────────────────────────────────────────────
app.post('/v1/tts', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const { text, voice } = req.body ?? {};
  if (!text?.trim()) return fail(res, 'VALIDATION_ERROR', 'text required');
  try {
    return ok(res, await synthesize({ tenantId, text: text.trim(), voice }));
  } catch (e) {
    return fail(res, 'TTS_ERROR', e.message, 500);
  }
});

// ─── RAG ─────────────────────────────────────────────────────────────────────
app.get('/v1/rag/collections', auth, ragFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await rag.listCollections(resolveTenantId(req)));
});

app.post('/v1/rag/collections', auth, ragFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { name, language } = req.body ?? {};
  if (!name) return fail(res, 'VALIDATION_ERROR', 'name required');
  return ok(res, await rag.createCollection(resolveTenantId(req), { name, language }), 201);
});

app.post('/v1/rag/index', auth, ragFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const tenantId = resolveTenantId(req);
  const { collection_id, source_type, source_ref, content } = req.body ?? {};
  if (!collection_id || !source_ref) return fail(res, 'VALIDATION_ERROR', 'collection_id and source_ref required');
  try {
    const result = await rag.indexDocument(tenantId, {
      collection_id,
      source_type: source_type || 'plain_text',
      source_ref,
      content,
    });
    return ok(res, result, 202);
  } catch (e) {
    return fail(res, 'RAG_ERROR', e.message, 500);
  }
});

app.post('/v1/rag/query', auth, ragFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    return ok(res, await rag.queryRag(resolveTenantId(req), req.body ?? {}));
  } catch (e) {
    return fail(res, 'RAG_ERROR', e.message, 500);
  }
});

// Legacy alias
app.post('/v1/suggest', auth, agentAssist, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const text = req.body?.text ?? '';
  try {
    const r = await assist.suggestReply(tenantId, { conversation_id: 'legacy', text, tone: 'professional' });
    const first = r.suggestions?.[0]?.text ?? '';
    return ok(res, { suggestion: first, provider: 'openai' });
  } catch (e) {
    return fail(res, 'AI_ERROR', e.message, 500);
  }
});

app.post('/v1/suggest/reply', auth, agentAssist, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const quotaCheck = await checkQuota(tenantId);
  if (!quotaCheck.ok) return fail(res, quotaCheck.code, quotaCheck.message, quotaCheck.code === 'LIMIT_EXCEEDED' ? 402 : 429);
  try {
    return ok(res, await assist.suggestReply(tenantId, req.body ?? {}));
  } catch (e) {
    return fail(res, 'AI_ERROR', e.message, 500);
  }
});

app.post('/v1/summarize', auth, agentAssist, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const text = req.body?.text ?? '';
  try {
    const r = await assist.summarizeConversation(tenantId, {
      conversation_id: req.body?.conversation_id,
      text,
    });
    return ok(res, { summary: r.summary, provider: 'openai' });
  } catch (e) {
    return fail(res, 'AI_ERROR', e.message, 500);
  }
});

app.post('/v1/summarize/conversation', auth, agentAssist, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const quotaCheck = await checkQuota(tenantId);
  if (!quotaCheck.ok) return fail(res, quotaCheck.code, quotaCheck.message, quotaCheck.code === 'LIMIT_EXCEEDED' ? 402 : 429);
  try {
    return ok(res, await assist.summarizeConversation(tenantId, req.body ?? {}));
  } catch (e) {
    return fail(res, 'AI_ERROR', e.message, 500);
  }
});

app.post('/v1/classify', auth, async (req, res) => {
  try {
    const r = await assist.classifyTicket(resolveTenantId(req), { message_sample: req.body?.text });
    return ok(res, { label: r.category, ...r });
  } catch {
    return res.status(204).end();
  }
});

app.post('/v1/classify/ticket', auth, async (req, res) => {
  try {
    return ok(res, await assist.classifyTicket(resolveTenantId(req), req.body ?? {}));
  } catch (e) {
    return fail(res, 'AI_ERROR', e.message, 500);
  }
});

app.post('/v1/sentiment', auth, async (req, res) => {
  try {
    return ok(res, await assist.analyzeSentiment(resolveTenantId(req), req.body ?? {}));
  } catch (e) {
    return fail(res, 'AI_ERROR', e.message, 500);
  }
});

// ─── Voice bot ───────────────────────────────────────────────────────────────
app.post('/v1/voice/sessions', auth, voiceFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { call_id, inbox_id, collection_id, language, max_misunderstandings } = req.body ?? {};
  if (!call_id || !inbox_id) return fail(res, 'VALIDATION_ERROR', 'call_id and inbox_id required');
  try {
    return ok(res, await voice.createSession(resolveTenantId(req), req.body), 201);
  } catch (e) {
    return fail(res, 'VOICE_ERROR', e.message, 500);
  }
});

app.post('/v1/voice/sessions/:sessionId/turn', auth, voiceFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    return ok(
      res,
      await voice.processTurn(resolveTenantId(req), req.params.sessionId, req.body ?? {}),
    );
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    return fail(res, 'VOICE_ERROR', e.message, 500);
  }
});

// Chatwoot events (integration fan-in stub)
app.post('/v1/events', async (req, res) => {
  const tenantId = resolveTenantId(req);
  const event = req.body?.event || req.body?.event_type;
  const body = req.body ?? {};
  if (event === 'message_created' && body.message_type === 'incoming') {
    try {
      await assist.analyzeSentiment(tenantId, {
        text: body.content,
        conversation_id: body.conversation_id,
        message_id: body.message_id,
      });
    } catch {
      /* non-fatal */
    }
  }
  if (event === 'conversation_created') {
    setTimeout(async () => {
      try {
        await assist.classifyTicket(tenantId, { message_sample: body.content || 'new conversation' });
      } catch {
        /* */
      }
    }, 5000);
  }
  return ok(res, { handled: true, event });
});

app.post('/v1/agent-bot', async (req, res) => {
  res.status(200).json({ ok: true });
  const { conversation, message, account } = req.body ?? {};
  const text = (message?.content || '').trim();
  const botToken = (process.env.CHATWOOT_BOT_TOKEN || '').trim();
  if (!text || !botToken) return;
  try {
    const tenantId = String(account?.id ?? 'default');
    const r = await assist.suggestReply(tenantId, { conversation_id: conversation?.id, text });
    const suggestion = r.suggestions?.[0]?.text ?? '';
    await fetch(`${CHATWOOT_URL}/api/v1/accounts/${account.id}/conversations/${conversation.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', api_access_token: botToken },
      body: JSON.stringify({ content: `💡 ${suggestion}`, message_type: 'outgoing', private: true }),
    });
  } catch (e) {
    log.warn({ err: e.message }, 'agent-bot');
  }
});

app.use(errorHandler(log));

async function boot() {
  if (dbEnabled()) {
    await runMigrations(log);
    log.info('AI Postgres + pgvector ready');
    startSttWorker();
  }
  const server = app.listen(PORT, '0.0.0.0', () =>
    log.info({ port: PORT, db: dbEnabled(), openai: !!process.env.OPENAI_API_KEY }, 'ai started'),
  );
  process.on('SIGTERM', () => closePool());
  gracefulShutdown(server, log);
}

boot().catch((e) => {
  log.error(e);
  process.exit(1);
});
