import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';

const log          = createLogger('routing');
const PORT         = parseInt(process.env.PORT || '8798', 10);
const TOKEN        = (process.env.TOKEN || '').trim();
const AGENT_TIMEOUT= parseInt(process.env.AGENT_TIMEOUT_SEC || '60', 10) * 1000;

const store = createStore(process.env.DATA_DIR || './data', { agents: {}, cursors: {} });
const auth  = bearerAuth(TOKEN);
const app   = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(requestId);
healthRouter(app, 'routing');

const STATUSES = ['available','busy','away','offline'];

function prune(s) {
  const now = Date.now();
  for (const [k, a] of Object.entries(s.agents)) {
    if (now - new Date(a.updatedAt).getTime() > AGENT_TIMEOUT) delete s.agents[k];
  }
}

app.post('/v1/agents/:id/state', auth, async (req, res) => {
  const agentId  = req.params.id;
  const status   = (req.body?.status || 'available').trim();
  const tenantId = Number(req.body?.tenantId ?? 0);
  const skills   = Array.isArray(req.body?.skills) ? req.body.skills.filter(s => typeof s === 'string') : [];
  const queue    = (req.body?.queue || '').trim() || null;
  if (!STATUSES.includes(status)) return fail(res, 'VALIDATION_ERROR', `status must be one of: ${STATUSES.join(', ')}`);
  ok(res, await store.withStore(s => {
    const key = `${tenantId}:${agentId}`;
    const agent = { agentId, tenantId, status, skills, queue, updatedAt: new Date().toISOString() };
    s.agents = s.agents ?? {}; s.agents[key] = agent; return agent;
  }));
});

app.get('/v1/agents', auth, (req, res) => {
  const s = store.load(); prune(s);
  let agents = Object.values(s.agents);
  if (req.query.tenant_id) agents = agents.filter(a => String(a.tenantId) === String(req.query.tenant_id));
  ok(res, agents);
});

app.post('/v1/route', auth, async (req, res) => {
  const { tenantId = 0, queue, skills = [] } = req.body ?? {};
  const agent = await store.withStore(s => {
    prune(s);
    let pool = Object.values(s.agents).filter(a => a.status === 'available' && a.tenantId === Number(tenantId));
    if (queue) pool = pool.filter(a => !a.queue || a.queue === queue);
    if (skills.length) pool = pool.filter(a => skills.every(sk => a.skills.includes(sk)));
    if (!pool.length) return null;
    const curKey = `${tenantId}:${queue || 'default'}`;
    s.cursors = s.cursors ?? {};
    const idx = (s.cursors[curKey] ?? 0) % pool.length;
    s.cursors[curKey] = idx + 1;
    const chosen = pool[idx];
    const key = `${chosen.tenantId}:${chosen.agentId}`;
    if (s.agents[key]) { s.agents[key].status = 'busy'; s.agents[key].updatedAt = new Date().toISOString(); }
    return chosen;
  });
  ok(res, { agent: agent ?? null, matched: !!agent });
});

app.get('/v1/queues/:key/stats', auth, (req, res) => {
  const s = store.load(); prune(s);
  const agents = Object.values(s.agents).filter(a => a.queue === req.params.key);
  ok(res, { queue: req.params.key, available: agents.filter(a => a.status === 'available').length, busy: agents.filter(a => a.status === 'busy').length, total: agents.length });
});

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'routing started'));
gracefulShutdown(server, log);
