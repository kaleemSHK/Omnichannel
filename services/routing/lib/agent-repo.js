import { getPool } from './db.js';
import { setAgentState, getAgentState, listAgentStates } from './redis-state.js';

function rowToAgent(row, skills = [], queueKeys = []) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    agentId: row.agent_id,
    displayName: row.display_name,
    chatwootUserId: row.chatwoot_user_id,
    skills,
    queueKeys,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

async function loadAgentSkills(agentDbId) {
  const p = getPool();
  const { rows } = await p.query(
    'SELECT skill FROM routing_agent_skills WHERE agent_id = $1 ORDER BY skill',
    [agentDbId],
  );
  return rows.map((r) => r.skill);
}

async function loadAgentQueueKeys(agentDbId) {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT q.queue_key FROM routing_agent_queues aq
     JOIN routing_queues q ON q.id = aq.queue_id
     WHERE aq.agent_id = $1`,
    [agentDbId],
  );
  return rows.map((r) => r.queue_key);
}

export async function listAgents(tenantId) {
  const p = getPool();
  const { rows } = await p.query(
    'SELECT * FROM routing_agents WHERE tenant_id = $1 ORDER BY agent_id',
    [tenantId],
  );
  const live = await listAgentStates(tenantId);
  const liveById = new Map(live.map((a) => [a.agentId, a]));

  const out = [];
  for (const row of rows) {
    const base = rowToAgent(
      row,
      await loadAgentSkills(row.id),
      await loadAgentQueueKeys(row.id),
    );
    const state = liveById.get(row.agent_id);
    out.push({
      ...base,
      status: state?.status ?? 'offline',
      currentCallId: state?.currentCallId ?? null,
      lastIdleAt: state?.lastIdleAt ?? null,
      occupancy: state?.occupancy ?? 0,
      liveUpdatedAt: state?.updatedAt ?? null,
    });
  }
  return out;
}

export async function getAgent(tenantId, agentId) {
  const p = getPool();
  const { rows } = await p.query(
    'SELECT * FROM routing_agents WHERE tenant_id = $1 AND agent_id = $2',
    [tenantId, agentId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  const base = rowToAgent(
    row,
    await loadAgentSkills(row.id),
    await loadAgentQueueKeys(row.id),
  );
  const state = await getAgentState(tenantId, agentId);
  return {
    ...base,
    status: state?.status ?? 'offline',
    currentCallId: state?.currentCallId ?? null,
    lastIdleAt: state?.lastIdleAt ?? null,
    occupancy: state?.occupancy ?? 0,
    liveUpdatedAt: state?.updatedAt ?? null,
  };
}

export async function createAgent(tenantId, { agentId, displayName, chatwootUserId, skills = [], queueKeys = [], status }) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO routing_agents (tenant_id, agent_id, display_name, chatwoot_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, agentId, displayName ?? null, chatwootUserId ?? agentId],
    );
    const agent = rows[0];
    for (const skill of skills) {
      await client.query('INSERT INTO routing_agent_skills (agent_id, skill) VALUES ($1, $2)', [
        agent.id,
        typeof skill === 'string' ? skill : skill.skill,
      ]);
    }
    if (queueKeys.length) {
      for (const qk of queueKeys) {
        const { rows: qrows } = await client.query(
          'SELECT id FROM routing_queues WHERE tenant_id = $1 AND queue_key = $2',
          [tenantId, qk],
        );
        if (qrows[0]) {
          await client.query(
            'INSERT INTO routing_agent_queues (agent_id, queue_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [agent.id, qrows[0].id],
          );
        }
      }
    }
    await client.query('COMMIT');

    const skillList = await loadAgentSkills(agent.id);
    const qKeys = await loadAgentQueueKeys(agent.id);
    if (status) {
      await setAgentState(tenantId, agentId, { status, skills: skillList, queueKeys: qKeys });
    }
    return getAgent(tenantId, agentId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function patchAgent(tenantId, agentId, patch) {
  const p = getPool();
  const existing = await getAgent(tenantId, agentId);
  if (!existing) return null;

  const { rows } = await p.query(
    'SELECT id FROM routing_agents WHERE tenant_id = $1 AND agent_id = $2',
    [tenantId, agentId],
  );
  const dbId = rows[0].id;

  if (patch.displayName !== undefined || patch.chatwootUserId !== undefined) {
    await p.query(
      `UPDATE routing_agents SET
         display_name = COALESCE($3, display_name),
         chatwoot_user_id = COALESCE($4, chatwoot_user_id),
         updated_at = now()
       WHERE tenant_id = $1 AND agent_id = $2`,
      [tenantId, agentId, patch.displayName ?? null, patch.chatwootUserId ?? null],
    );
  }

  if (patch.skills) {
    await p.query('DELETE FROM routing_agent_skills WHERE agent_id = $1', [dbId]);
    for (const skill of patch.skills) {
      await p.query('INSERT INTO routing_agent_skills (agent_id, skill) VALUES ($1, $2)', [
        dbId,
        typeof skill === 'string' ? skill : skill.skill,
      ]);
    }
  }

  if (patch.queueKeys) {
    await p.query('DELETE FROM routing_agent_queues WHERE agent_id = $1', [dbId]);
    for (const qk of patch.queueKeys) {
      const { rows: qrows } = await p.query(
        'SELECT id FROM routing_queues WHERE tenant_id = $1 AND queue_key = $2',
        [tenantId, qk],
      );
      if (qrows[0]) {
        await p.query('INSERT INTO routing_agent_queues (agent_id, queue_id) VALUES ($1, $2)', [
          dbId,
          qrows[0].id,
        ]);
      }
    }
  }

  return getAgent(tenantId, agentId);
}

export async function updateAgentLiveState(tenantId, agentId, patch) {
  const agent = await getAgent(tenantId, agentId);
  const skills = patch.skills ?? agent?.skills ?? [];
  const queueKeys = patch.queueKeys ?? agent?.queueKeys ?? [];
  return setAgentState(tenantId, agentId, { ...patch, skills, queueKeys });
}
