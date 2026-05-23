import { randomUUID } from 'node:crypto';
import { getPool } from './db.js';

const STATUS_MAP = { ringing: 'ringing', connected: 'connected', ended: 'ended', missed: 'missed' };

function rowToSession(row, events = []) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    roomId: row.room_id,
    channel: row.channel,
    agentLabel: row.agent_label,
    customerPhone: row.customer_phone,
    queueKey: row.queue_key,
    status: row.status,
    startedAt: row.started_at?.toISOString?.() ?? row.started_at,
    connectedAt: row.connected_at?.toISOString?.() ?? row.connected_at,
    endedAt: row.ended_at?.toISOString?.() ?? row.ended_at,
    durationMs: row.duration_ms,
    outcome: row.outcome,
    asteriskChannelId: row.asterisk_channel_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    chatwootAccountId: Number(row.tenant_id) || 0,
    conversationId: row.conversation_id ?? null,
    contactId: row.contact_id ?? null,
    transport: row.transport ?? 'pstn',
    direction: row.direction ?? 'inbound',
    assignedAgentId: row.assigned_agent_id ?? null,
    events: events.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      actorId: e.actor_id,
      metadata: e.metadata ?? {},
      occurredAt: e.occurred_at?.toISOString?.() ?? e.occurred_at,
    })),
  };
}

export async function appendCallEvent(tenantId, callSessionId, { eventType, actorId, metadata = {} }) {
  const p = getPool();
  const { rows } = await p.query(
    `INSERT INTO call_events (tenant_id, call_session_id, event_type, actor_id, metadata)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     RETURNING *`,
    [tenantId, callSessionId, eventType, actorId ?? null, JSON.stringify(metadata)],
  );
  return rows[0];
}

export async function listCalls(tenantId, { status, transport, scope, agentId } = {}) {
  const p = getPool();
  const params = [tenantId];
  let sql = 'SELECT * FROM call_sessions WHERE tenant_id = $1';
  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length) {
      params.push(statuses);
      sql += ` AND status = ANY($${params.length})`;
    }
  }
  if (transport) {
    params.push(transport);
    sql += ` AND transport = $${params.length}`;
  }
  if (scope === 'mine' && agentId) {
    params.push(agentId);
    sql += ` AND (assigned_agent_id = $${params.length} OR agent_label = $${params.length})`;
  } else if (scope === 'unassigned') {
    sql += ` AND (assigned_agent_id IS NULL OR assigned_agent_id = '')`;
  }
  sql += ' ORDER BY created_at DESC LIMIT 500';
  const { rows } = await p.query(sql, params);
  return rows.map((r) => rowToSession(r));
}

export async function getCall(tenantId, id, withEvents = true) {
  const p = getPool();
  const { rows } = await p.query('SELECT * FROM call_sessions WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
  if (!rows.length) return null;
  let events = [];
  if (withEvents) {
    const ev = await p.query(
      'SELECT * FROM call_events WHERE call_session_id = $1 ORDER BY occurred_at',
      [id],
    );
    events = ev.rows;
  }
  return rowToSession(rows[0], events);
}

export async function createCall(body) {
  const tenantId = String(body.chatwootAccountId ?? body.tenantId ?? 'default');
  const p = getPool();
  const { rows } = await p.query(
    `INSERT INTO call_sessions (
       tenant_id, room_id, channel, agent_label, customer_phone, queue_key,
       status, started_at, transport, direction, conversation_id, contact_id,
       assigned_agent_id, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
     RETURNING *`,
    [
      tenantId,
      (body.roomId || randomUUID()).toString().slice(0, 128),
      body.channel || 'voice',
      body.agentLabel ?? null,
      body.customerPhone ?? null,
      body.queueKey ?? null,
      body.status || 'ringing',
      body.startedAt ?? new Date().toISOString(),
      body.transport || 'pstn',
      body.direction || 'inbound',
      body.conversationId ? String(body.conversationId) : null,
      body.contactId ? String(body.contactId) : null,
      body.assignedAgentId ?? null,
      JSON.stringify(body.metadata ?? {}),
    ],
  );
  const session = rows[0];
  await appendCallEvent(tenantId, session.id, {
    eventType: 'ringing',
    actorId: body.assignedAgentId,
    metadata: { direction: body.direction || 'inbound' },
  });
  return getCall(tenantId, session.id);
}

export async function transitionCall(tenantId, id, { status, outcome, agentId, metadata = {} }) {
  const p = getPool();
  const existing = await getCall(tenantId, id, false);
  if (!existing) return null;
  const now = new Date().toISOString();
  const sets = ['status = $3'];
  const params = [tenantId, id, status];
  if (status === 'connected') {
    params.push(now);
    sets.push(`connected_at = $${params.length}`);
  }
  if (status === 'ended' || status === 'missed') {
    params.push(now);
    sets.push(`ended_at = $${params.length}`);
    const from = existing.connectedAt || existing.startedAt;
    const durationMs = Date.now() - new Date(from).getTime();
    params.push(durationMs);
    sets.push(`duration_ms = $${params.length}`);
    params.push(outcome || status);
    sets.push(`outcome = $${params.length}`);
  }
  if (agentId) {
    params.push(agentId);
    sets.push(`assigned_agent_id = $${params.length}`);
  }
  await p.query(`UPDATE call_sessions SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`, params);
  const eventType = status === 'connected' ? 'answered' : status === 'missed' ? 'declined' : status === 'ended' ? 'ended' : status;
  await appendCallEvent(tenantId, id, { eventType, actorId: agentId, metadata });
  return getCall(tenantId, id);
}

export async function insertCdr(body) {
  const tenantId = String(body.chatwootAccountId ?? body.tenantId ?? 'default');
  const p = getPool();
  const { rows } = await p.query(
    `INSERT INTO call_sessions (
       tenant_id, room_id, channel, agent_label, customer_phone, queue_key,
       status, started_at, connected_at, ended_at, duration_ms, outcome, asterisk_channel_id,
       transport, direction, conversation_id, contact_id, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)
     RETURNING *`,
    [
      tenantId,
      (body.roomId || body.asteriskChannelId || randomUUID()).toString().slice(0, 128),
      body.channel || 'voice',
      body.agentLabel ?? null,
      body.customerPhone ?? null,
      body.queueKey ?? null,
      body.status || 'ended',
      body.startedAt ?? new Date().toISOString(),
      body.connectedAt ?? body.startedAt ?? null,
      body.endedAt ?? new Date().toISOString(),
      body.durationMs ?? null,
      body.disposition ?? body.outcome ?? 'completed',
      body.asteriskChannelId ?? null,
      body.transport || 'pstn',
      body.direction || 'inbound',
      body.conversationId ? String(body.conversationId) : null,
      body.contactId ? String(body.contactId) : null,
      JSON.stringify(body.metadata ?? {}),
    ],
  );
  return rowToSession(rows[0]);
}

export async function listSessions(tenantId) {
  return listCalls(tenantId);
}

export async function getSession(tenantId, id) {
  return getCall(tenantId, id, false);
}

export async function createRecordingObject(tenantId, { callSessionId, storageBackend, storageKey, durationMs, startedAt, endedAt }) {
  const p = getPool();
  const { rows } = await p.query(
    `INSERT INTO recording_objects (tenant_id, call_session_id, storage_backend, storage_key, duration_ms, started_at, ended_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      tenantId,
      callSessionId ?? null,
      storageBackend || 'local',
      storageKey ?? null,
      durationMs ?? null,
      startedAt ?? null,
      endedAt ?? null,
    ],
  );
  return rows[0];
}

export { STATUS_MAP };
