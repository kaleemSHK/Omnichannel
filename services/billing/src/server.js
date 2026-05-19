import { randomUUID } from 'node:crypto';
import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';

const log   = createLogger('billing');
const PORT  = parseInt(process.env.PORT || '8794', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const CURRENCY = (process.env.CURRENCY || 'AED').toUpperCase();

const defaultPlans = () => [
  { id: 'starter',    name: 'Starter',      priceMonthly: 299,  currency: CURRENCY, includedAgents: 5,   description: 'Small teams & core omnichannel' },
  { id: 'pro',        name: 'Professional', priceMonthly: 999,  currency: CURRENCY, includedAgents: 25,  description: 'Growing CX operations' },
  { id: 'enterprise', name: 'Enterprise',   priceMonthly: 3499, currency: CURRENCY, includedAgents: 100, description: 'Full platform + voice + AI' },
];

const store = createStore(process.env.DATA_DIR || './data', () => ({ plans: defaultPlans(), subscriptions: [], usageEvents: {}, signups: [], seq: { next: 1 } }));
const auth  = bearerAuth(TOKEN);
const app   = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(requestId);
healthRouter(app, 'billing');

// Plans
app.get('/v1/plans', (_req, res) => ok(res, store.load().plans));

// Subscriptions
app.get('/v1/subscriptions', auth, (req, res) => {
  let subs = store.load().subscriptions.filter(s => s.status !== 'superseded');
  if (req.query.tenant_id) subs = subs.filter(s => String(s.tenantId) === String(req.query.tenant_id));
  ok(res, subs);
});

app.post('/v1/subscriptions', auth, async (req, res) => {
  const { tenantId, planId } = req.body ?? {};
  if (!tenantId || !planId) return fail(res, 'VALIDATION_ERROR', 'tenantId and planId required');
  try {
    ok(res, await store.withStore(s => {
      if (!s.plans.find(p => p.id === planId)) throw Object.assign(new Error(), { code: 404, msg: 'Plan not found' });
      s.subscriptions.filter(x => x.tenantId === tenantId && x.status === 'active').forEach(x => x.status = 'superseded');
      const sub = { id: String(s.seq.next++), tenantId, planId, status: 'active', currency: CURRENCY, startedAt: new Date().toISOString() };
      s.subscriptions.push(sub); return sub;
    }), 201);
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', e.msg, 404);
    log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

// Usage events
app.post('/v1/usage/events', async (req, res) => {
  const { tenantId, metric, quantity = 1 } = req.body ?? {};
  if (!tenantId || !metric) return fail(res, 'VALIDATION_ERROR', 'tenantId and metric required');
  const ev = { id: randomUUID(), tenantId, metric, quantity: Number(quantity) || 1, recordedAt: new Date().toISOString() };
  await store.withStore(s => {
    const k = String(tenantId);
    s.usageEvents[k] = s.usageEvents[k] ?? [];
    s.usageEvents[k].push(ev);
    if (s.usageEvents[k].length > 2000) s.usageEvents[k] = s.usageEvents[k].slice(-2000);
  });
  ok(res, ev, 201);
});

app.get('/v1/usage/summary', auth, (req, res) => {
  const tenantId = String(req.query.tenant_id || '');
  const month = (req.query.month || new Date().toISOString().slice(0,7)).slice(0,7);
  const events = (store.load().usageEvents[tenantId] ?? []).filter(e => e.recordedAt.startsWith(month));
  const summary = {};
  for (const e of events) summary[e.metric] = (summary[e.metric] ?? 0) + e.quantity;
  ok(res, { tenantId, month, summary });
});

// Signups
app.post('/v1/signups', async (req, res) => {
  const { orgName, email, planId = 'starter' } = req.body ?? {};
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!orgName?.trim()) return fail(res, 'VALIDATION_ERROR', 'orgName required');
  if (!email?.trim() || !emailRe.test(email)) return fail(res, 'VALIDATION_ERROR', 'valid email required');
  try {
    ok(res, await store.withStore(s => {
      const r = { id: String(s.seq.next++), orgName: orgName.trim().slice(0,200), email: email.trim().slice(0,320), planId, status: 'pending', requestedAt: new Date().toISOString() };
      s.signups = s.signups ?? []; s.signups.push(r); return r;
    }), 201);
  } catch (e) { log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500); }
});

app.get('/v1/signups', auth, (_req, res) => ok(res, store.load().signups ?? []));

app.patch('/v1/signups/:id/approve', auth, async (req, res) => {
  try {
    ok(res, await store.withStore(s => {
      const r = (s.signups ?? []).find(x => x.id === req.params.id);
      if (!r) throw Object.assign(new Error(), { code: 404 });
      if (r.status !== 'pending') throw Object.assign(new Error(), { code: 422, msg: 'Signup is not pending' });
      r.status = 'approved'; r.approvedAt = new Date().toISOString();
      log.info({ signupId: r.id, email: r.email }, 'signup approved');
      return r;
    }));
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Signup not found', 404);
    if (e.code === 422) return fail(res, 'BAD_STATE', e.msg, 422);
    log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT, currency: CURRENCY }, 'billing started'));
gracefulShutdown(server, log);
