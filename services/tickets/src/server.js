import { randomUUID } from 'node:crypto';
import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { mountMetrics, registry } from '../_shared/lib/metrics-middleware.js';
import { dbEnabled, runMigrations, closePool, getPool } from '../lib/db.js';
import * as ticketRepo from '../lib/ticket-repo.js';
import * as fieldDefRepo from '../lib/field-def-repo.js';
import { resolveTenantId, resolveAccountId } from '../lib/tenant.js';
import {
  onTicketCreated,
  onTicketStatusChanged,
  onTicketReplied,
  mapChatwootMessageType,
} from '../lib/chatwoot-sync.js';
import { handleInboundEmail } from '../lib/email-inbound.js';
import * as emailRepo from '../lib/email-repo.js';
import { sendEmail, emailProvider } from '../lib/email-sender.js';

const log = createLogger('tickets');
const PORT = parseInt(process.env.PORT || '8791', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const SLA_URL = (process.env.SLA_URL || 'http://sla:8796').replace(/\/$/, '');
const SLA_TOKEN = (process.env.SLA_TOKEN || '').trim();
const EMAIL_INBOUND_SECRET = (process.env.EMAIL_INBOUND_SECRET || '').trim();
const EMAIL_DOMAIN = (process.env.EMAIL_DOMAIN || 'blinkone.io').trim();

const store = createStore(process.env.DATA_DIR || './data', () => ({ tickets: [], events: [], fields: [], seq: { next: 1 } }));
const auth = bearerAuth(TOKEN);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' }));
app.use(requestId);
healthRouter(app, 'tickets');
mountMetrics(app, 'tickets');

// ─── Domain metrics ──────────────────────────────────────────────────────────
const ticketsTotal = registry.counter('blinkone_tickets_total', 'Total tickets created', ['tenant', 'status']);

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
  const accountId = resolveAccountId(req);
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
  const accountId = Number.isFinite(Number(chatwootAccountId))
    ? Number(chatwootAccountId)
    : resolveAccountId(req);
  if (!Number.isFinite(accountId)) return fail(res, 'VALIDATION_ERROR', 'chatwootAccountId is required');

  if (dbEnabled()) {
    try {
      const ticket = await ticketRepo.createTicket({
        title: title.trim(),
        chatwootAccountId: accountId,
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
      ticketsTotal.inc({ tenant: String(accountId), status: ticket.status ?? 'open' });
      // T01: mirror ticket creation to Chatwoot conversation
      setImmediate(() => onTicketCreated(ticket));
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
        chatwootAccountId: accountId,
        chatwootConversationId: chatwootConversationId ? Number(chatwootConversationId) : null,
        tenantId: resolveTenantId(req),
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
    ticketsTotal.inc({ tenant: String(accountId), status: ticket.status ?? 'open' });
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
      const existing = await ticketRepo.getTicket(id);
      const t = await ticketRepo.updateTicket(id, req.body ?? {});
      if (!t) return fail(res, 'NOT_FOUND', 'Ticket not found', 404);
      // T01: sync status change to Chatwoot conversation
      if (req.body?.status && existing?.status !== req.body.status) {
        const actor = req.headers['x-blinkone-user-id'] ?? 'agent';
        setImmediate(() => onTicketStatusChanged(t, t.status, actor));
      }
      return ok(res, t);
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
      if (!t) return fail(res, 'NOT_FOUND', 'Ticket not found', 404);
      // T01: mirror agent replies to Chatwoot conversation (private note)
      if (type === 'comment' || type === 'reply') {
        setImmediate(() => onTicketReplied(t, message.trim(), actor));
      }
      return ok(res, t, 201);
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

// ─── Conversation Link — Sprint 2 T01 ─────────────────────────────────────────

/**
 * GET /v1/tickets/by-conversation/:conversationId
 * Find the ticket linked to a given Chatwoot conversation.
 * Used by the frontend to surface tickets inside the conversation view.
 */
app.get('/v1/tickets/by-conversation/:conversationId', auth, async (req, res) => {
  const accountId = resolveAccountId(req);
  const conversationId = Number(req.params.conversationId);
  if (!Number.isFinite(conversationId)) return fail(res, 'VALIDATION_ERROR', 'conversationId must be a number');

  if (dbEnabled()) {
    try {
      const t = await ticketRepo.getTicketByConversationId(accountId, conversationId);
      return t ? ok(res, t) : fail(res, 'NOT_FOUND', 'No ticket linked to this conversation', 404);
    } catch (e) {
      log.error({ err: e.message }, 'by-conversation');
      return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
    }
  }

  // File-store fallback
  const s = store.load();
  const t = s.tickets.find(
    (x) => x.chatwootAccountId === accountId && Number(x.chatwootConversationId) === conversationId,
  );
  return t ? ok(res, mapTicket(t, s)) : fail(res, 'NOT_FOUND', 'No ticket linked to this conversation', 404);
});

/**
 * PATCH /v1/tickets/:id/link-conversation
 * Body: { conversationId: number }
 * Link (or re-link) a ticket to a Chatwoot conversation and post a sync note.
 */
app.patch('/v1/tickets/:id/link-conversation', auth, async (req, res) => {
  const id = Number(req.params.id);
  const conversationId = Number(req.body?.conversationId);
  if (!Number.isFinite(conversationId)) return fail(res, 'VALIDATION_ERROR', 'conversationId required');

  if (dbEnabled()) {
    try {
      const t = await ticketRepo.setConversationLink(id, conversationId);
      if (!t) return fail(res, 'NOT_FOUND', 'Ticket not found', 404);
      setImmediate(() => onTicketCreated(t)); // post link note to conversation
      return ok(res, t);
    } catch (e) {
      log.error({ err: e.message }, 'link-conversation');
      return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
    }
  }

  // File-store fallback
  try {
    let ticket = null;
    await store.withStore((s) => {
      const t = s.tickets.find((x) => x.id === id);
      if (!t) throw Object.assign(new Error(), { code: 404 });
      t.chatwootConversationId = conversationId;
      t.updatedAt = new Date().toISOString();
      ticket = t;
    });
    const s = store.load();
    const t = s.tickets.find((x) => x.id === id);
    const mapped = mapTicket(t, s);
    if (ticket) setImmediate(() => onTicketCreated(mapped));
    return ok(res, mapped);
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Ticket not found', 404);
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

/**
 * POST /v1/webhooks/chatwoot
 * Receives fan-out events from the gateway for conversation-linked tickets.
 * Events handled:
 *   - message_created (incoming customer message → append to ticket timeline)
 *   - conversation_status_changed → resolved (mark linked ticket resolved)
 */
app.post('/v1/webhooks/chatwoot', express.json({ limit: '512kb' }), async (req, res) => {
  // Always respond 200 immediately — process async
  res.status(200).json({ ok: true });

  const body = req.body ?? {};
  const event = body.event;
  const accountId = Number(body.account?.id ?? body.chatwootAccountId ?? 0);
  const conversationId = Number(body.conversation?.id ?? body.conversationId ?? 0);

  if (!accountId || !conversationId) return;

  setImmediate(async () => {
    try {
      // Find linked ticket
      let ticket = null;
      if (dbEnabled()) {
        ticket = await ticketRepo.getTicketByConversationId(accountId, conversationId);
      } else {
        const s = store.load();
        const t = s.tickets.find(
          (x) => x.chatwootAccountId === accountId && Number(x.chatwootConversationId) === conversationId,
        );
        ticket = t ? mapTicket(t, s) : null;
      }
      if (!ticket) return; // no linked ticket — nothing to do

      // message_created: mirror incoming customer message to ticket timeline
      if (event === 'message_created') {
        const msg = body.message ?? body;
        const msgType = msg.message_type;
        // Only mirror incoming customer messages (type 0) — outgoing we already handle via reply mirror
        if (msgType !== 0) return;
        const content = String(msg.content ?? '').slice(0, 2000);
        const senderName = msg.sender?.name ?? msg.sender_name ?? 'Customer';
        if (!content) return;

        const timelineEntry = {
          type: mapChatwootMessageType(msg),
          message: `[${senderName}]: ${content}`,
          actor: 'customer',
        };

        if (dbEnabled()) {
          await ticketRepo.addTimeline(ticket.id, timelineEntry);
        } else {
          await store.withStore((s) => {
            s.events = s.events ?? [];
            s.events.push({ ticketId: ticket.id, at: new Date().toISOString(), ...timelineEntry });
          });
        }
        log.info({ ticketId: ticket.id, conversationId }, 'customer message mirrored to ticket');
      }

      // conversation_status_changed → resolved: close the ticket
      if (event === 'conversation_status_changed' && (body.status === 'resolved' || body.conversation?.status === 'resolved')) {
        if (ticket.status === 'resolved') return; // already resolved

        if (dbEnabled()) {
          await ticketRepo.updateTicket(ticket.id, { status: 'resolved' });
        } else {
          await store.withStore((s) => {
            const t = s.tickets.find((x) => x.id === ticket.id);
            if (t) { t.status = 'resolved'; t.updatedAt = new Date().toISOString(); }
          });
        }
        log.info({ ticketId: ticket.id, conversationId }, 'ticket auto-resolved via conversation');
      }
    } catch (e) {
      log.warn({ err: e.message, event, accountId, conversationId }, 'webhook processing failed');
    }
  });
});

// ─── Custom field definitions (tenant-scoped) ─────────────────────────────────
app.get('/v1/fields', auth, async (req, res) => {
  if (!dbEnabled()) return ok(res, []);
  const tenantId = resolveTenantId(req);
  try {
    const rows = await fieldDefRepo.listFieldDefinitions(tenantId);
    return ok(res, rows);
  } catch (e) {
    log.error({ err: e.message }, 'list fields');
    return fail(res, 'INTERNAL_ERROR', 'Failed to list fields', 500);
  }
});

app.post('/v1/fields', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres not configured', 503);
  const tenantId = resolveTenantId(req);
  const { field_key, label, field_type, options, required, sort_order } = req.body ?? {};
  if (!field_key || !label || !field_type) {
    return fail(res, 'VALIDATION_ERROR', 'field_key, label, and field_type are required');
  }
  try {
    const row = await fieldDefRepo.createFieldDefinition(tenantId, {
      field_key: String(field_key).trim().slice(0, 120),
      label: String(label).trim().slice(0, 200),
      field_type: String(field_type),
      options: options ?? null,
      required: required ?? false,
      sort_order: sort_order ?? 0,
    });
    return ok(res, row, 201);
  } catch (e) {
    if (e.code === '23505') return fail(res, 'CONFLICT', 'Field key already exists', 409);
    log.error({ err: e.message }, 'create field');
    return fail(res, 'INTERNAL_ERROR', 'Failed to create field', 500);
  }
});

app.delete('/v1/fields/:id', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres not configured', 503);
  const tenantId = resolveTenantId(req);
  try {
    await fieldDefRepo.deleteFieldDefinition(tenantId, req.params.id);
    return ok(res, { deleted: true });
  } catch (e) {
    log.error({ err: e.message }, 'delete field');
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete field', 500);
  }
});

// ─── Email threading — Sprint 2 E01 ──────────────────────────────────────────

/**
 * POST /v1/webhooks/email
 * Inbound email webhook — receives messages from Mailgun/SendGrid/Resend/etc.
 * Protected by EMAIL_INBOUND_SECRET bearer token (skip check if not set — dev).
 * Always responds 200 immediately; processing is synchronous but logged on error.
 */
app.post('/v1/webhooks/email', express.json({ limit: '2mb' }), express.urlencoded({ extended: true, limit: '2mb' }), async (req, res) => {
  // Verify inbound secret (best-effort — skip in dev if not configured)
  if (EMAIL_INBOUND_SECRET) {
    const auth = (req.headers.authorization ?? '').replace(/^bearer\s+/i, '');
    if (auth !== EMAIL_INBOUND_SECRET) {
      return fail(res, 'UNAUTHORIZED', 'Invalid inbound secret', 401);
    }
  }

  const tenantId = resolveTenantId(req);
  try {
    const result = await handleInboundEmail(tenantId, req.body ?? {});
    return ok(res, {
      ticketId: result.ticketId,
      action:   result.action,
      messageId: result.thread?.messageId,
    });
  } catch (e) {
    log.error({ err: e.message }, 'email inbound failed');
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

/**
 * GET /v1/tickets/:id/email-threads
 * Returns all email thread entries for a ticket (inbound + outbound), oldest first.
 */
app.get('/v1/tickets/:id/email-threads', auth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const threads = await emailRepo.listForTicket(id);
    return ok(res, threads);
  } catch (e) {
    log.error({ err: e.message }, 'list email threads');
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

/**
 * POST /v1/tickets/:id/reply-email
 * Agent sends an email reply to the customer on the ticket thread.
 *
 * Body:
 *   text     {string}  — plain-text reply body (required)
 *   html     {string?} — HTML body (optional)
 *   subject  {string?} — overrides auto-generated subject
 *   to       {string?} — override recipient (defaults to ticket.customerEmail)
 */
app.post('/v1/tickets/:id/reply-email', auth, async (req, res) => {
  const id = Number(req.params.id);
  const { text, html, subject: subjectOverride, to: toOverride } = req.body ?? {};
  if (!text?.trim()) return fail(res, 'VALIDATION_ERROR', 'text required');

  // Load ticket
  let ticket = null;
  if (dbEnabled()) {
    ticket = await ticketRepo.getTicket(id);
  } else {
    const s = store.load();
    const t = s.tickets.find((x) => x.id === id);
    if (t) ticket = mapTicket(t, s);
  }
  if (!ticket) return fail(res, 'NOT_FOUND', 'Ticket not found', 404);

  const toEmail = (toOverride ?? ticket.customerEmail ?? '').trim();
  if (!toEmail) return fail(res, 'VALIDATION_ERROR', 'No recipient email — set ticket.customerEmail or pass to in body');

  // Build RFC 2822 headers for threading
  const threads = await emailRepo.listForTicket(id);
  const lastInbound = [...threads].reverse().find((t) => t.direction === 'inbound');
  const lastMsg     = threads[threads.length - 1];

  const inReplyTo = lastMsg?.messageId ?? null;
  // Build References: chain of all prior message IDs (max 10) + the direct in-reply-to
  const refIds = threads.map((t) => t.messageId).filter(Boolean).slice(-10);
  const references = refIds.length ? refIds.join(' ') : null;

  const subject = subjectOverride
    ?? (lastInbound?.subject ? `Re: ${lastInbound.subject.replace(/^Re:\s*/i, '')}` : `Re: ${ticket.title}`);
  const newMessageId = `<ticket-${id}-reply-${randomUUID()}@${EMAIL_DOMAIN}>`;

  try {
    await sendEmail({
      to:          toEmail,
      toName:      ticket.customerName ?? '',
      subject,
      text:        text.trim(),
      html:        html ?? undefined,
      messageId:   newMessageId,
      inReplyTo:   inReplyTo ?? undefined,
      references:  references ?? undefined,
    });
  } catch (e) {
    log.error({ err: e.message, ticketId: id }, 'email reply send failed');
    return fail(res, 'EMAIL_SEND_ERROR', e.message, 502);
  }

  // Record in thread table
  const thread = await emailRepo.insertThread({
    ticketId:   id,
    messageId:  newMessageId,
    inReplyTo,
    references: refIds,
    direction:  'outbound',
    subject,
    fromEmail:  process.env.SMTP_FROM ?? process.env.EMAIL_FROM ?? null,
    toEmail,
    bodyText:   text.trim().slice(0, 8192),
  });

  // Add timeline entry
  const actor = req.headers['x-blinkone-user-id'] ?? 'agent';
  const timelineEntry = {
    type:    'email_reply',
    message: `[${actor}]: ${text.trim().slice(0, 500)}`,
    actor:   String(actor),
  };
  if (dbEnabled()) {
    await ticketRepo.addTimeline(id, timelineEntry);
  } else {
    await store.withStore((s) => {
      s.events = s.events ?? [];
      s.events.push({ ticketId: id, at: new Date().toISOString(), ...timelineEntry });
    });
  }

  // Mirror to Chatwoot if linked
  setImmediate(() => onTicketReplied(ticket, text.trim(), actor));

  return ok(res, {
    sent:      true,
    messageId: newMessageId,
    provider:  emailProvider,
    thread,
  });
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
