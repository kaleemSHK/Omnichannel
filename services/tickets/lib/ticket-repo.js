import { getPool } from './db.js';

function mapRow(row, events = [], fields = []) {
  const cf = {};
  for (const f of fields) cf[f.key] = f.value;
  return {
    id: Number(row.id),
    title: row.title,
    status: row.status,
    priority: row.priority,
    channel: row.channel,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    department: row.department,
    assignedTo: row.assigned_to,
    chatwootAccountId: Number(row.chatwoot_account_id),
    chatwootConversationId: row.chatwoot_conversation_id != null ? Number(row.chatwoot_conversation_id) : null,
    tenantId: row.tenant_id,
    customFields: cf,
    timeline: events.map((e) => ({
      at: e.at?.toISOString?.() ?? e.at,
      type: e.type,
      message: e.message,
      actor: e.actor,
    })),
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

async function loadExtras(ticketId) {
  const p = getPool();
  const [ev, fi] = await Promise.all([
    p.query('SELECT * FROM ticket_events WHERE ticket_id = $1 ORDER BY at', [ticketId]),
    p.query('SELECT * FROM ticket_fields WHERE ticket_id = $1', [ticketId]),
  ]);
  return { events: ev.rows, fields: fi.rows };
}

export async function listTickets(accountId, { status } = {}) {
  const p = getPool();
  let sql = 'SELECT * FROM tickets WHERE chatwoot_account_id = $1';
  const params = [accountId];
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  sql += ' ORDER BY updated_at DESC LIMIT 500';
  const { rows } = await p.query(sql, params);
  const out = [];
  for (const row of rows) {
    const { events, fields } = await loadExtras(row.id);
    out.push(mapRow(row, events, fields));
  }
  return out;
}

export async function getTicket(id) {
  const p = getPool();
  const { rows } = await p.query('SELECT * FROM tickets WHERE id = $1', [id]);
  if (!rows.length) return null;
  const { events, fields } = await loadExtras(id);
  return mapRow(rows[0], events, fields);
}

export async function createTicket(body) {
  const p = getPool();
  const now = new Date();
  const { rows } = await p.query(
    `INSERT INTO tickets (
       tenant_id, title, status, priority, channel, customer_name, customer_email,
       department, chatwoot_account_id, chatwoot_conversation_id, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
     RETURNING *`,
    [
      body.tenantId ?? String(body.chatwootAccountId),
      body.title,
      body.status,
      body.priority,
      body.channel,
      body.customerName,
      body.customerEmail,
      body.department,
      body.chatwootAccountId,
      body.chatwootConversationId ?? null,
      now,
    ],
  );
  const ticket = rows[0];
  await p.query(
    `INSERT INTO ticket_events (ticket_id, at, type, message, actor) VALUES ($1,$2,'created','Ticket created','system')`,
    [ticket.id, now],
  );
  if (body.customFields && typeof body.customFields === 'object') {
    for (const [key, value] of Object.entries(body.customFields)) {
      await p.query(
        'INSERT INTO ticket_fields (ticket_id, key, value) VALUES ($1,$2,$3) ON CONFLICT (ticket_id, key) DO UPDATE SET value = $3',
        [ticket.id, key.slice(0, 120), String(value)],
      );
    }
  }
  return getTicket(ticket.id);
}

export async function updateTicket(id, body) {
  const p = getPool();
  const existing = await getTicket(id);
  if (!existing) return null;
  const sets = [];
  const params = [];
  const add = (col, val) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (body.title?.trim()) add('title', body.title.trim().slice(0, 500));
  if (body.status) add('status', body.status);
  if (body.priority) add('priority', body.priority);
  if (body.department) add('department', body.department.slice(0, 120));
  if (body.assignedTo) add('assigned_to', body.assignedTo.slice(0, 200));
  add('updated_at', new Date());
  if (sets.length > 1) {
    params.push(id);
    await p.query(`UPDATE tickets SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  }
  if (body.customFields && typeof body.customFields === 'object') {
    for (const [key, value] of Object.entries(body.customFields)) {
      await p.query(
        'INSERT INTO ticket_fields (ticket_id, key, value) VALUES ($1,$2,$3) ON CONFLICT (ticket_id, key) DO UPDATE SET value = $3',
        [id, key.slice(0, 120), String(value)],
      );
    }
  }
  return getTicket(id);
}

/**
 * Find a ticket by Chatwoot conversation ID (Sprint 2 T01).
 * Returns the latest ticket for the given conversation, or null if none.
 */
export async function getTicketByConversationId(accountId, conversationId) {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT * FROM tickets
     WHERE chatwoot_account_id = $1 AND chatwoot_conversation_id = $2
     ORDER BY updated_at DESC LIMIT 1`,
    [accountId, conversationId],
  );
  if (!rows.length) return null;
  const { events, fields } = await loadExtras(rows[0].id);
  return mapRow(rows[0], events, fields);
}

/**
 * Link (or re-link) a ticket to a Chatwoot conversation (Sprint 2 T01).
 */
export async function setConversationLink(ticketId, conversationId) {
  const p = getPool();
  await p.query(
    `UPDATE tickets SET chatwoot_conversation_id = $1, updated_at = now() WHERE id = $2`,
    [conversationId, ticketId],
  );
  return getTicket(ticketId);
}

export async function addTimeline(id, { type, message, actor }) {
  const p = getPool();
  const t = await getTicket(id);
  if (!t) return null;
  await p.query(
    'INSERT INTO ticket_events (ticket_id, at, type, message, actor) VALUES ($1,$2,$3,$4,$5)',
    [id, new Date(), type, message, actor],
  );
  await p.query('UPDATE tickets SET updated_at = now() WHERE id = $1', [id]);
  return getTicket(id);
}
