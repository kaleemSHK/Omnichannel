import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';

const log   = createLogger('sla');
const PORT  = parseInt(process.env.PORT || '8796', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const ESC_URL   = (process.env.ESCALATION_URL   || 'http://escalation:8797').replace(/\/$/, '');
const ESC_TOKEN = (process.env.ESCALATION_TOKEN || '').trim();

const store = createStore(process.env.DATA_DIR || './data', () => ({
  policies: [{ id: 1, name: 'Default', firstResponseMinutes: 60, resolveMinutes: 480, createdAt: new Date().toISOString() }],
  instances: [],
  seq: { nextPolicy: 2, nextInstance: 1 },
}));

const auth = bearerAuth(TOKEN);
const app  = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(requestId);
healthRouter(app, 'sla');

function addMin(iso, min) {
  const d = new Date(iso); d.setMinutes(d.getMinutes() + min); return d.toISOString();
}

function calcBreach(inst) {
  const now = Date.now();
  const frDue = inst.firstResponseDueAt ? new Date(inst.firstResponseDueAt).getTime() : 0;
  const rDue  = inst.resolveDueAt ? new Date(inst.resolveDueAt).getTime() : 0;
  if (!inst.firstResponseMetAt && frDue && now > frDue) return 'first_response';
  if (!inst.resolvedAt && rDue && now > rDue) return 'resolve';
  return 'none';
}

// Policies
app.get('/v1/policies', (req, res) => {
  let policies = store.load().policies;
  if (req.query.chatwoot_account_id) policies = policies.filter(p => !p.chatwootAccountId || String(p.chatwootAccountId) === String(req.query.chatwoot_account_id));
  ok(res, policies);
});

app.post('/v1/policies', auth, async (req, res) => {
  const { name, firstResponseMinutes, resolveMinutes, chatwootAccountId } = req.body ?? {};
  if (!name?.trim()) return fail(res, 'VALIDATION_ERROR', 'name required');
  if (!Number.isFinite(Number(firstResponseMinutes)) || !Number.isFinite(Number(resolveMinutes))) return fail(res, 'VALIDATION_ERROR', 'firstResponseMinutes and resolveMinutes required');
  ok(res, await store.withStore(s => {
    const p = { id: s.seq.nextPolicy++, name: name.trim(), firstResponseMinutes: Number(firstResponseMinutes), resolveMinutes: Number(resolveMinutes), chatwootAccountId: chatwootAccountId ?? null, createdAt: new Date().toISOString() };
    s.policies.push(p); return p;
  }), 201);
});

// Instances
app.get('/v1/instances', (req, res) => {
  let list = store.load().instances;
  if (req.query.chatwoot_account_id) list = list.filter(i => String(i.chatwootAccountId) === String(req.query.chatwoot_account_id));
  const mapped = list.map(i => {
    const breach = calcBreach(i);
    if (breach !== 'none' && !i.breachNotifiedAt) {
      i.breach = breach;
      fetch(`${ESC_URL}/v1/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(ESC_TOKEN ? { Authorization: `Bearer ${ESC_TOKEN}` } : {}) },
        body: JSON.stringify({ triggerType: 'sla_breach', title: `SLA breach: ${breach}`, metadata: { instanceId: i.id, breach } }),
      }).then(() => store.withStore(s => { const inst = s.instances.find(x => x.id === i.id); if (inst) inst.breachNotifiedAt = new Date().toISOString(); }))
        .catch(e => log.warn({ err: e.message }, 'escalation notify failed'));
    }
    return { ...i, breach: calcBreach(i), isBreached: calcBreach(i) !== 'none' };
  });
  ok(res, mapped);
});

app.post('/v1/instances', async (req, res) => {
  const { policyId = 1, chatwootAccountId, chatwootConversationId, ticketId } = req.body ?? {};
  if (!Number.isFinite(Number(chatwootAccountId))) return fail(res, 'VALIDATION_ERROR', 'chatwootAccountId required');
  const s = store.load();
  const policy = s.policies.find(p => p.id === Number(policyId));
  if (!policy) return fail(res, 'NOT_FOUND', 'Policy not found', 404);
  const now = new Date().toISOString();
  ok(res, await store.withStore(ss => {
    const inst = { id: ss.seq.nextInstance++, policyId: policy.id, policyName: policy.name, chatwootAccountId: Number(chatwootAccountId), chatwootConversationId: chatwootConversationId ?? null, ticketId: ticketId ?? null, firstResponseDueAt: addMin(now, policy.firstResponseMinutes), resolveDueAt: addMin(now, policy.resolveMinutes), firstResponseMetAt: null, resolvedAt: null, createdAt: now };
    ss.instances.push(inst); return inst;
  }), 201);
});

// SLA events (from gateway fan-out)
app.post('/v1/events', async (req, res) => {
  res.status(200).json({ ok: true });
  const { event, conversationId, chatwootAccountId } = req.body ?? {};
  if (!event || !conversationId) return;
  await store.withStore(s => {
    const inst = s.instances.find(i => i.chatwootConversationId === Number(conversationId) && i.chatwootAccountId === Number(chatwootAccountId));
    if (!inst) return;
    const now = new Date().toISOString();
    if (event === 'agent_responded' && !inst.firstResponseMetAt) inst.firstResponseMetAt = now;
    if (event === 'conversation_resolved' && !inst.resolvedAt) inst.resolvedAt = now;
  });
});

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'sla started'));
gracefulShutdown(server, log);
