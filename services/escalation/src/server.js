import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';

const log   = createLogger('escalation');
const PORT  = parseInt(process.env.PORT || '8797', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const INCIDENT_TTL_DAYS = parseInt(process.env.INCIDENT_TTL_DAYS || '90', 10);
const TRANSITIONS = { open: ['acknowledged'], acknowledged: ['resolved'], resolved: [] };

const store = createStore(process.env.DATA_DIR || './data', () => ({
  rules: [{ id: 1, name: 'SLA breach → supervisor', triggerType: 'sla_breach', tenantId: 0, createdAt: new Date().toISOString() }],
  incidents: [],
  seq: { nextRule: 2 },
}));

const auth = bearerAuth(TOKEN);
const app  = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(requestId);
healthRouter(app, 'escalation');

const makeId = () => `ESC-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

// Prune old incidents daily
function prune() {
  store.withStore(s => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - INCIDENT_TTL_DAYS);
    const before = s.incidents.length;
    s.incidents = s.incidents.filter(i => new Date(i.createdAt) > cutoff);
    if (s.incidents.length < before) log.info({ pruned: before - s.incidents.length }, 'old incidents pruned');
  }).catch(() => {});
}
prune();
setInterval(prune, 24 * 60 * 60 * 1000);

// Rules
app.get('/v1/rules', auth, (_req, res) => ok(res, store.load().rules));

app.post('/v1/rules', auth, async (req, res) => {
  const { name, triggerType, tenantId = 0 } = req.body ?? {};
  if (!name?.trim() || !triggerType?.trim()) return fail(res, 'VALIDATION_ERROR', 'name and triggerType required');
  ok(res, await store.withStore(s => {
    const r = { id: s.seq.nextRule++, name: name.trim(), triggerType: triggerType.trim(), tenantId: Number(tenantId), thresholdMinutes: req.body.thresholdMinutes ?? null, createdAt: new Date().toISOString() };
    s.rules.push(r); return r;
  }), 201);
});

// Incidents
app.get('/v1/incidents', auth, (req, res) => {
  let list = store.load().incidents.slice().reverse();
  if (req.query.status) list = list.filter(i => i.status === req.query.status);
  ok(res, list);
});

app.post('/v1/incidents', async (req, res) => {
  const { triggerType, title, tenantId = 0, metadata } = req.body ?? {};
  if (!triggerType?.trim()) return fail(res, 'VALIDATION_ERROR', 'triggerType required');
  try {
    ok(res, await store.withStore(s => {
      const incident = { id: makeId(), triggerType: triggerType.trim(), title: (title || triggerType).trim().slice(0,200), tenantId: Number(tenantId), status: 'open', metadata: metadata ?? {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      s.incidents.push(incident);
      log.info({ incidentId: incident.id, triggerType }, 'incident created');
      return incident;
    }), 201);
  } catch (e) { log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500); }
});

app.patch('/v1/incidents/:id', auth, async (req, res) => {
  const newStatus = (req.body?.status || '').trim();
  try {
    ok(res, await store.withStore(s => {
      const inc = s.incidents.find(i => i.id === req.params.id);
      if (!inc) throw Object.assign(new Error(), { code: 404 });
      if (newStatus) {
        if (!TRANSITIONS[inc.status]?.includes(newStatus)) throw Object.assign(new Error(), { code: 422, msg: `Cannot go from ${inc.status} to ${newStatus}` });
        inc.status = newStatus;
      }
      if (req.body.notes) inc.notes = String(req.body.notes).slice(0, 2000);
      inc.updatedAt = new Date().toISOString();
      return inc;
    }));
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Incident not found', 404);
    if (e.code === 422) return fail(res, 'BAD_STATE', e.msg, 422);
    log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'escalation started'));
gracefulShutdown(server, log);
