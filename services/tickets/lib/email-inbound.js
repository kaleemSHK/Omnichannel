/**
 * Inbound email handler — Sprint 2 E01
 *
 * Normalises webhook payloads from multiple providers into a common
 * EmailMessage shape, then threads the message into the tickets system:
 *
 *   1. Extract Message-ID, In-Reply-To, References from the payload.
 *   2. Look up known IDs in email_threads — if a match is found, append
 *      a timeline entry to the linked ticket.
 *   3. If no match, create a new ticket (channel='Email') and record the
 *      thread root.
 *   4. Return { ticketId, action: 'threaded'|'created', thread }.
 *
 * Supported payload shapes (EMAIL_INBOUND_FORMAT env var):
 *   generic   — our own normalised format (default)
 *   mailgun   — Mailgun inbound routing (multipart/form-data parsed fields)
 *   sendgrid  — SendGrid Inbound Parse
 *   resend    — Resend inbound webhook
 *
 * Payload normalisation is intentionally lenient — all fields are optional
 * so that test and demo calls can be made with minimal JSON.
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from './logger.js';
import * as emailRepo from './email-repo.js';
import * as ticketRepo from './ticket-repo.js';
import { dbEnabled } from './db.js';
import { createStore } from './store.js';

const log = createLogger('email-inbound');
const FORMAT = (process.env.EMAIL_INBOUND_FORMAT || 'generic').toLowerCase();
const fileStore = createStore(process.env.DATA_DIR || './data', () => ({ tickets: [], events: [], fields: [], seq: { next: 1 } }));

// ─── Normaliser helpers ───────────────────────────────────────────────────────

/** Strip and normalise a Message-ID to ensure angle brackets. */
function normaliseMessageId(raw) {
  if (!raw) return null;
  const s = raw.trim();
  return s.startsWith('<') ? s : `<${s}>`;
}

/** Split a References header string into an array of message IDs. */
function parseReferences(raw) {
  if (!raw) return [];
  return raw.match(/<[^>]+>/g) ?? raw.split(/\s+/).filter(Boolean).map(normaliseMessageId).filter(Boolean);
}

/** Extract plain-text body — prefer explicit text, fall back to stripping HTML. */
function plainBody(text, html) {
  if (text) return text.slice(0, 8192);
  if (html) return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8192);
  return '';
}

// ─── Provider-specific normalisers ───────────────────────────────────────────

function normaliseGeneric(body) {
  return {
    messageId:   normaliseMessageId(body.message_id ?? body.messageId),
    inReplyTo:   normaliseMessageId(body.in_reply_to ?? body.inReplyTo),
    references:  parseReferences(body.references),
    fromEmail:   (body.from ?? body.from_email ?? '').trim() || null,
    fromName:    (body.from_name ?? body.fromName ?? '').trim() || null,
    toEmail:     (body.to ?? body.to_email ?? '').trim() || null,
    subject:     (body.subject ?? '(no subject)').trim(),
    text:        plainBody(body.text ?? body.body, body.html),
  };
}

function normaliseMailgun(body) {
  // Mailgun inbound: fields are top-level strings with header map under
  // `message-headers` (JSON string of [[k,v],...]).
  let headers = {};
  try { const arr = JSON.parse(body['message-headers'] ?? '[]'); headers = Object.fromEntries(arr); } catch { /* ignore */ }
  return {
    messageId:   normaliseMessageId(headers['Message-Id'] ?? headers['Message-ID'] ?? body['Message-Id']),
    inReplyTo:   normaliseMessageId(headers['In-Reply-To'] ?? body['In-Reply-To']),
    references:  parseReferences(headers['References'] ?? body['References']),
    fromEmail:   (body.sender ?? body.from ?? '').replace(/.*<|>.*/g, '').trim() || null,
    fromName:    (body.from ?? '').replace(/<.*/, '').trim() || null,
    toEmail:     (body.recipient ?? body.To ?? '').trim() || null,
    subject:     (body.subject ?? body.Subject ?? '(no subject)').trim(),
    text:        plainBody(body['body-plain'], body['body-html']),
  };
}

function normaliseSendgrid(body) {
  // SendGrid Inbound Parse delivers form fields
  return {
    messageId:   normaliseMessageId(body.headers?.match(/^Message-ID:\s*(.+)$/im)?.[1]),
    inReplyTo:   normaliseMessageId(body.headers?.match(/^In-Reply-To:\s*(.+)$/im)?.[1]),
    references:  parseReferences(body.headers?.match(/^References:\s*(.+)$/im)?.[1]),
    fromEmail:   (body.from ?? '').replace(/.*<|>.*/g, '').trim() || null,
    fromName:    (body.from ?? '').replace(/<.*/, '').trim() || null,
    toEmail:     (body.to ?? '').trim() || null,
    subject:     (body.subject ?? '(no subject)').trim(),
    text:        plainBody(body.text, body.html),
  };
}

function normaliseResend(body) {
  // Resend webhook: { type: 'email.received', data: { ... } }
  const d = body.data ?? body;
  return {
    messageId:   normaliseMessageId(d.message_id ?? d.headers?.['message-id']),
    inReplyTo:   normaliseMessageId(d.headers?.['in-reply-to']),
    references:  parseReferences(d.headers?.references),
    fromEmail:   (d.from ?? '').replace(/.*<|>.*/g, '').trim() || null,
    fromName:    (d.from ?? '').replace(/<.*/, '').trim() || null,
    toEmail:     (Array.isArray(d.to) ? d.to[0] : d.to ?? '').trim() || null,
    subject:     (d.subject ?? '(no subject)').trim(),
    text:        plainBody(d.text, d.html),
  };
}

