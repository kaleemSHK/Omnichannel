/**
 * Email thread repository — Sprint 2 E01
 *
 * Stores RFC 2822 message IDs → ticket mapping so that inbound replies
 * can be threaded back to the correct ticket.
 *
 * In file-store mode (no BLINKONE_DATABASE_URL) a simple in-process Map
 * is used as a lightweight stand-in. It doesn't survive restarts but is
 * sufficient for local development and demos.
 */

import { dbEnabled, getPool } from './db.js';

// ─── In-process file-store fallback ──────────────────────────────────────────
// Map<messageId, row>  +  Map<ticketId, row[]>
const _byMsgId  = new Map();
const _byTicket = new Map();
let   _nextId   = 1;

function _storeInsert(row) {
  _byMsgId.set(row.messageId, row);
  const list = _byTicket.get(row.ticketId) ?? [];
  list.push(row);
  _byTicket.set(row.ticketId, list);
  return row;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function mapRow(r) {
  return {
    id:          Number(r.id),
    ticketId:    Number(r.ticket_id),
    messageId:   r.message_id,
    inReplyTo:   r.in_reply_to ?? null,
    references:  r.references ?? [],
    direction:   r.direction,
    subject:     r.subject ?? null,
    fromEmail:   r.from_email ?? null,
    fromName:    r.from_name ?? null,
    toEmail:     r.to_email ?? null,
    bodyText:    r.body_text ?? null,
    createdAt:   r.created_at?.toISOString?.() ?? r.created_at,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Find a thread row by its exact Message-ID.
 */
export async function findByMessageId(messageId) {
  if (!messageId) return null;
  if (!dbEnabled()) return _byMsgId.get(messageId) ?? null;
  const { rows } = await getPool().query(
    'SELECT * FROM email_threads WHERE message_id = $1 LIMIT 1',
    [messageId],
  );
  return rows.length ? mapRow(rows[0]) : null;
}

/**
 * Given an ordered list of RFC 2822 message IDs (from the References header,
 * or [inReplyTo]), return the first thread row we have on record.
 * Returns { thread, ticketId } or null.
 */
export async function findThreadForReferences(refs) {
  if (!refs?.length) return null;

  if (!dbEnabled()) {
    for (const id of refs) {
      const row = _byMsgId.get(id);
      if (row) return { thread: row, ticketId: row.ticketId };
    }
    return null;
  }

  // Single query — ANY($1::text[]) hits all refs at once
  const { rows } = await getPool().query(
    `SELECT * FROM email_threads
     WHERE message_id = ANY($1::text[]) OR in_reply_to = ANY($1::text[])
     ORDER BY created_at ASC LIMIT 1`,
    [refs],
  );
  if (!rows.length) return null;
  const thread = mapRow(rows[0]);
  return { thread, ticketId: thread.ticketId };
}

/**
 * List all email thread entries for a ticket, ordered oldest-first.
 */
export async function listForTicket(ticketId) {
  if (!dbEnabled()) return (_byTicket.get(Number(ticketId)) ?? []).slice();
  const { rows } = await getPool().query(
    'SELECT * FROM email_threads WHERE ticket_id = $1 ORDER BY created_at ASC',
    [ticketId],
  );
  return rows.map(mapRow);
}

/**
 * Insert a new email thread row.
 * @param {object} data
 * @param {number} data.ticketId
 * @param {string} data.messageId   - RFC 2822 Message-ID
 * @param {string} [data.inReplyTo] - In-Reply-To header
 * @param {string[]} [data.references] - References header array
 * @param {'inbound'|'outbound'} data.direction
 * @param {string} [data.subject]
 * @param {string} [data.fromEmail]
 * @param {string} [data.fromName]
 * @param {string} [data.toEmail]
 * @param {string} [data.bodyText]
 * @returns {Promise<object>} inserted row
 */
export async function insertThread(data) {
  const {
    ticketId, messageId, inReplyTo = null, references = [],
    direction = 'inbound',
    subject = null, fromEmail = null, fromName = null,
    toEmail = null, bodyText = null,
  } = data;

  if (!dbEnabled()) {
    const row = {
      id: _nextId++,
      ticketId: Number(ticketId),
      messageId,
      inReplyTo,
      references,
      direction,
      subject,
      fromEmail,
      fromName,
      toEmail,
      bodyText: bodyText ? bodyText.slice(0, 8192) : null,
      createdAt: new Date().toISOString(),
    };
    return _storeInsert(row);
  }

  const { rows } = await getPool().query(
    `INSERT INTO email_threads
       (ticket_id, message_id, in_reply_to, references, direction,
        subject, from_email, from_name, to_email, body_text)
     VALUES ($1,$2,$3,$4::text[],$5,$6,$7,$8,$9,LEFT($10,8192))
     ON CONFLICT (message_id) DO NOTHING
     RETURNING *`,
    [
      ticketId, messageId, inReplyTo, references, direction,
      subject, fromEmail, fromName, toEmail, bodyText ?? null,
    ],
  );
  // ON CONFLICT DO NOTHING may return 0 rows — fetch the existing one
  if (!rows.length) {
    const { rows: existing } = await getPool().query(
      'SELECT * FROM email_threads WHERE message_id = $1',
      [messageId],
    );
    return existing.length ? mapRow(existing[0]) : null;
  }
  return mapRow(rows[0]);
}
