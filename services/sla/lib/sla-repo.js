import { getPool } from './db.js';
import { addBusinessMinutes } from './working-time.js';
import { tenantQuery, withTenantClient } from '../_shared/lib/pg-tenant.js';

function pool() {
  const p = getPool();
  if (!p) throw new Error('Postgres not configured');
  return p;
}

async function tq(tenantId, text, params = []) {
  return tenantQuery(pool(), tenantId, text, params);
}

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
  const { rows } = await tq(
    tenantId,
    'SELECT * FROM business_hours_calendars WHERE tenant_id = $1 ORDER BY name',
    [tenantId],
  );
  return rows.map(calRow);
}

export async function createCalendar(tenantId, body) {
  const { rows } = await tq(
    tenantId,
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
  const { rows } = await tq(
    tenantId,
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
  const { rows } = await tq(
    tenantId,
    'SELECT * FROM sla_policies WHERE tenant_id = $1 ORDER BY name',
    [tenantId],
  );
  const out = [];
  for (const r of rows) {
    const { rows: t } = await tq(tenantId, 'SELECT * FROM sla_targets WHERE policy_id = $1', [r.id]);
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
  return withTenantClient(pool(), tenantId, async (client) => {
    if (body.isDefault) {
      await client.query('UPDATE sla_policies SET is_default = false WHERE tenant_id = $1', [tenantId]);
    }
    if (body.businessHoursCalendarId) {
      const cal = await client.query(
        'SELECT 1 FROM business_hours_calendars WHERE id = $1 AND tenant_id = $2',
        [body.businessHoursCalendarId, tenantId],
      );
      if (!cal.rows.length) {
        const err = new Error('Business hours calendar not found for tenant');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
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
    return policyRow(policy, targets);
  });
}

export async function updatePolicy(tenantId, id, body) {
  return withTenantClient(pool(), tenantId, async (client) => {
    const { rows: owned } = await client.query(
      'SELECT * FROM sla_policies WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    if (!owned.length) return null;
    let policyRowData = owned[0];

    if (body.businessHoursCalendarId) {
      const cal = await client.query(
        'SELECT 1 FROM business_hours_calendars WHERE id = $1 AND tenant_id = $2',
        [body.businessHoursCalendarId, tenantId],
      );
      if (!cal.rows.length) {
        const err = new Error('Business hours calendar not found for tenant');
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    }

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
        vals.push(body[key]);
        sets.push(`${col} = $${i++}`);
      }
    }

    if (sets.length) {
      sets.push('updated_at = now()');
      const { rows } = await client.query(
        `UPDATE sla_policies SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        vals,
      );
      policyRowData = rows[0];
    }

    if (Array.isArray(body.targets)) {
      await client.query('DELETE FROM sla_targets WHERE policy_id = $1', [id]);
      for (const t of body.targets) {
        await client.query(
          `INSERT INTO sla_targets (policy_id, applies_when, target_type, threshold_minutes, warning_threshold_pct)
           VALUES ($1,$2::jsonb,$3,$4,$5)`,
          [
            id,
            JSON.stringify(t.appliesWhen ?? {}),
            t.targetType,
            t.thresholdMinutes,
            t.warningThresholdPct ?? 80,
          ],
        );
      }
    }

    const { rows: t } = await client.query('SELECT * FROM sla_targets WHERE policy_id = $1', [id]);
    return policyRow(policyRowData, t.map(targetRow));
  });
}

export async function deletePolicy(tenantId, id) {
  const { rowCount } = await tq(
    tenantId,
    'DELETE FROM sla_policies WHERE id = $1 AND tenant_id = $2',
    [id, tenantId],
  );
  return rowCount > 0;
}

export async function getBreachStats(tenantId, sinceIso, untilIso) {
  const { rows: breachRows } = await tq(
    tenantId,
    `SELECT date_trunc('day', breached_at)::date AS day, COUNT(*)::int AS breaches
     FROM sla_instances
     WHERE tenant_id = $1 AND breached_at IS NOT NULL
       AND breached_at >= $2 AND breached_at < $3
     GROUP BY day ORDER BY day`,
    [tenantId, sinceIso, untilIso],
  );

  const { rows: totalRows } = await tq(
    tenantId,
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
  const { rows } = await tq(
    tenantId,
    'SELECT * FROM sla_policies WHERE tenant_id = $1 AND is_default = true AND enabled = true LIMIT 1',
    [tenantId],
  );
  if (!rows.length) return null;
  const { rows: t } = await tq(tenantId, 'SELECT * FROM sla_targets WHERE policy_id = $1', [rows[0].id]);
  return policyRow(rows[0], t.map(targetRow));
}

export async function listEnabledPolicies(tenantId) {
  const { rows } = await tq(
    tenantId,
    'SELECT * FROM sla_policies WHERE tenant_id = $1 AND enabled = true ORDER BY is_default DESC, name',
    [tenantId],
  );
  const out = [];
  for (const r of rows) {
    const { rows: t } = await tq(tenantId, 'SELECT * FROM sla_targets WHERE policy_id = $1', [r.id]);
    out.push(policyRow(r, t.map(targetRow)));
  }
  return out;
}

function specificityScore(appliesWhen) {
  const aw = appliesWhen ?? {};
  let score = 0;
  if (aw.priority?.length) score += 10 + aw.priority.length;
  if (aw.channel?.length) score += 5 + aw.channel.length;
  if (aw.inbox_id?.length) score += 5 + aw.inbox_id.length;
  return score;
}

/** Pick policy by best-matching first_response target (Gold/Silver/Bronze tiers). */
export async function resolvePolicyForConversation(tenantId, conversation) {
  const policies = await listEnabledPolicies(tenantId);
  if (!policies.length) return null;

  let bestPolicy = null;
  let bestScore = -1;

  for (const policy of policies) {
    for (const target of policy.targets) {
      if (target.targetType !== 'first_response') continue;
      if (!targetMatches(target.appliesWhen, conversation)) continue;
      const score = specificityScore(target.appliesWhen);
      if (score > bestScore) {
        bestScore = score;
        bestPolicy = policy;
      }
    }
  }

  if (bestPolicy) return bestPolicy;
  return policies.find(p => p.isDefault) ?? policies[0];
}

export async function updateCalendar(tenantId, id, body) {
  const sets = [];
  const vals = [id, tenantId];
  let i = 3;
  for (const [col, key] of [
    ['name', 'name'],
    ['timezone', 'timezone'],
  ]) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      vals.push(body[key]);
    }
  }
  if (body.holidays !== undefined) {
    sets.push(`holidays = $${i++}::jsonb`);
    vals.push(JSON.stringify(body.holidays));
  }
  if (body.weekdayHours !== undefined || body.weekday_hours !== undefined) {
    sets.push(`weekday_hours = $${i++}::jsonb`);
    vals.push(JSON.stringify(body.weekdayHours ?? body.weekday_hours));
  }
  if (!sets.length) {
    return getCalendar(tenantId, id);
  }
  sets.push('updated_at = now()');
  const { rows } = await tq(
    tenantId,
    `UPDATE business_hours_calendars SET ${sets.join(', ')}
     WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    vals,
  );
  return rows.length ? calRow(rows[0]) : null;
}

export function targetMatches(appliesWhen, conversation) {
  const aw = appliesWhen ?? {};
  if (aw.priority?.length && !aw.priority.includes(conversation.priority)) return false;
  if (aw.channel?.length && !aw.channel.includes(conversation.channel)) return false;
  if (aw.inbox_id?.length && !aw.inbox_id.map(Number).includes(Number(conversation.inboxId))) return false;
  return true;
}

export async function createInstance(tenantId, { conversationId, policy, target, calendar, startedAt }) {
  if (String(policy.tenantId ?? policy.tenant_id) !== String(tenantId)) {
    const err = new Error('Policy tenant mismatch');
    err.code = 'TENANT_MISMATCH';
    throw err;
  }
  const dueAt = addBusinessMinutes(startedAt, target.thresholdMinutes, calendar ?? {});
  const { rows } = await tq(
    tenantId,
    `INSERT INTO sla_instances (tenant_id, conversation_id, policy_id, target_id, started_at, due_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,'active') RETURNING *`,
    [tenantId, conversationId, policy.id, target.id, startedAt, dueAt],
  );
  await appendEvent(tenantId, rows[0].id, 'created', { dueAt });
  return instanceRow(rows[0], target, policy);
}

function instanceRow(r, target, policy) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    conversationId: Number(r.conversation_id),
    policyId: r.policy_id,
    targetId: r.target_id,
    targetType: target?.targetType ?? target?.target_type,
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

export async function appendEvent(tenantId, instanceId, eventType, snapshot = {}) {
  await tq(
    tenantId,
    `INSERT INTO sla_events (instance_id, event_type, snapshot)
     SELECT $1, $2, $3::jsonb
     FROM sla_instances
     WHERE id = $1 AND tenant_id = $4`,
    [instanceId, eventType, JSON.stringify(snapshot), tenantId],
  );
}

export async function listInstancesForConversation(tenantId, conversationId) {
  const { rows } = await tq(
    tenantId,
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

/** Worker bootstrap — distinct tenants with open SLA timers. */
export async function listActiveTenantIds() {
  const { rows } = await pool().query(
    `SELECT DISTINCT tenant_id FROM sla_instances
     WHERE status IN ('active','paused','warning_sent')`,
  );
  return rows.map(r => String(r.tenant_id));
}

export async function listActiveInstances(tenantId) {
  const { rows } = await tq(
    tenantId,
    `SELECT i.*, i.tenant_id, t.target_type, t.warning_threshold_pct, t.threshold_minutes, p.name AS policy_name,
            c.weekday_hours, c.holidays
     FROM sla_instances i
     JOIN sla_targets t ON t.id = i.target_id
     JOIN sla_policies p ON p.id = i.policy_id
     LEFT JOIN business_hours_calendars c ON c.id = p.business_hours_calendar_id
     WHERE i.tenant_id = $1 AND i.status IN ('active','paused','warning_sent')`,
    [tenantId],
  );
  return rows;
}

export async function updateInstanceStatus(tenantId, id, patch) {
  const sets = [];
  const vals = [id, tenantId];
  let i = 3;
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
  await tq(
    tenantId,
    `UPDATE sla_instances SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2`,
    vals,
  );
}

export async function getDashboard(tenantId) {
  const { rows } = await tq(
    tenantId,
    `SELECT i.*, t.target_type, p.name AS policy_name
     FROM sla_instances i
     JOIN sla_targets t ON t.id = i.target_id
     JOIN sla_policies p ON p.id = i.policy_id
     WHERE i.tenant_id = $1
     ORDER BY i.due_at DESC NULLS LAST`,
    [tenantId],
  );

  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const mapRow = (r) => instanceRow(r, { targetType: r.target_type }, { name: r.policy_name });

  const breached = rows.filter(r => r.status === 'breached').map(mapRow);
  const atRisk = rows.filter(r => r.status === 'warning_sent').map(mapRow);
  const active = rows.filter(r => ['active', 'paused'].includes(r.status)).map(mapRow);
  const met = rows.filter(r => {
    if (r.status !== 'met' || !r.met_at) return false;
    return new Date(r.met_at).getTime() >= startOfDay.getTime();
  }).map(mapRow);

  const breachedToday = rows.filter(r =>
    r.status === 'breached' && r.breached_at && new Date(r.breached_at).getTime() >= startOfDay.getTime(),
  ).length;
  const metToday = met.length;
  const denom = metToday + breachedToday;
  const compliancePct = denom > 0 ? Math.round((metToday / denom) * 100) : (metToday > 0 ? 100 : 0);

  return {
    atRisk,
    breached,
    active,
    met,
    stats: {
      breachedCount: breached.length,
      atRiskCount: atRisk.length,
      activeCount: active.length,
      metToday,
      compliancePct,
    },
  };
}
