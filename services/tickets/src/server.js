import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { dbEnabled, runMigrations, closePool, getPool } from '../lib/db.js';
import * as ticketRepo from '../lib/ticket-repo.js';

const log = createLogger('tickets');
const PORT = parseInt(process.env.PORT || '8791', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const SLA_URL = (process.env.SLA_URL || 'http://sla:8796').replace(/\/$/, '');
const SLA_TOKEN = (process.env.SLA_TOKEN || '').trim();

const store = createStore(process.env.DATA_DIR || './data', () => ({ tickets: [], events: [], fields: [], seq: { next: 1 } }));
const auth = bearerAuth(TOKEN);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' }));
app.use(requestId);
healthRouter(app, 'tickets');

const STATUS = ['open', 'pending', 'in-progress', 'resolved'];
const PRIORITY = ['low', 'medium', 'high', 'urgent'];
const norm = (val, list, def) => (list.includes((val || '').toLowerCase()) ? val.toLowerCase() : def);

function mapTicket(t, s) {
  const cf = {};
  const tl = [];
  (s.fields ?? []).filter((f) => f.ticketId === t.id).forEach((f) => {
    cf[f.key] = f.value;
  });
  (s.events ?? [])
    .filter((e) => e.ticketId === t.id)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .forEach((e) => tl.push({ at: e.at, type: e.type, message: e.message, actor: e.actor }));
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    channel: t.channel,
    customerName: t.customerName,
    customerEmail: t.customerEmail,
    department: t.department,
    chatwootAccountId: t.chatwootAccountId,
    chatwootConversationId: t.chatwootConversationId,
    tenantId: t.tenantId,
    customFields: cf,
    timeline: tl,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

async function tryCreateSla(ticket) {
  if (!SLA_URL) return;
  try {
    await fetch(`${SLA_URL}/v1/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(SLA_TOKEN ? { Authorization: `Bearer ${SLA_TOKEN}` } : {}) },
      body: JSON.stringify({ policyId: 1, chatwootAccountId: ticket.chatwootAccountId, ticketId: ticket.id }),
    });
  } catch (e) {
    log.warn({ err: e.message }, 'SLA create failed');
  }
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

app.get('/v1/tickets', async (req, res) => {
  const accountId = Number(req.query.chatwoot_account_id);
  if (!Number.isFinite(accountId)) return fail(res, 'VALIDATION_ERROR', 'chatwoot_account_id required');
  if (dbEnabled()) {
    try {
      const list = await ticketRepo.listTickets(accountId, { status: req.query.status });
      return ok(res, list);
    } catch (e) {
      log.error({ err: e.message }, 'list tickets');
      return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
    }
  }
  const s = store.load();
  let list = s.tickets.filter((t) => t.chatwootAccountId === accountId);
  if (req.query.status) list = list.filter((t) => t.status === req.query.status);
  ok(res, list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map((t) => mapTicket(t, s)));
});

app.get('/v1/tickets/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (dbEnabled()) {
    const t = await ticketRepo.getTicket(id);
    return t ? ok(res, t) : fail(res, 'NOT_FOUND', 'Ticket not found', 404);
  }
  const s = store.load();
  const t = s.tickets.find((x) => x.id === id);
  return t ? ok(res, mapTicket(t, s)) : fail(res, 'NOT_FOUND', 'Ticket not found', 404);
});

app.post('/v1/tickets', auth, async (req, res) => {
  const {
    title,
    chatwootAccountId,
    chatwootConversationId,
    channel = 'Chat',
    customerName = 'Unknown',
    customerEmail = '',
    department = 'Support',
    priority,
    status,
    customFields,
  } = req.body ?? {};
  if (!title?.trim()) return fail(res, 'VALIDATION_ERROR', 'title is required');
  if (!Number.isFinite(Number(chatwootAccountId))) return fail(res, 'VALIDATION_ERROR', 'chatwootAccountId is required');

  if (dbEnabled()) {
    try {
      const ticket = await ticketRepo.createTicket({
        title: title.trim(),
        chatwootAccountId: Number(chatwootAccountId),
        chatwootConversationId: chatwootConversationId ? Number(chatwootConversationId) : null,
        channel: (channel || 'Chat').slice(0, 80),
        customerName: (customerName || 'Unknown').slice(0, 200),
        customerEmail: (customerEmail || '').slice(0, 320),
        department: (department || 'Support').slice(0, 120),
        status: norm(status, STATUS, 'open'),
        priority: norm(priority, PRIORITY, 'medium'),
        customFields,
      });
      tryCreateSla(ticket);
      return ok(res, ticket, 201);
    } catch (e) {
      log.error({ err: e.message }, 'create ticket');
      return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
    }
  }

  const now = new Date().toISOString();
  try {
    const { ticket } = await store.withStore((s) => {
      const tid = s.seq.next++;
      const t = {
        id: tid,
        title: title.trim().slice(0, 500),
        status: norm(status, STATUS, 'open'),
        priority: norm(priority, PRIORITY, 'medium'),
        channel: (channel || 'Chat').slice(0, 80),
        customerName: (customerName || 'Unknown').slice(0, 200),
        customerEmail: (customerEmail || '').slice(0, 320),
        department: (department || 'Support').slice(0, 120),
        chatwootAccountId: Number(chatwootAccountId),
        chatwootConversationId: chatwootConversationId ? Number(chatwootConversationId) : null,
        tenantId: null,
        createdAt: now,
        updatedAt: now,
      };
      s.tickets.push(t);
      s.events = s.events ?? [];
      s.events.push({ ticketId: tid, at: now, type: 'created', message: 'Ticket created', actor: 'system' });
      if (customFields && typeof customFields === 'object') {
        s.fields = s.fields ?? [];
        for (const [k, v] of Object.entries(customFields)) s.fields.push({ ticketId: tid, key: k.slice(0, 120), value: v });
      }
      return { ticket: t };
    });
    tryCreateSla(ticket);
    ok(res, mapTicket(ticket, store.load()), 201);
  } catch (e) {
    log.error(e);
    fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.patch('/v1/tickets/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  if (dbEnabled()) {
    try {
      const t = await ticketRepo.updateTicket(id, req.body ?? {});
      return t ? ok(res, t) : fail(res, 'NOT_FOUND', 'Ticket not found', 404);
    } catch (e) {
      log.error({ err: e.message }, 'patch ticket');
      return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
    }
  }
  try {
    await store.withStore((s) => {
      const t = s.tickets.find((x) => x.id === id);
      if (!t) throw Object.assign(new Error(), { code: 404 });
      const { title, status, priority, department, assignedTo, customFields } = req.body ?? {};
      if (title?.trim()) t.title = title.trim().slice(0, 500);
      if (status) t.status = norm(status, STATUS, t.status);
      if (priority) t.priority = norm(priority, PRIORITY, t.priority);
      if (department) t.department = department.slice(0, 120);
      if (assignedTo) t.assignedTo = assignedTo.slice(0, 200);
      if (customFields && typeof customFields === 'object') {
        s.fields = s.fields ?? [];
        for (const [k, v] of Object.entries(customFields)) {
          const idx = s.fields.findIndex((f) => f.ticketId === t.id && f.key === k);
          if (idx >= 0) s.fields[idx].value = v;
          else s.fields.push({ ticketId: t.id, key: k.slice(0, 120), value: v });
        }
      }
      t.updatedAt = new Date().toISOString();
    });
    const s = store.load();
    const t = s.tickets.find((x) => x.id === id);
    ok(res, mapTicket(t, s));
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Ticket not found', 404);
    log.error(e);
    fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.post('/v1/tickets/:id/timeline', auth, async (req, res) => {
  const id = Number(req.params.id);
  const { type, message, actor = 'agent' } = req.body ?? {};
  if (!type?.trim() || !message?.trim()) return fail(res, 'VALIDATION_ERROR', 'type and message required');
  if (dbEnabled()) {
    try {
      const t = await ticketRepo.addTimeline(id, {
        type: type.trim().slice(0, 80),
        message: message.trim().slice(0, 2000),
        actor: actor.slice(0, 120),
      });
      return t ? ok(res, t, 201) : fail(res, 'NOT_FOUND', 'Ticket not found', 404);
    } catch (e) {
      log.error({ err: e.message }, 'timeline');
      return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
    }
  }
  try {
    await store.withStore((s) => {
      if (!s.tickets.find((x) => x.id === id)) throw Object.assign(new Error(), { code: 404 });
      s.events = s.events ?? [];
      s.events.push({
        ticketId: id,
        at: new Date().toISOString(),
        type: type.trim().slice(0, 80),
        message: message.trim().slice(0, 2000),
        actor: actor.slice(0, 120),
      });
    });
    const s = store.load();
    ok(res, mapTicket(s.tickets.find((x) => x.id === id), s), 201);
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Ticket not found', 404);
    log.error(e);
    fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.use(errorHandler(log));

async function main() {
  if (dbEnabled()) {
    await runMigrations(log);
    log.info('Postgres tickets enabled');
  }
  const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT, db: dbEnabled() }, 'tickets started'));
  process.on('SIGTERM', async () => {
    await closePool();
    server.close(() => process.exit(0));
  });
  gracefulShutdown(server, log);
}

main().catch((e) => {
  log.error(e);
  process.exit(1);
});
