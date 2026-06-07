import { getPool } from './db.js';
import { validateTrigger, validateActions, validateLogic } from './json-logic-safe.js';
import { requireTenantId, resolveTenantIdFromReq } from '../_shared/lib/tenant-id.js';

export function resolveTenantId(req) {
  try {
    return requireTenantId(req, { allowQuery: true, allowBody: true });
  } catch {
    return resolveTenantIdFromReq(req, { allowQuery: true, allowBody: true }) ||
      String(process.env.ESCALATION_DEFAULT_TENANT ?? 'default');
  }
}

function rulesetRow(r) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    enabled: r.enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function ruleRow(r) {
  return {
    id: r.id,
    rulesetId: r.ruleset_id,
    name: r.name,
    enabled: r.enabled,
    trigger: r.trigger,
    conditions: r.conditions ?? true,
    actions: r.actions ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listRulesets(tenantId) {
  const { rows } = await getPool().query(
    'SELECT * FROM escalation_rulesets WHERE tenant_id = $1 ORDER BY name',
    [tenantId],
  );
  return rows.map(rulesetRow);
}

export async function createRuleset(tenantId, { name, enabled = true }) {
  const { rows } = await getPool().query(
    'INSERT INTO escalation_rulesets (tenant_id, name, enabled) VALUES ($1,$2,$3) RETURNING *',
    [tenantId, name, enabled !== false],
  );
  return rulesetRow(rows[0]);
}

export async function listRules(tenantId, rulesetId) {
  const { rows } = await getPool().query(
    `SELECT r.* FROM escalation_rules r
     JOIN escalation_rulesets s ON s.id = r.ruleset_id
     WHERE s.tenant_id = $1 AND r.ruleset_id = $2 ORDER BY r.name`,
    [tenantId, rulesetId],
  );
  return rows.map(ruleRow);
}

export async function createRule(tenantId, rulesetId, body) {
  if (!validateTrigger(body.trigger)) {
    const err = new Error('trigger not in whitelist');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (!validateActions(body.actions)) {
    const err = new Error('invalid actions');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (!validateLogic(body.conditions ?? true)) {
    const err = new Error('invalid JSON-Logic conditions');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const { rows } = await getPool().query(
    `INSERT INTO escalation_rules (ruleset_id, name, enabled, trigger, conditions, actions)
     SELECT s.id, $3, $4, $5, $6::jsonb, $7::jsonb
     FROM escalation_rulesets s
     WHERE s.id = $2 AND s.tenant_id = $1
     RETURNING escalation_rules.*`,
    [
      tenantId,
      rulesetId,
      body.name,
      body.enabled !== false,
      body.trigger,
      JSON.stringify(body.conditions ?? true),
      JSON.stringify(body.actions ?? []),
    ],
  );
  if (!rows.length) {
    const err = new Error('Ruleset not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return ruleRow(rows[0]);
}

export async function getRule(tenantId, ruleId) {
  const { rows } = await getPool().query(
    `SELECT r.* FROM escalation_rules r
     JOIN escalation_rulesets s ON s.id = r.ruleset_id
     WHERE s.tenant_id = $1 AND r.id = $2`,
    [tenantId, ruleId],
  );
  return rows[0] ? ruleRow(rows[0]) : null;
}

export async function updateRuleset(tenantId, rulesetId, body) {
  const sets = [];
  const vals = [tenantId, rulesetId];
  if (typeof body.name === 'string' && body.name.trim()) {
    vals.push(body.name.trim());
    sets.push(`name = $${vals.length}`);
  }
  if (typeof body.enabled === 'boolean') {
    vals.push(body.enabled);
    sets.push(`enabled = $${vals.length}`);
  }
  if (!sets.length) {
    const err = new Error('No fields to update');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  sets.push('updated_at = now()');
  const { rows } = await getPool().query(
    `UPDATE escalation_rulesets SET ${sets.join(', ')}
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    vals,
  );
  if (!rows.length) {
    const err = new Error('Ruleset not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return rulesetRow(rows[0]);
}

export async function updateRule(tenantId, ruleId, body) {
  const existing = await getRule(tenantId, ruleId);
  if (!existing) {
    const err = new Error('Rule not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (body.trigger != null && !validateTrigger(body.trigger)) {
    const err = new Error('trigger not in whitelist');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (body.actions != null && !validateActions(body.actions)) {
    const err = new Error('invalid actions');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (body.conditions != null && !validateLogic(body.conditions)) {
    const err = new Error('invalid JSON-Logic conditions');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const sets = [];
  const vals = [tenantId, ruleId];
  if (typeof body.name === 'string' && body.name.trim()) {
    vals.push(body.name.trim());
    sets.push(`name = $${vals.length}`);
  }
  if (typeof body.enabled === 'boolean') {
    vals.push(body.enabled);
    sets.push(`enabled = $${vals.length}`);
  }
  if (body.trigger != null) {
    vals.push(body.trigger);
    sets.push(`trigger = $${vals.length}`);
  }
  if (body.conditions != null) {
    vals.push(JSON.stringify(body.conditions));
    sets.push(`conditions = $${vals.length}::jsonb`);
  }
  if (body.actions != null) {
    vals.push(JSON.stringify(body.actions));
    sets.push(`actions = $${vals.length}::jsonb`);
  }
  if (!sets.length) {
    const err = new Error('No fields to update');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  sets.push('updated_at = now()');
  const { rows } = await getPool().query(
    `UPDATE escalation_rules r SET ${sets.join(', ')}
     FROM escalation_rulesets s
     WHERE r.ruleset_id = s.id AND s.tenant_id = $1 AND r.id = $2
     RETURNING r.*`,
    vals,
  );
  return ruleRow(rows[0]);
}

export async function deleteRule(tenantId, ruleId) {
  const { rowCount } = await getPool().query(
    `DELETE FROM escalation_rules r
     USING escalation_rulesets s
     WHERE r.ruleset_id = s.id AND s.tenant_id = $1 AND r.id = $2`,
    [tenantId, ruleId],
  );
  if (!rowCount) {
    const err = new Error('Rule not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
}

export async function rulesForTrigger(tenantId, trigger) {
  const { rows } = await getPool().query(
    `SELECT r.* FROM escalation_rules r
     JOIN escalation_rulesets s ON s.id = r.ruleset_id
     WHERE s.tenant_id = $1 AND s.enabled = true AND r.enabled = true AND r.trigger = $2
     ORDER BY r.name ASC, r.id ASC`,
    [tenantId, trigger],
  );
  return rows.map(ruleRow);
}

export async function recordRun(ruleId, { inputEvent, conditionsPassed, actionsAttempted, outcomes, error }) {
  await getPool().query(
    `INSERT INTO escalation_rule_runs (rule_id, input_event, conditions_passed, actions_attempted, outcomes, error)
     VALUES ($1,$2::jsonb,$3,$4::jsonb,$5::jsonb,$6)`,
    [
      ruleId,
      JSON.stringify(inputEvent),
      conditionsPassed,
      JSON.stringify(actionsAttempted),
      JSON.stringify(outcomes),
      error ?? null,
    ],
  );
}

function runRow(r) {
  return {
    id: r.id,
    ruleId: r.rule_id,
    ruleName: r.rule_name,
    triggeredAt: r.triggered_at,
    inputEvent: r.input_event ?? {},
    conditionsPassed: r.conditions_passed,
    actionsAttempted: r.actions_attempted ?? [],
    outcomes: r.outcomes ?? [],
    error: r.error,
  };
}

export async function listRuleRuns(tenantId, { ruleId = null, limit = 50 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const { rows } = await getPool().query(
    `SELECT rr.*, r.name AS rule_name
     FROM escalation_rule_runs rr
     JOIN escalation_rules r ON r.id = rr.rule_id
     JOIN escalation_rulesets s ON s.id = r.ruleset_id
     WHERE s.tenant_id = $1
       AND ($2::uuid IS NULL OR rr.rule_id = $2::uuid)
     ORDER BY rr.triggered_at DESC
     LIMIT $3`,
    [tenantId, ruleId, cap],
  );
  return rows.map(runRow);
}

export async function ruleRunStats(tenantId, ruleIds) {
  if (!ruleIds?.length) return {};
  const { rows } = await getPool().query(
    `SELECT r.id AS rule_id,
            COUNT(rr.id)::int AS run_count,
            MAX(rr.triggered_at) AS last_triggered_at
     FROM escalation_rules r
     JOIN escalation_rulesets s ON s.id = r.ruleset_id
     LEFT JOIN escalation_rule_runs rr ON rr.rule_id = r.id
     WHERE s.tenant_id = $1 AND r.id = ANY($2::uuid[])
     GROUP BY r.id`,
    [tenantId, ruleIds],
  );
  return Object.fromEntries(
    rows.map(r => [
      r.rule_id,
      { runCount: r.run_count, lastTriggeredAt: r.last_triggered_at },
    ]),
  );
}
