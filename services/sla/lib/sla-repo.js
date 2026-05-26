import { getPool } from './db.js';
import { addBusinessMinutes } from './working-time.js';

function calRow(r) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    timezone: r.timezone,
    holidays: r.holidays ?? [],
    weekdayHours: r.weekday_hours ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listCalendars(tenantId) {
  const { rows } = await getPool().query(
    'SELECT * FROM business_hours_calendars WHERE tenant_id = $1 ORDER BY name',
    [tenantId],
  );
  return rows.map(calRow);
}

export async function createCalendar(tenantId, body) {
  const { rows } = await getPool().query(
    `INSERT INTO business_hours_calendars (tenant_id, name, timezone, holidays, weekday_hours)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb) RETURNING *`,
    [
      tenantId,
      body.name,
      body.timezone || 'UTC',
      JSON.stringify(body.holidays ?? []),
      JSON.stringify(body.weekdayHours ?? body.weekday_hours ?? {}),
    ],
  );
  return calRow(rows[0]);
}

export async function getCalendar(tenantId, id) {
  const { rows } = await getPool().query(
    'SELECT * FROM business_hours_calendars WHERE tenant_id = $1 AND id = $2',
    [tenantId, id],
  );
  return rows.length ? calRow(rows[0]) : null;
}

function policyRow(r, targets = []) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    description: r.description,
    enabled: r.enabled,
    isDefault: r.is_default,
    businessHoursCalendarId: r.business_hours_calendar_id,
    targets,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listPolicies(tenantId) {
  const { rows } = await getPool().query(
    'SELECT * FROM sla_policies WHERE tenant_id = $1 ORDER BY name',
    [tenantId],
  );
  const out = [];
  for (const r of rows) {
    const { rows: t } = await getPool().query('SELECT * FROM sla_targets WHERE policy_id = $1', [r.id]);
    out.push(policyRow(r, t.map(targetRow)));
  }
  return out;
}

function targetRow(r) {
  return {
    id: r.id,
    policyId: r.policy_id,
    appliesWhen: r.applies_when ?? {},
    targetType: r.target_type,
    thresholdMinutes: r.threshold_minutes,
    warningThresholdPct: r.warning_threshold_pct,
    createdAt: r.created_at,
  };
}

export async function createPolicy(tenantId, body) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    if (body.isDefault) {
      await client.query('UPDATE sla_policies SET is_default = false WHERE tenant_id = $1', [tenantId]);
    }
    const { rows } = await client.query(
      `INSERT INTO sla_policies (tenant_id, name, description, enabled, is_default, business_hours_calendar_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        tenantId,
        body.name,
        body.description ?? null,
        body.enabled !== false,
        !!body.isDefault,
        body.businessHoursCalendarId ?? null,
      ],
    );
    const policy = rows[0];
    const targets = [];
    for (const t of body.targets ?? []) {
      const ins = await client.query(
        `INSERT INTO sla_targets (policy_id, applies_when, target_type, threshold_minutes, warning_threshold_pct)
         VALUES ($1,$2::jsonb,$3,$4,$5) RETURNING *`,
        [
          policy.id,
          JSON.stringify(t.appliesWhen ?? {}),
          t.targetType,
          t.thresholdMinutes,
          t.warningThresholdPct ?? 80,
        ],
      );
      targets.push(targetRow(ins.rows[0]));
    }
    await client.query('COMMIT');
    return policyRow(policy, targets);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function updatePolicy(tenantId, id, body) {
  const sets = [];
  const vals = [id, tenantId];
  let i = 3;
  for (const [col, key] of [
    ['name', 'name'],
    ['description', 'description'],
    ['enabled', 'enabled'],
    ['is_default', 'isDefault'],
    ['business_hours_calendar_id', 'businessHoursCalendarId'],
  ]) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      vals.push(body[key]);
    }
  }
  if (!sets.length) {
    const { rows } = await getPool().query('SELECT * FROM sla_policies WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (!rows.length) return null;
    const { rows: t } = await getPool().query('SELECT * FROM sla_targets WHERE policy_id = $1', [id]);
    return policyRow(rows[0], t.map(targetRow));
  }
  sets.push('updated_at = now()');
  const { rows } = await getPool().query(
    `UPDATE sla_policies SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    vals,
  );
  if (!rows.length) return null;
  const { rows: t } = await getPool().query('SELECT * FROM sla_targets WHERE policy_id = $1', [id]);
  return policyRow(rows[0], t.map(targetRow));
}

export async function deletePolicy(tenantId, id) {
  const { rowCount } = await getPool().query(
    'DELETE FROM sla_policies WHERE id = $1 AND tenant_id = $2',
    [id, tenantId],
  );
  return rowCount > 0;
}

export async function getBreachStats(tenantId, sinceIso, untilIso) {
  // Breach counts per calendar day
  const { rows: breachRows } = await getPool().query(
    `SELECT date_trunc('day', breached_at)::date AS day, COUNT(*)::int AS breaches
     FROM sla_instances
     WHERE tenant_id = $1 AND breached_at IS NOT NULL
       AND breached_at >= $2 AND breached_at < $3
     GROUP BY day ORDER BY day`,
    [tenantId, sinceIso, untilIso],
  );

  // Total instances started per calendar day
  const { rows: totalRows } = await getPool().query(
    `SELECT date_trunc('day', started_at)::date AS day, COUNT(*)::int AS total
     FROM sla_instances
     WHERE tenant_id = $1 AND started_at >= $2 AND started_at < $3
     GROUP BY day ORDER BY day`,
    [tenantId, sinceIso, untilIso],
  );

  const totalMap = new Map(totalRows.map((r) => [String(r.day), r.total]));
  return breachRows.map((r) => {
    const day = String(r.day);
    const total = totalMap.get(day) ?? r.breaches;
    return {
      date: day,
      breaches: r.breaches,
      total,
      breachRate: total > 0 ? Math.round((r.breaches / total) * 1000) / 10 : 0,
    };
  });
}

