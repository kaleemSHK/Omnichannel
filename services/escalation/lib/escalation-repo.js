import { getPool } from './db.js';
import { validateTrigger, validateActions, validateLogic } from './json-logic-safe.js';

export function resolveTenantId(req) {
  const h = req.headers['x-blinkone-tenant-id'];
  if (typeof h === 'string' && h.trim()) return h.trim();
  return String(req.body?.tenant_id ?? req.query?.tenant_id ?? process.env.ESCALATION_DEFAULT_TENANT ?? 'default');
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

export async function rulesForTrigger(tenantId, trigger) {
  const { rows } = await getPool().query(
    `SELECT r.* FROM escalation_rules r
     JOIN escalation_rulesets s ON s.id = r.ruleset_id
     WHERE s.tenant_id = $1 AND s.enabled = true AND r.enabled = true AND r.trigger = $2`,
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
