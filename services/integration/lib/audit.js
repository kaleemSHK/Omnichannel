import { randomUUID } from 'node:crypto';
import { getPool } from './db.js';

export async function writeAudit({
  tenantId,
  actorId = 'system',
  action,
  targetType,
  targetId,
  before,
  after,
  metadata,
}) {
  const p = getPool();
  if (!p) return null;
  const id = randomUUID();
  await p.query(
    `INSERT INTO blinkone_audit_events (id, tenant_id, actor_id, action, target_type, target_id, before, after, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, tenantId, actorId, action, targetType, targetId, before ?? null, after ?? null, metadata ?? null],
  );
  return id;
}

export async function listAudit(tenantId, filters = {}) {
  const p = getPool();
  if (!p) return { rows: [], total: 0 };
  const {
    actorId,
    action,
    targetType,
    targetId,
    from,
    to,
    limit = 50,
    offset = 0,
  } = filters;
  const clauses = ['tenant_id = $1'];
  const params = [tenantId];
  let n = 2;
  if (actorId) {
    clauses.push(`actor_id = $${n++}`);
    params.push(actorId);
  }
  if (action) {
    clauses.push(`action = $${n++}`);
    params.push(action);
  }
  if (targetType) {
    clauses.push(`target_type = $${n++}`);
    params.push(targetType);
  }
  if (targetId) {
    clauses.push(`target_id = $${n++}`);
    params.push(targetId);
  }
  if (from) {
    clauses.push(`occurred_at >= $${n++}`);
    params.push(from);
  }
  if (to) {
    clauses.push(`occurred_at <= $${n++}`);
    params.push(to);
  }
  const where = clauses.join(' AND ');
  const { rows: countRows } = await p.query(`SELECT COUNT(*)::int AS c FROM blinkone_audit_events WHERE ${where}`, params);
  params.push(limit, offset);
  const { rows } = await p.query(
    `SELECT * FROM blinkone_audit_events WHERE ${where} ORDER BY occurred_at DESC LIMIT $${n++} OFFSET $${n}`,
    params,
  );
  return { rows, total: countRows[0]?.c ?? 0 };
}