export async function getDefaultPolicy(tenantId) {
  const { rows } = await getPool().query(
    'SELECT * FROM sla_policies WHERE tenant_id = $1 AND is_default = true AND enabled = true LIMIT 1',
    [tenantId],
  );
  if (!rows.length) return null;
  const { rows: t } = await getPool().query('SELECT * FROM sla_targets WHERE policy_id = $1', [rows[0].id]);
  return policyRow(rows[0], t.map(targetRow));
}

export function targetMatches(appliesWhen, conversation) {
  const aw = appliesWhen ?? {};
  if (aw.priority?.length && !aw.priority.includes(conversation.priority)) return false;
  if (aw.channel?.length && !aw.channel.includes(conversation.channel)) return false;
  if (aw.inbox_id?.length && !aw.inbox_id.map(Number).includes(Number(conversation.inboxId))) return false;
  return true;
}

export async function createInstance(tenantId, { conversationId, policy, target, calendar, startedAt }) {
  const dueAt = addBusinessMinutes(startedAt, target.thresholdMinutes, calendar ?? {});
  const { rows } = await getPool().query(
    `INSERT INTO sla_instances (tenant_id, conversation_id, policy_id, target_id, started_at, due_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,'active') RETURNING *`,
    [tenantId, conversationId, policy.id, target.id, startedAt, dueAt],
  );
  await appendEvent(rows[0].id, 'created', { dueAt });
  return instanceRow(rows[0], target, policy);
}

function instanceRow(r, target, policy) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    conversationId: Number(r.conversation_id),
    policyId: r.policy_id,
    targetId: r.target_id,
    targetType: target?.targetType,
    policyName: policy?.name,
    startedAt: r.started_at,
    dueAt: r.due_at,
    pausedAtTotalMs: Number(r.paused_at_total_ms),
    pausedSince: r.paused_since,
    status: r.status,
    metAt: r.met_at,
    breachedAt: r.breached_at,
    warningThresholdPct: target?.warningThresholdPct ?? 80,
  };
}

export async function appendEvent(instanceId, eventType, snapshot = {}) {
  await getPool().query(
    'INSERT INTO sla_events (instance_id, event_type, snapshot) VALUES ($1,$2,$3::jsonb)',
    [instanceId, eventType, JSON.stringify(snapshot)],
  );
}

export async function listInstancesForConversation(tenantId, conversationId) {
  const { rows } = await getPool().query(
    `SELECT i.*, t.target_type, t.warning_threshold_pct, p.name AS policy_name
     FROM sla_instances i
     JOIN sla_targets t ON t.id = i.target_id
     JOIN sla_policies p ON p.id = i.policy_id
     WHERE i.tenant_id = $1 AND i.conversation_id = $2
     ORDER BY i.created_at`,
    [tenantId, conversationId],
  );
  return rows.map((r) =>
    instanceRow(r, { targetType: r.target_type, warningThresholdPct: r.warning_threshold_pct }, { name: r.policy_name }),
  );
}

export async function listActiveInstances(tenantId = null) {
  const base = `SELECT i.*, i.tenant_id, t.target_type, t.warning_threshold_pct, t.threshold_minutes, p.name AS policy_name,
            c.weekday_hours, c.holidays
     FROM sla_instances i
     JOIN sla_targets t ON t.id = i.target_id
     JOIN sla_policies p ON p.id = i.policy_id
     LEFT JOIN business_hours_calendars c ON c.id = p.business_hours_calendar_id`;
  const { rows } = tenantId
    ? await getPool().query(
        `${base} WHERE i.tenant_id = $1 AND i.status IN ('active','paused','warning_sent')`,
        [tenantId],
      )
    : await getPool().query(
        `${base} WHERE i.status IN ('active','paused','warning_sent')`,
      );
  return rows;
}

export async function updateInstanceStatus(id, patch) {
  const sets = [];
  const vals = [id];
  let i = 2;
  for (const [col, key] of [
    ['status', 'status'],
    ['met_at', 'metAt'],
    ['breached_at', 'breachedAt'],
    ['paused_since', 'pausedSince'],
    ['paused_at_total_ms', 'pausedAtTotalMs'],
    ['due_at', 'dueAt'],
  ]) {
    if (patch[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      vals.push(patch[key]);
    }
  }
  sets.push('updated_at = now()');
  await getPool().query(`UPDATE sla_instances SET ${sets.join(', ')} WHERE id = $1`, vals);
}

export async function getDashboard(tenantId) {
  const { rows } = await getPool().query(
    `SELECT i.*, t.target_type, p.name AS policy_name
     FROM sla_instances i
     JOIN sla_targets t ON t.id = i.target_id
     JOIN sla_policies p ON p.id = i.policy_id
     WHERE i.tenant_id = $1 AND i.status IN ('active','paused','warning_sent','breached')
     ORDER BY i.due_at`,
    [tenantId],
  );
  const now = Date.now();
  return {
    atRisk: rows.filter((r) => r.status === 'warning_sent').map((r) => instanceRow(r, { targetType: r.target_type }, { name: r.policy_name })),
    breached: rows.filter((r) => r.status === 'breached').map((r) => instanceRow(r, { targetType: r.target_type }, { name: r.policy_name })),
    active: rows.filter((r) => ['active', 'paused'].includes(r.status) && new Date(r.due_at).getTime() - now < 3600_000).map((r) =>
      instanceRow(r, { targetType: r.target_type }, { name: r.policy_name }),
    ),
  };
}
