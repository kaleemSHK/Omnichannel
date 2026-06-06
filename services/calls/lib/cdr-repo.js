import { randomUUID } from 'node:crypto';
import { getPool } from './db.js';

const STATUS_MAP = { ringing: 'ringing', connected: 'connected', ended: 'ended', missed: 'missed' };
const SIP_ALIASES = new Set(['customer', 'desk', 'web', 'blinkone', 'unknown']);

/** Prefer CRM / mobile name over SIP aliases and numeric contact ids. */
export function resolveDisplayCustomerPhone(existing, incoming, meta = {}) {
  const name = String(meta.callerName ?? '').trim();
  if (name.length >= 2 && !SIP_ALIASES.has(name.toLowerCase())) return name;
  const phone = String(meta.callerPhone ?? incoming ?? '').trim();
  if (
    phone &&
    !SIP_ALIASES.has(phone.toLowerCase()) &&
    !/^[0-9a-f-]{36}$/i.test(phone) &&
    !/^\d{1,8}$/.test(phone)
  ) {
    return phone;
  }
  const ex = String(existing ?? '').trim();
  if (ex && !SIP_ALIASES.has(ex.toLowerCase()) && !/^[0-9a-f-]{36}$/i.test(ex)) return ex;
  return name || phone || ex || null;
}

/** Resolve CDR row by Postgres id, room_id, routing pseudo-id, or metadata externalCallId. */
async function resolveExistingCdrSession(tenantId, { sessionId, roomId }) {
  const keys = [];
  const sid = sessionId ? String(sessionId).trim() : '';
  const rid = roomId ? String(roomId).trim() : '';
  if (sid && !sid.startsWith('cs-')) keys.push(sid);
  if (rid) keys.push(rid);
  if (sid.startsWith('cs-')) {
    const stripped = sid.replace(/^cs-\d+-/, '');
    if (stripped) keys.push(stripped);
  }
  for (const key of keys) {
    const hit = await resolveCall(tenantId, key, false);
    if (hit) return hit;
  }
  if (rid) {
    const p = getPool();
    const { rows } = await p.query(
      `SELECT * FROM call_sessions
       WHERE tenant_id = $1
         AND (
           metadata->>'externalCallId' = $2
           OR room_id = $2
         )
       ORDER BY started_at DESC
       LIMIT 1`,
      [tenantId, rid],
    );
    if (rows[0]) return rowToSession(rows[0]);
  }
  return null;
}

async function findRecentNamedPeer(tenantId, { startedAt, assignedAgentId }) {
  const p = getPool();
  const when = startedAt ? new Date(startedAt) : new Date();
  const { rows } = await p.query(
    `SELECT * FROM call_sessions
     WHERE tenant_id = $1
       AND started_at BETWEEN $2::timestamptz - interval '3 minutes' AND $2::timestamptz + interval '3 minutes'
       AND (
         COALESCE(metadata->>'callerName', '') <> ''
         OR (
           COALESCE(customer_phone, '') <> ''
           AND lower(customer_phone) NOT IN ('customer','desk','web','blinkone','unknown')
         )
       )
       AND ($3::text IS NULL OR assigned_agent_id = $3 OR assigned_agent_id IS NULL)
     ORDER BY started_at DESC
     LIMIT 1`,
    [tenantId, when.toISOString(), assignedAgentId ? String(assignedAgentId) : null],
  );
  return rows[0] ? rowToSession(rows[0]) : null;
}

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