const NORMALISERS = { generic: normaliseGeneric, mailgun: normaliseMailgun, sendgrid: normaliseSendgrid, resend: normaliseResend };

function normalise(rawBody) {
  const fn = NORMALISERS[FORMAT] ?? normaliseGeneric;
  return fn(rawBody);
}

// ─── Core threading logic ─────────────────────────────────────────────────────

/**
 * Process a single inbound email for a tenant.
 *
 * @param {string|number} tenantId   - tenant / chatwoot account ID
 * @param {object}        rawBody    - raw webhook payload (provider-specific)
 * @returns {Promise<{ ticketId: number, action: 'threaded'|'created', thread: object }>}
 */
export async function handleInboundEmail(tenantId, rawBody) {
  const msg = normalise(rawBody);

  // Ensure we have a stable message ID — generate a synthetic one if missing
  if (!msg.messageId) {
    msg.messageId = `<inbound-${randomUUID()}@blinkone.io>`;
  }

  log.info({ messageId: msg.messageId, inReplyTo: msg.inReplyTo, subject: msg.subject }, 'inbound email');

  // Collect all known IDs from this message for thread lookup
  const lookupIds = [
    msg.inReplyTo,
    ...msg.references,
  ].filter(Boolean);

  // Check for existing thread
  const existing = await emailRepo.findThreadForReferences(lookupIds);

  if (existing) {
    // ─── Thread an existing ticket ──────────────────────────────────────────
    const { ticketId } = existing;
    const timelineEntry = {
      type:    'email_inbound',
      message: buildTimelineMessage(msg),
      actor:   msg.fromEmail ?? 'customer',
    };

    if (dbEnabled()) {
      await ticketRepo.addTimeline(ticketId, timelineEntry);
    } else {
      await fileStore.withStore((s) => {
        s.events = s.events ?? [];
        s.events.push({ ticketId, at: new Date().toISOString(), ...timelineEntry });
      });
    }

    const thread = await emailRepo.insertThread({
      ticketId,
      messageId: msg.messageId,
      inReplyTo: msg.inReplyTo,
      references: msg.references,
      direction: 'inbound',
      subject: msg.subject,
      fromEmail: msg.fromEmail,
      fromName: msg.fromName,
      toEmail: msg.toEmail,
      bodyText: msg.text,
    });

    log.info({ ticketId, messageId: msg.messageId }, 'email threaded to existing ticket');
    return { ticketId, action: 'threaded', thread };
  }

  // ─── Create a new ticket ──────────────────────────────────────────────────
  const title = buildTitle(msg.subject);
  const accountId = Number(tenantId) || 0;

  let ticket;
  if (dbEnabled()) {
    ticket = await ticketRepo.createTicket({
      tenantId:          String(tenantId),
      chatwootAccountId: accountId,
      title,
      channel:           'Email',
      customerEmail:     msg.fromEmail ?? '',
      customerName:      msg.fromName  ?? (msg.fromEmail ? msg.fromEmail.split('@')[0] : 'Email Customer'),
      department:        'Support',
      status:            'open',
      priority:          'medium',
    });
  } else {
    const now = new Date().toISOString();
    ticket = await fileStore.withStore((s) => {
      const t = {
        id:                    s.seq.next++,
        title,
        status:                'open',
        priority:              'medium',
        channel:               'Email',
        customerEmail:         msg.fromEmail ?? '',
        customerName:          msg.fromName ?? 'Email Customer',
        department:            'Support',
        tenantId:              String(tenantId),
        chatwootAccountId:     accountId,
        chatwootConversationId: null,
        createdAt:             now,
        updatedAt:             now,
      };
      s.tickets = s.tickets ?? [];
      s.tickets.push(t);
      s.events = s.events ?? [];
      s.events.push({
        ticketId: t.id,
        at: now,
        type: 'email_inbound',
        message: buildTimelineMessage(msg),
        actor: msg.fromEmail ?? 'customer',
      });
      return t;
    });
  }

  const thread = await emailRepo.insertThread({
    ticketId:   ticket.id,
    messageId:  msg.messageId,
    inReplyTo:  msg.inReplyTo,
    references: msg.references,
    direction:  'inbound',
    subject:    msg.subject,
    fromEmail:  msg.fromEmail,
    fromName:   msg.fromName,
    toEmail:    msg.toEmail,
    bodyText:   msg.text,
  });

  log.info({ ticketId: ticket.id, messageId: msg.messageId }, 'email created new ticket');
  return { ticketId: ticket.id, action: 'created', thread, ticket };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTitle(subject) {
  // Strip common reply prefix and trailing noise
  const s = (subject ?? '(no subject)')
    .replace(/^(re|fwd|fw|aw|wg):\s*/i, '')
    .trim()
    .slice(0, 255);
  return s || '(no subject)';
}

function buildTimelineMessage(msg) {
  const header = msg.fromName
    ? `From: ${msg.fromName} <${msg.fromEmail}>`
    : `From: ${msg.fromEmail ?? 'unknown'}`;
  const preview = (msg.text ?? '').trim().slice(0, 500);
  return `${header}\nSubject: ${msg.subject}\n\n${preview}`;
}
