import { getPool } from './db.js';

function rowToQueue(row, skills = []) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    queueKey: row.queue_key,
    name: row.name,
    selectionAlgorithm: row.selection_algorithm,
    maxWaitSec: row.max_wait_sec,
    maxDepth: row.max_depth,
    overflowQueueId: row.overflow_queue_id,
    config: row.config ?? {},
    skills,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

async function loadSkills(queueId) {
  const p = getPool();
  const { rows } = await p.query(
    'SELECT skill, required FROM routing_queue_skills WHERE queue_id = $1 ORDER BY skill',
    [queueId],
  );
  return rows.map((r) => ({ skill: r.skill, required: r.required }));
}

export async function ensureDefaultQueues(tenantId = 'default') {
  const defaults = [
    { queueKey: 'sales', name: 'Sales', skills: [{ skill: 'sales', required: true }] },
    { queueKey: 'support', name: 'Support', skills: [{ skill: 'support', required: true }] },
    { queueKey: 'default', name: 'General', skills: [] },
  ];
  for (const q of defaults) {
    const existing = await getQueueByKey(tenantId, q.queueKey);
    if (!existing) {
      await createQueue(tenantId, q);
    }
  }
}

export async function listQueues(tenantId) {
  const p = getPool();
  const { rows } = await p.query(
    'SELECT * FROM routing_queues WHERE tenant_id = $1 ORDER BY queue_key',
    [tenantId],
  );
  const out = [];
  for (const row of rows) {
    out.push(rowToQueue(row, await loadSkills(row.id)));
  }
  return out;
}

export async function getQueue(tenantId, id) {
  const p = getPool();
  const { rows } = await p.query('SELECT * FROM routing_queues WHERE tenant_id = $1 AND id = $2', [
    tenantId,
    id,
  ]);
  if (!rows.length) return null;
  return rowToQueue(rows[0], await loadSkills(rows[0].id));
}

export async function getQueueByKey(tenantId, queueKey) {
  const p = getPool();
  const { rows } = await p.query(
    'SELECT * FROM routing_queues WHERE tenant_id = $1 AND queue_key = $2',
    [tenantId, queueKey],
  );
  if (!rows.length) return null;
  return rowToQueue(rows[0], await loadSkills(rows[0].id));
}

export async function createQueue(tenantId, { queueKey, name, skills = [], selectionAlgorithm, maxWaitSec, maxDepth, overflowQueueId, config }) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO routing_queues (tenant_id, queue_key, name, selection_algorithm, max_wait_sec, max_depth, overflow_queue_id, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING *`,
      [
        tenantId,
        queueKey,
        name,
        selectionAlgorithm || 'longest_idle',
        maxWaitSec ?? null,
        maxDepth ?? null,
        overflowQueueId ?? null,
        JSON.stringify(config ?? {}),
      ],
    );
    const queue = rows[0];
    for (const s of skills) {
      await client.query(
        'INSERT INTO routing_queue_skills (queue_id, skill, required) VALUES ($1, $2, $3)',
        [queue.id, s.skill ?? s, s.required !== false],
      );
    }
    await client.query('COMMIT');
    return rowToQueue(queue, await loadSkills(queue.id));
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function patchQueue(tenantId, id, patch) {
  const p = getPool();
  const existing = await getQueue(tenantId, id);
  if (!existing) return null;

  const sets = [];
  const vals = [tenantId, id];
  let i = 3;
  if (patch.name != null) {
    sets.push(`name = $${i++}`);
    vals.push(patch.name);
  }
  if (patch.selectionAlgorithm != null) {
    sets.push(`selection_algorithm = $${i++}`);
    vals.push(patch.selectionAlgorithm);
  }
  if (patch.maxWaitSec !== undefined) {
    sets.push(`max_wait_sec = $${i++}`);
    vals.push(patch.maxWaitSec);
  }
  if (patch.maxDepth !== undefined) {
    sets.push(`max_depth = $${i++}`);
    vals.push(patch.maxDepth);
  }
  if (patch.overflowQueueId !== undefined) {
    sets.push(`overflow_queue_id = $${i++}`);
    vals.push(patch.overflowQueueId);
  }
  if (patch.config != null) {
    sets.push(`config = $${i++}::jsonb`);
    vals.push(JSON.stringify(patch.config));
  }
  if (sets.length) {
    sets.push('updated_at = now()');
    await p.query(`UPDATE routing_queues SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`, vals);
  }

  if (patch.skills) {
    await p.query('DELETE FROM routing_queue_skills WHERE queue_id = $1', [id]);
    for (const s of patch.skills) {
      await p.query(
        'INSERT INTO routing_queue_skills (queue_id, skill, required) VALUES ($1, $2, $3)',
        [id, s.skill ?? s, s.required !== false],
      );
    }
  }

  return getQueue(tenantId, id);
}

export async function recordDecision({ tenantId, callId, queueId, decision, agentId, metadata }) {
  const p = getPool();
  await p.query(
    `INSERT INTO routing_decisions (tenant_id, call_id, queue_id, decision, agent_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [tenantId, callId, queueId ?? null, decision, agentId ?? null, JSON.stringify(metadata ?? {})],
  );
}
