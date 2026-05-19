import { randomUUID } from 'node:crypto';
import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';

const log   = createLogger('tickets');
const PORT  = parseInt(process.env.PORT || '8791', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const SLA_URL   = (process.env.SLA_URL   || 'http://sla:8796').replace(/\/$/, '');
const SLA_TOKEN = (process.env.SLA_TOKEN || '').trim();

const store = createStore(process.env.DATA_DIR || './data', () => ({ tickets: [], events: [], fields: [], seq: { next: 1 } }));
const auth  = bearerAuth(TOKEN);
const app   = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' }));
app.use(requestId);
healthRouter(app, 'tickets');

const STATUS   = ['open','pending','in-progress','resolved'];
const PRIORITY = ['low','medium','high','urgent'];
const norm = (val, list, def) => list.includes((val||'').toLowerCase()) ? val.toLowerCase() : def;

function mapTicket(t, s) {
  const cf = {}, tl = [];
  (s.fields ?? []).filter(f => f.ticketId === t.id).forEach(f => cf[f.key] = f.value);
  (s.events ?? []).filter(e => e.ticketId === t.id).sort((a,b) => new Date(a.at) - new Date(b.at)).forEach(e => tl.push({ at: e.at, type: e.type, message: e.message, actor: e.actor }));
  return { id: t.id, title: t.title, status: t.status, priority: t.priority, channel: t.channel, customerName: t.customerName, customerEmail: t.customerEmail, department: t.department, chatwootAccountId: t.chatwootAccountId, chatwootConversationId: t.chatwootConversationId, tenantId: t.tenantId, customFields: cf, timeline: tl, createdAt: t.createdAt, updatedAt: t.updatedAt };
}

async function tryCreateSla(ticket) {
  if (!SLA_URL) return;
  try {
    await fetch(`${SLA_URL}/v1/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(SLA_TOKEN ? { Authorization: `Bearer ${SLA_TOKEN}` } : {}) },
      body: JSON.stringify({ policyId: 1, chatwootAccountId: ticket.chatwootAccountId, ticketId: ticket.id }),
    });
  } catch (e) { log.warn({ err: e.message }, 'SLA create failed'); }
}

// List tickets
app.get('/v1/tickets', (req, res) => {
  const accountId = Number(req.query.chatwoot_account_id);
  if (!Number.isFinite(accountId)) return fail(res, 'VALIDATION_ERROR', 'chatwoot_account_id required');
  const s = store.load();
  let list = s.tickets.filter(t => t.chatwootAccountId === accountId);
  if (req.query.status) list = list.filter(t => t.status === req.query.status);
  ok(res, list.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(t => mapTicket(t, s)));
});

// Get one
app.get('/v1/tickets/:id', (req, res) => {
  const s = store.load();
  const t = s.tickets.find(x => x.id === Number(req.params.id));
  return t ? ok(res, mapTicket(t, s)) : fail(res, 'NOT_FOUND', 'Ticket not found', 404);
});

// Create
app.post('/v1/tickets', auth, async (req, res) => {
  const { title, chatwootAccountId, chatwootConversationId, channel = 'Chat', customerName = 'Unknown', customerEmail = '', department = 'Support', priority, status, customFields } = req.body ?? {};
  if (!title?.trim()) return fail(res, 'VALIDATION_ERROR', 'title is required');
  if (!Number.isFinite(Number(chatwootAccountId))) return fail(res, 'VALIDATION_ERROR', 'chatwootAccountId is required');
  const now = new Date().toISOString();
  try {
    const { ticket } = await store.withStore(s => {
      const id = s.seq.next++;
      const t = { id, title: title.trim().slice(0,500), status: norm(status, STATUS, 'open'), priority: norm(priority, PRIORITY, 'medium'), channel: (channel||'Chat').slice(0,80), customerName: (customerName||'Unknown').slice(0,200), customerEmail: (customerEmail||'').slice(0,320), department: (department||'Support').slice(0,120), chatwootAccountId: Number(chatwootAccountId), chatwootConversationId: chatwootConversationId ? Number(chatwootConversationId) : null, tenantId: null, createdAt: now, updatedAt: now };
      s.tickets.push(t);
      s.events = s.events ?? [];
      s.events.push({ ticketId: id, at: now, type: 'created', message: 'Ticket created', actor: 'system' });
      if (customFields && typeof customFields === 'object') {
        s.fields = s.fields ?? [];
        for (const [k,v] of Object.entries(customFields)) s.fields.push({ ticketId: id, key: k.slice(0,120), value: v });
      }
      return { ticket: t };
    });
    tryCreateSla(ticket);
    ok(res, mapTicket(ticket, store.load()), 201);
  } catch (e) { log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500); }
});

// Update
app.patch('/v1/tickets/:id', auth, async (req, res) => {
  try {
    await store.withStore(s => {
      const t = s.tickets.find(x => x.id === Number(req.params.id));
      if (!t) throw Object.assign(new Error(), { code: 404 });
      const { title, status, priority, department, assignedTo, customFields } = req.body ?? {};
      if (title?.trim()) t.title = title.trim().slice(0,500);
      if (status)    t.status    = norm(status, STATUS, t.status);
      if (priority)  t.priority  = norm(priority, PRIORITY, t.priority);
      if (department) t.department = department.slice(0,120);
      if (assignedTo) t.assignedTo = assignedTo.slice(0,200);
      if (customFields && typeof customFields === 'object') {
        s.fields = s.fields ?? [];
        for (const [k,v] of Object.entries(customFields)) {
          const idx = s.fields.findIndex(f => f.ticketId === t.id && f.key === k);
          if (idx >= 0) s.fields[idx].value = v;
          else s.fields.push({ ticketId: t.id, key: k.slice(0,120), value: v });
        }
      }
      t.updatedAt = new Date().toISOString();
    });
    const s = store.load();
    const t = s.tickets.find(x => x.id === Number(req.params.id));
    ok(res, mapTicket(t, s));
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Ticket not found', 404);
    log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

// Timeline
app.post('/v1/tickets/:id/timeline', auth, async (req, res) => {
  const { type, message, actor = 'agent' } = req.body ?? {};
  if (!type?.trim() || !message?.trim()) return fail(res, 'VALIDATION_ERROR', 'type and message required');
  try {
    await store.withStore(s => {
      if (!s.tickets.find(x => x.id === Number(req.params.id))) throw Object.assign(new Error(), { code: 404 });
      s.events = s.events ?? [];
      s.events.push({ ticketId: Number(req.params.id), at: new Date().toISOString(), type: type.trim().slice(0,80), message: message.trim().slice(0,2000), actor: actor.slice(0,120) });
    });
    const s = store.load();
    ok(res, mapTicket(s.tickets.find(x => x.id === Number(req.params.id)), s), 201);
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Ticket not found', 404);
    log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'tickets started'));
gracefulShutdown(server, log);
