import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';

const log   = createLogger('ivr');
const PORT  = parseInt(process.env.PORT || '8795', 10);
const TOKEN = (process.env.TOKEN || '').trim();

const defaultFlow = { id: 1, name: 'Default IVR', graph: { entry: 'welcome', nodes: [{ id: 'welcome', type: 'play', text: 'Thank you for calling BlinkOne. Press 1 for Sales, 2 for Support.' }, { id: 'sales', type: 'enqueue', queue: 'sales', digit: '1' }, { id: 'support', type: 'enqueue', queue: 'support', digit: '2' }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const store = createStore(process.env.DATA_DIR || './data', () => ({ flows: [defaultFlow], routeLog: [], seq: { next: 2 } }));
const auth  = bearerAuth(TOKEN);
const app   = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(requestId);
healthRouter(app, 'ivr');

function validateGraph(g) {
  if (!g?.entry || !Array.isArray(g.nodes) || !g.nodes.length) return 'graph.entry and graph.nodes[] required';
  if (!g.nodes.find(n => n.id === g.entry)) return `entry node "${g.entry}" not found`;
  return null;
}

app.get('/v1/flows', (_req, res) => ok(res, store.load().flows));

app.get('/v1/flows/:id', (req, res) => {
  const f = store.load().flows.find(x => x.id === Number(req.params.id));
  return f ? ok(res, f) : fail(res, 'NOT_FOUND', 'Flow not found', 404);
});

app.post('/v1/flows', auth, async (req, res) => {
  const { name, graph } = req.body ?? {};
  if (!name?.trim()) return fail(res, 'VALIDATION_ERROR', 'name required');
  const gErr = validateGraph(graph);
  if (gErr) return fail(res, 'VALIDATION_ERROR', gErr);
  ok(res, await store.withStore(s => {
    const f = { id: s.seq.next++, name: name.trim(), graph, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    s.flows.push(f); return f;
  }), 201);
});

app.patch('/v1/flows/:id', auth, async (req, res) => {
  if (req.body?.graph) { const e = validateGraph(req.body.graph); if (e) return fail(res, 'VALIDATION_ERROR', e); }
  try {
    ok(res, await store.withStore(s => {
      const f = s.flows.find(x => x.id === Number(req.params.id));
      if (!f) throw Object.assign(new Error(), { code: 404 });
      if (req.body.name) f.name = req.body.name.trim();
      if (req.body.graph) f.graph = req.body.graph;
      f.updatedAt = new Date().toISOString(); return f;
    }));
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Flow not found', 404);
    log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.post('/v1/route', auth, async (req, res) => {
  const { flowId = 1, digit, callerId } = req.body ?? {};
  const s = store.load();
  const flow = s.flows.find(f => f.id === Number(flowId)) ?? s.flows[0];
  if (!flow) return fail(res, 'NOT_FOUND', 'No IVR flow found', 404);
  let node = flow.graph.nodes.find(n => n.id === flow.graph.entry);
  if (digit) { const dn = flow.graph.nodes.find(n => n.digit === String(digit)); if (dn) node = dn; }
  const decision = { flowId: flow.id, node: node?.id, type: node?.type, queue: node?.queue ?? null, decidedAt: new Date().toISOString(), callerId };
  await store.withStore(ss => { ss.routeLog = ss.routeLog ?? []; ss.routeLog.push(decision); if (ss.routeLog.length > 100) ss.routeLog = ss.routeLog.slice(-100); });
  log.info({ node: node?.id, type: node?.type }, 'route decision');
  ok(res, decision);
});

app.get('/v1/route-log', auth, (_req, res) => ok(res, (store.load().routeLog ?? []).slice().reverse()));

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'ivr started'));
gracefulShutdown(server, log);