/** Resolve routing agent by desk id or Chatwoot user id. */
export async function resolveRoutingAgent(tenantId, agentOrChatwootId) {
  if (!agentOrChatwootId) return null;
  try {
    const p = getPool();
    const { rows } = await p.query(
      `SELECT agent_id, display_name, chatwoot_user_id
       FROM routing_agents
       WHERE tenant_id = $1 AND (agent_id = $2 OR chatwoot_user_id = $2)
       LIMIT 1`,
      [String(tenantId), String(agentOrChatwootId)],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Resolve routing agent display name (same Postgres as routing service). */
export async function lookupAgentDisplayName(tenantId, agentId) {
  const row = await resolveRoutingAgent(tenantId, agentId);
  const name = row?.display_name?.trim();
  return name || null;
}

async function lookupAgentDisplayNames(tenantId, agentIds) {
  const ids = [...new Set(agentIds.map(String).filter(Boolean))];
  if (!ids.length) return new Map();
  try {
    const p = getPool();
    const { rows } = await p.query(
      `SELECT agent_id, chatwoot_user_id, display_name FROM routing_agents
       WHERE tenant_id = $1
         AND (agent_id = ANY($2::text[]) OR chatwoot_user_id = ANY($2::text[]))`,
      [String(tenantId), ids],
    );
    const map = new Map();
    for (const r of rows) {
      const label = (r.display_name || '').trim() || String(r.agent_id);
      map.set(String(r.agent_id), label);
      if (r.chatwoot_user_id) map.set(String(r.chatwoot_user_id), label);
    }
    return map;
  } catch {
    return new Map();
  }
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

/** Historical CDR rows for agent UI (ended / missed sessions). */
export async function listCdr(tenantId, { page = 1, limit = 20, from, to, agentId } = {}) {
  const p = getPool();
  const params = [tenantId];
  // LEFT JOIN LATERAL pulls the latest recording (if any) for each session so the
  // history UI can offer inline playback without an N+1 round-trip per row.
  let sql = `
    SELECT cs.*, ro.id AS recording_row_id, ro.metadata AS recording_meta,
           ro.duration_ms AS recording_duration_ms, ro.storage_key AS recording_storage_key
    FROM call_sessions cs
    LEFT JOIN LATERAL (
      SELECT id, metadata, duration_ms, storage_key
      FROM recording_objects r
      WHERE r.tenant_id = cs.tenant_id
        AND (
          r.call_session_id = cs.id
          OR r.call_session_id::text = cs.room_id
        )
      ORDER BY (CASE WHEN r.storage_key IS NOT NULL AND r.storage_key <> '' THEN 0 ELSE 1 END), r.created_at DESC
      LIMIT 1
    ) ro ON TRUE
    WHERE cs.tenant_id = $1 AND cs.status IN ('ended', 'missed')
      AND NOT (
        cs.transport = 'pstn'
        AND EXISTS (
          SELECT 1 FROM call_sessions peer
          WHERE peer.tenant_id = cs.tenant_id
            AND peer.id <> cs.id
            AND peer.id::text = cs.room_id
        )
      )
      AND NOT (
        cs.outcome = 'timeout'
        AND EXISTS (
          SELECT 1 FROM call_sessions peer
          WHERE peer.tenant_id = cs.tenant_id
            AND peer.id <> cs.id
            AND peer.room_id = cs.room_id
            AND COALESCE(peer.duration_ms, 0) > 0
        )
      )
      AND NOT (
        cs.assigned_agent_id IS NULL
        AND EXISTS (
          SELECT 1 FROM call_sessions peer
          WHERE peer.tenant_id = cs.tenant_id
            AND peer.id <> cs.id
            AND peer.room_id = cs.room_id
            AND peer.assigned_agent_id IS NOT NULL
            AND peer.started_at >= cs.started_at - interval '3 minutes'
            AND peer.started_at <= cs.started_at + interval '3 minutes'
        )
      )
      AND NOT (
        COALESCE(cs.customer_phone, '') = ''
        AND COALESCE(cs.metadata->>'callerName', '') = ''
        AND EXISTS (
          SELECT 1 FROM call_sessions peer
          WHERE peer.tenant_id = cs.tenant_id
            AND peer.id <> cs.id
            AND peer.started_at BETWEEN cs.started_at - interval '3 minutes' AND cs.started_at + interval '3 minutes'
            AND (
              COALESCE(peer.metadata->>'callerName', '') <> ''
              OR (
                COALESCE(peer.customer_phone, '') <> ''
                AND lower(peer.customer_phone) NOT IN ('customer','desk','web','blinkone','unknown')
              )
            )
        )
      )`;
  if (from) {
    params.push(from);
    sql += ` AND cs.started_at >= $${params.length}::timestamptz`;
  }
  if (to) {
    params.push(to);
    sql += ` AND cs.started_at <= $${params.length}::timestamptz`;
  }
  if (agentId) {
    params.push(agentId);
    sql += ` AND (cs.assigned_agent_id = $${params.length} OR cs.agent_label = $${params.length})`;
  }
  const lim = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
  const off = Math.max((parseInt(String(page), 10) || 1) - 1, 0) * lim;
  params.push(lim, off);
  sql += ` ORDER BY cs.started_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await p.query(sql, params);
  const agentIds = rows.map((r) => rowToSession(r).assignedAgentId).filter(Boolean);
  const agentNames = await lookupAgentDisplayNames(tenantId, agentIds);

  return rows.map((r) => {
    const s = rowToSession(r);
    const sipAlias = new Set(['customer', 'desk', 'web', 'blinkone', 'unknown']);
    const phoneRaw = String(s.customerPhone ?? '').trim();
    const phoneOk =
      phoneRaw &&
      !/^[0-9a-f-]{36}$/i.test(phoneRaw) &&
      !/^\d{1,8}$/.test(phoneRaw) &&
      !sipAlias.has(phoneRaw.toLowerCase());
    const callerDisplayName =
      (s.metadata?.callerName && String(s.metadata.callerName).trim()) ||
      (phoneOk ? phoneRaw : '') ||
      '';
    const recMeta = r.recording_meta && typeof r.recording_meta === 'object' ? r.recording_meta : {};
    const sessionRecId =
      s.metadata?.recordingId != null ? String(s.metadata.recordingId) : null;
    const sidecarRecId = recMeta.sidecarId ? String(recMeta.sidecarId) : null;
    const storageKey = r.recording_storage_key ? String(r.recording_storage_key) : null;
    const playableId =
      storageKey && sidecarRecId
        ? sidecarRecId
        : storageKey && sessionRecId
          ? sessionRecId
          : null;
    const assignedId = s.assignedAgentId ? String(s.assignedAgentId) : '';
    const agentLabel =
      (s.agentLabel && String(s.agentLabel).trim() && s.agentLabel !== assignedId
        ? String(s.agentLabel).trim()
        : '') ||
      (assignedId ? agentNames.get(assignedId) : '') ||
      '';

    return {
      id: s.id,
      tenantId: s.tenantId,
      callSessionId: s.id,
      agentId: assignedId || s.agentLabel || '',
      agentLabel,
      customerId: s.contactId ?? undefined,
      customerPhone: s.metadata?.callerPhone ?? s.customerPhone ?? '',
      callerDisplayName: callerDisplayName || undefined,
      direction: s.direction,
      transport: s.transport,
      duration: Math.max(0, Math.floor(Number(s.durationMs || 0) / 1000)),
      outcome: s.outcome || s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt ?? null,
      recordingId: playableId,
    };
  });
}

export async function expireStaleRinging(tenantId, maxAgeSec = 180) {
  const p = getPool();
  await p.query(
    `UPDATE call_sessions
     SET status = 'missed', ended_at = NOW(), outcome = 'timeout'
     WHERE tenant_id = $1 AND status = 'ringing'
       AND started_at < NOW() - ($2::text || ' seconds')::interval`,
    [tenantId, String(maxAgeSec)],
  );
}

/** Close zombie legs left when SIP/WebRTC hangup never reached the calls service. */
export async function expireStaleActiveCalls(
  tenantId,
  { ringingSec = 180, connectedSec = 7200 } = {},
) {
  await expireStaleRinging(tenantId, ringingSec);
  const p = getPool();
  await p.query(
    `UPDATE call_sessions
     SET status = 'ended',
         ended_at = COALESCE(ended_at, NOW()),
         outcome = COALESCE(NULLIF(outcome, ''), 'completed'),
         duration_ms = COALESCE(
           duration_ms,
           GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::bigint
         )
     WHERE tenant_id = $1 AND status IN ('connected', 'on_hold')
       AND started_at < NOW() - ($2::text || ' seconds')::interval`,
    [tenantId, String(connectedSec)],
  );
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
      if (statuses.includes('ringing') && statuses.length === 1) {
        params.push(String(180));
        sql += ` AND started_at >= NOW() - ($${params.length}::text || ' seconds')::interval`;
      }
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

export async function getCallByRoomId(tenantId, roomId, withEvents = false) {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT * FROM call_sessions WHERE tenant_id = $1 AND room_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId, String(roomId).slice(0, 128)],
  );
  if (!rows.length) return null;
  let events = [];
  if (withEvents) {
    const ev = await p.query(
      'SELECT * FROM call_events WHERE call_session_id = $1 ORDER BY occurred_at',
      [rows[0].id],
    );
    events = ev.rows;
  }
  return rowToSession(rows[0], events);
}

/** Resolve session by Postgres id or routing/external room_id. */
export async function resolveCall(tenantId, idOrRoom, withEvents = false) {
  const byId = await getCall(tenantId, idOrRoom, withEvents);
  if (byId) return byId;
  return getCallByRoomId(tenantId, idOrRoom, withEvents);
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
  const roomId = (body.roomId || randomUUID()).toString().slice(0, 128);
  let agentLabel = body.agentLabel ?? null;
  if (!agentLabel && body.assignedAgentId) {
    agentLabel = (await lookupAgentDisplayName(tenantId, body.assignedAgentId)) ?? null;
  }

  const existing = await getCallByRoomId(tenantId, roomId, false);
  if (existing && ['ringing', 'connected', 'on_hold'].includes(existing.status)) {
    const p = getPool();
    const mergedMeta = { ...(existing.metadata ?? {}), ...(body.metadata ?? {}) };
    const displayPhone = resolveDisplayCustomerPhone(
      existing.customer_phone,
      body.customerPhone,
      mergedMeta,
    );
    const sets = ['metadata = $3::jsonb'];
    const params = [tenantId, existing.id, JSON.stringify(mergedMeta)];
    if (body.assignedAgentId) {
      params.push(String(body.assignedAgentId));
      sets.push(`assigned_agent_id = $${params.length}`);
    }
    if (agentLabel) {
      params.push(agentLabel);
      sets.push(`agent_label = $${params.length}`);
    }
    if (displayPhone) {
      params.push(displayPhone);
      sets.push(`customer_phone = $${params.length}`);
    }
    await p.query(
      `UPDATE call_sessions SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`,
      params,
    );
    return getCall(tenantId, existing.id);
  }

  const p = getPool();
  const mergedMeta = body.metadata ?? {};
  const displayPhone = resolveDisplayCustomerPhone(null, body.customerPhone, mergedMeta);
  const { rows } = await p.query(
    `INSERT INTO call_sessions (
       tenant_id, room_id, channel, agent_label, customer_phone, queue_key,
       status, started_at, transport, direction, conversation_id, contact_id,
       assigned_agent_id, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
     RETURNING *`,
    [
      tenantId,
      roomId,
      body.channel || 'voice',
      agentLabel,
      displayPhone,
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

export async function transitionCall(tenantId, idOrRoom, { status, outcome, agentId, metadata = {} }) {
  const p = getPool();
  const existing = await resolveCall(tenantId, idOrRoom, false);
  if (!existing) return null;
  const id = existing.id;
  const now = new Date().toISOString();
  const sets = ['status = $3'];
  const params = [tenantId, id, status];
  if (status === 'connected') {
    params.push(now);
    sets.push(`connected_at = $${params.length}`);
    await p.query(
      `UPDATE call_sessions
       SET status = 'missed', outcome = 'superseded', ended_at = NOW()
       WHERE tenant_id = $1 AND room_id = $2 AND id <> $3 AND status = 'ringing'`,
      [tenantId, existing.roomId, id],
    );
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
    const resolved = await resolveRoutingAgent(tenantId, agentId);
    const deskId = resolved?.agent_id ? String(resolved.agent_id) : String(agentId);
    const displayName =
      (resolved?.display_name && String(resolved.display_name).trim()) ||
      (await lookupAgentDisplayName(tenantId, deskId)) ||
      null;
    params.push(deskId);
    sets.push(`assigned_agent_id = $${params.length}`);
    if (displayName) {
      params.push(displayName);
      sets.push(`agent_label = $${params.length}`);
    }
  }
  await p.query(`UPDATE call_sessions SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`, params);
  const eventType = status === 'connected' ? 'answered' : status === 'missed' ? 'declined' : status === 'ended' ? 'ended' : status;
  await appendCallEvent(tenantId, id, { eventType, actorId: agentId, metadata });
  return getCall(tenantId, id);
}

/**
 * Partial update: ACW notes, disposition, hold/resume status.
 * Accepts session UUID or routing call id (room_id).
 */
export async function patchCallSession(
  tenantId,
  idOrRoom,
  { status, outcome, metadata = {}, agentId } = {},
) {
  const existing = await resolveCall(tenantId, idOrRoom, false);
  if (!existing) return null;
  const id = existing.id;

  if (status && ['connected', 'ended', 'missed'].includes(status) && status !== existing.status) {
    return transitionCall(tenantId, id, {
      status,
      outcome: outcome ?? existing.outcome,
      agentId,
      metadata,
    });
  }

  const p = getPool();
  const mergedMeta = { ...(existing.metadata ?? {}), ...metadata };
  const sets = ['metadata = $3::jsonb'];
  const params = [tenantId, id, JSON.stringify(mergedMeta)];

  if (outcome) {
    params.push(String(outcome).slice(0, 80));
    sets.push(`outcome = $${params.length}`);
  }
  if (status && status !== existing.status) {
    params.push(status);
    sets.push(`status = $${params.length}`);
  }

  await p.query(`UPDATE call_sessions SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`, params);

  if (metadata.notes || outcome) {
    await appendCallEvent(tenantId, id, {
      eventType: 'acw',
      actorId: agentId ?? null,
      metadata: { outcome: outcome ?? existing.outcome, notes: metadata.notes ?? '' },
    });
  } else if (status === 'on_hold' || status === 'connected') {
    await appendCallEvent(tenantId, id, {
      eventType: status === 'on_hold' ? 'hold' : 'resume',
      actorId: agentId ?? null,
      metadata: {},
    });
  }

  return getCall(tenantId, id);
}

export async function insertCdr(body) {
  const tenantId = String(body.chatwootAccountId ?? body.tenantId ?? 'default');
  const roomId = (body.roomId || body.asteriskChannelId || randomUUID()).toString().slice(0, 128);
  let existing = await resolveExistingCdrSession(tenantId, { sessionId: body.sessionId, roomId });

  const peer =
    !existing &&
    !(body.callerName || body.customerPhone || body.metadata?.callerName)
      ? await findRecentNamedPeer(tenantId, {
          startedAt: body.startedAt,
          assignedAgentId: body.assignedAgentId ?? body.agentLabel,
        })
      : null;
  if (!existing && peer) existing = peer;

  const mergedMeta = {
    ...(existing?.metadata ?? {}),
    ...(body.metadata ?? {}),
    externalCallId:
      body.metadata?.externalCallId ?? roomId ?? existing?.metadata?.externalCallId,
  };
  if (body.callerName) mergedMeta.callerName = body.callerName;
  else if (peer?.metadata?.callerName) mergedMeta.callerName = peer.metadata.callerName;
  if (body.callerPhone) mergedMeta.callerPhone = body.callerPhone;
  else if (peer?.metadata?.callerPhone) mergedMeta.callerPhone = peer.metadata.callerPhone;

  const customerPhone = resolveDisplayCustomerPhone(
    existing?.customerPhone ?? peer?.customerPhone,
    body.customerPhone,
    mergedMeta,
  );

  if (existing) {
    const p = getPool();
    const endedAt = body.endedAt ?? new Date().toISOString();
    const durationMs = Math.max(Number(existing.durationMs || 0), Number(body.durationMs || 0));
    const outcome = body.disposition ?? body.outcome ?? existing.outcome ?? 'completed';
    await p.query(
      `UPDATE call_sessions SET
         status = 'ended',
         ended_at = $3,
         duration_ms = $4,
         outcome = $5,
         customer_phone = COALESCE(NULLIF($6, ''), customer_phone),
         agent_label = COALESCE(NULLIF($7, ''), agent_label),
         contact_id = COALESCE(contact_id, $9),
         metadata = $8::jsonb
       WHERE tenant_id = $1 AND id = $2`,
      [
        tenantId,
        existing.id,
        endedAt,
        durationMs || null,
        outcome,
        customerPhone,
        body.agentLabel ?? null,
        JSON.stringify(mergedMeta),
        peer?.contactId ?? existing.contactId ?? null,
      ],
    );
    return getCall(tenantId, existing.id);
  }

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
      roomId,
      body.channel || 'voice',
      body.agentLabel ?? null,
      customerPhone,
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
      body.contactId ? String(body.contactId) : peer?.contactId ?? null,
      JSON.stringify(mergedMeta),
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

export async function createRecordingObject(
  tenantId,
  { callSessionId, storageBackend, storageKey, durationMs, startedAt, endedAt, metadata = {} },
) {
  const p = getPool();
  const { rows } = await p.query(
    `INSERT INTO recording_objects (
       tenant_id, call_session_id, storage_backend, storage_key, duration_ms, started_at, ended_at, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     RETURNING *`,
    [
      tenantId,
      callSessionId ?? null,
      storageBackend || 'local',
      storageKey ?? null,
      durationMs ?? null,
      startedAt ?? null,
      endedAt ?? null,
      JSON.stringify(metadata ?? {}),
    ],
  );
  return rows[0];
}

/** Link a sidecar recording id to the call session for CDR history playback. */
export async function linkCallRecording(tenantId, idOrRoom, { recordingId, storageKey } = {}) {
  const existing = await resolveCall(tenantId, idOrRoom, false);
  if (!existing) return null;
  if (!recordingId || !storageKey) return existing;
  const merged = {
    ...(existing.metadata ?? {}),
    recordingId: String(recordingId),
  };
  await createRecordingObject(tenantId, {
    callSessionId: existing.id,
    storageBackend: 'minio',
    storageKey,
    durationMs: existing.durationMs ?? null,
    startedAt: existing.startedAt,
    endedAt: existing.endedAt,
    metadata: { sidecarId: String(recordingId) },
  });
  const p = getPool();
  await p.query(
    `UPDATE call_sessions SET metadata = $3::jsonb WHERE tenant_id = $1 AND id = $2`,
    [tenantId, existing.id, JSON.stringify(merged)],
  );
  return getCall(tenantId, existing.id);
}

/**
 * Retrieve call events by type for MOS history (Sprint 1 G03).
 * Returns an array of event rows ordered oldest → newest.
 */
export async function getCallEvents(tenantId, callSessionId, eventType) {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT id, event_type, actor_id, metadata, occurred_at AS "createdAt"
     FROM call_events
     WHERE tenant_id = $1 AND call_session_id = $2${eventType ? ' AND event_type = $3' : ''}
     ORDER BY occurred_at ASC`,
    eventType ? [tenantId, callSessionId, eventType] : [tenantId, callSessionId],
  );
  return rows.map(r => ({
    id: r.id,
    eventType: r.event_type,
    actorId: r.actor_id,
    metadata: r.metadata ?? {},
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
  }));
}

export { STATUS_MAP };
