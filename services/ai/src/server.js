import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';

const log   = createLogger('ai');
const PORT  = parseInt(process.env.PORT || '8793', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '500', 10);
const CHATWOOT_URL = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');

const store = createStore(process.env.DATA_DIR || './data', { quotas: {} });
const auth  = bearerAuth(TOKEN);
const app   = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(requestId);
healthRouter(app, 'ai');

// ─── Provider ─────────────────────────────────────────────────────────────────
function resolveProvider() {
  const openaiKey    = (process.env.OPENAI_API_KEY    || '').trim();
  const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim();

  if (anthropicKey) {
    const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
    log.info({ model }, 'AI provider: anthropic');
    return {
      name: `anthropic/${model}`,
      async complete(system, user) {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, system, messages: [{ role: 'user', content: user }], max_tokens: 512 }),
        });
        if (!r.ok) throw new Error(`Anthropic ${r.status}`);
        const j = await r.json();
        return j.content?.[0]?.text?.trim() ?? '';
      },
    };
  }
  if (openaiKey) {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    log.info({ model }, 'AI provider: openai');
    return {
      name: `openai/${model}`,
      async complete(system, user) {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 512 }),
        });
        if (!r.ok) throw new Error(`OpenAI ${r.status}`);
        const j = await r.json();
        return j.choices?.[0]?.message?.content?.trim() ?? '';
      },
    };
  }
  log.warn('AI provider: stub (no API keys configured)');
  return {
    name: 'stub',
    complete: (_, user) => Promise.resolve(`[STUB] AI response for: "${user.slice(0,60)}"`),
  };
}

const provider = resolveProvider();

// ─── Quota ───────────────────────────────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0, 10);

function checkQuota(accountId) {
  const s   = store.load();
  const key = todayKey();
  const count = (s.quotas[String(accountId)] ?? {})[key] ?? 0;
  if (count >= DAILY_LIMIT) return false;
  s.quotas[String(accountId)] = { ...(s.quotas[String(accountId)] ?? {}), [key]: count + 1 };
  store.save(s);
  return true;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/v1/health', (_req, res) => res.json({ status: 'ok', provider: provider.name }));
app.get('/v1/usage',  auth, (_req, res) => ok(res, store.load().quotas));

app.post('/v1/suggest', auth, async (req, res) => {
  const accountId = Number(req.body?.chatwootAccountId ?? req.body?.accountId);
  const text = (req.body?.text || '').trim();
  if (!Number.isFinite(accountId)) return fail(res, 'VALIDATION_ERROR', 'chatwootAccountId required');
  if (!text) return fail(res, 'VALIDATION_ERROR', 'text required');
  if (!checkQuota(accountId)) return fail(res, 'QUOTA_EXCEEDED', 'Daily limit reached', 429);
  try {
    const suggestion = await provider.complete('You are a helpful customer support agent. Write a concise, friendly reply.', text);
    log.info({ accountId, provider: provider.name }, 'suggest ok');
    ok(res, { suggestion, provider: provider.name });
  } catch (e) { log.error({ err: e.message }, 'suggest failed'); fail(res, 'AI_ERROR', 'AI request failed', 500); }
});

app.post('/v1/summarize', auth, async (req, res) => {
  const accountId = Number(req.body?.chatwootAccountId ?? req.body?.accountId);
  const text = (req.body?.text || '').trim();
  if (!Number.isFinite(accountId)) return fail(res, 'VALIDATION_ERROR', 'chatwootAccountId required');
  if (!text) return fail(res, 'VALIDATION_ERROR', 'text required');
  if (!checkQuota(accountId)) return fail(res, 'QUOTA_EXCEEDED', 'Daily limit reached', 429);
  try {
    const summary = await provider.complete('Summarize this customer conversation in 2-3 sentences.', text);
    ok(res, { summary, provider: provider.name });
  } catch (e) { log.error({ err: e.message }, 'summarize failed'); fail(res, 'AI_ERROR', 'AI request failed', 500); }
});

app.post('/v1/classify', async (req, res) => {
  const text = (req.body?.text || '').trim();
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : ['billing','support','complaint','inquiry'];
  if (!text) return res.status(204).end();
  try {
    const result = await provider.complete(`Classify the following customer message into exactly one of: ${categories.join(', ')}. Reply with ONLY the category name.`, text);
    const label = categories.find(c => result.toLowerCase().includes(c.toLowerCase())) ?? categories[0];
    ok(res, { label, confidence: 0.85, provider: provider.name });
  } catch { res.status(204).end(); }
});

// Agent bot webhook (Chatwoot → ai-service → posts AI suggestion as private note)
app.post('/v1/agent-bot', async (req, res) => {
  res.status(200).json({ ok: true });
  const { conversation, message, account } = req.body ?? {};
  const text = (message?.content || '').trim();
  const convId = conversation?.id;
  const accountId = account?.id;
  const botToken = (process.env.CHATWOOT_BOT_TOKEN || '').trim();
  if (!text || !convId || !accountId || !botToken) return;
  if (!checkQuota(accountId)) return;
  try {
    const suggestion = await provider.complete('You are a helpful customer support agent. Write a concise, friendly reply.', text);
    await fetch(`${CHATWOOT_URL}/api/v1/accounts/${accountId}/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api_access_token': botToken },
      body: JSON.stringify({ content: `💡 ${suggestion}`, message_type: 'outgoing', private: true }),
    });
    log.info({ accountId, convId }, 'agent bot suggestion posted');
  } catch (e) { log.warn({ err: e.message }, 'agent bot failed'); }
});

app.post('/v1/rag/query', auth, (_req, res) => fail(res, 'NOT_IMPLEMENTED', 'RAG is Phase 5 — pgvector not yet configured', 501));

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT, provider: provider.name }, 'ai started'));
gracefulShutdown(server, log);
