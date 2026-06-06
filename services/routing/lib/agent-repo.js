import { getPool } from './db.js';
import { setAgentState, getAgentState, listAgentStates } from './redis-state.js';

/**
 * Map a DB row + skill/queue arrays to the agent shape.
 *
 * skills is now [{skill, proficiency}] (new format).
 * We also expose the legacy `skills: string[]` field so that
 * selection.js agentMatchesQueue fallback and any existing consumers
 * continue to work without change.
 */
function rowToAgent(row, skills = [], queueKeys = []) {
  // skills is [{skill, proficiency}] — legacy string[] shape derived from it
  const agentSkills = skills.map((s) =>
    typeof s === 'string' ? { skill: s, proficiency: 3 } : s,
  );
  return {
    id: row.id,
    tenantId: row.tenant_id,
    agentId: row.agent_id,
    displayName: row.display_name,
    chatwootUserId: row.chatwoot_user_id,
    // New: proficiency-aware skill array
    agentSkills,
    // Legacy: plain string array (backward compat)
    skills: agentSkills.map((s) => s.skill),
    queueKeys,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

/**
 * Load skills for an agent DB row.
 * Returns [{skill, proficiency}] — new format.
 * Column proficiency defaults to 3 for rows created before migration 004.
 */
async function loadAgentSkills(agentDbId) {
  const p = getPool();
  const { rows } = await p.query(
    'SELECT skill, COALESCE(proficiency, 3) AS proficiency FROM routing_agent_skills WHERE agent_id = $1 ORDER BY skill',
    [agentDbId],
  );
  return rows.map((r) => ({ skill: r.skill, proficiency: Number(r.proficiency) }));
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
      const skillName = typeof skill === 'string' ? skill : skill.skill;
      const proficiency = (typeof skill === 'object' && skill.proficiency) ? skill.proficiency : 3;
      await client.query(
        'INSERT INTO routing_agent_skills (agent_id, skill, proficiency) VALUES ($1, $2, $3) ON CONFLICT (agent_id, skill) DO UPDATE SET proficiency = EXCLUDED.proficiency',
        [agent.id, skillName, proficiency],
      );
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
      const skillName = typeof skill === 'string' ? skill : skill.skill;
      const proficiency = (typeof skill === 'object' && skill.proficiency) ? skill.proficiency : 3;
      await p.query(
        'INSERT INTO routing_agent_skills (agent_id, skill, proficiency) VALUES ($1, $2, $3)',
        [dbId, skillName, proficiency],
      );
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

  const liveStatus = patch.status ?? patch.state;
  if (liveStatus) {
    const mapped = liveStatus === 'break' ? 'away' : liveStatus;
    const skills =
      patch.skills?.length ? patch.skills : existing.skills?.length ? existing.skills : ['support'];
    const queueKeys =
      patch.queueKeys?.length
        ? patch.queueKeys
        : existing.queueKeys?.length
          ? existing.queueKeys
          : ['support', 'default'];
    await updateAgentLiveState(tenantId, agentId, {
      status: mapped,
      skills,
      queueKeys,
      currentCallId: patch.currentCallId,
      occupancy: patch.occupancy,
    });
  }

  return getAgent(tenantId, agentId);
}

export async function updateAgentLiveState(tenantId, agentId, patch) {
  const agent = await getAgent(tenantId, agentId);
  const skills = patch.skills ?? agent?.skills ?? [];
  const agentSkills = patch.agentSkills ?? agent?.agentSkills ?? [];
  const queueKeys = patch.queueKeys ?? agent?.queueKeys ?? [];
  return setAgentState(tenantId, agentId, { ...patch, skills, agentSkills, queueKeys });
}

// ─── Skill proficiency CRUD ──────────────────────────────────────────────────

/**
 * Get the DB row id for an agent by tenant+agentId string.
 * Returns null if not found.
 */
async function getAgentDbId(tenantId, agentId) {
  const p = getPool();
  const { rows } = await p.query(
    'SELECT id FROM routing_agents WHERE tenant_id = $1 AND agent_id = $2',
    [tenantId, agentId],
  );
  return rows[0]?.id ?? null;
}

/**
 * List all skills for a single agent.
 * Returns [{skill, proficiency}]
 */
export async function listAgentSkills(tenantId, agentId) {
  const dbId = await getAgentDbId(tenantId, agentId);
  if (!dbId) return [];
  return loadAgentSkills(dbId);
}

/**
 * Upsert a skill+proficiency for an agent. Creates agent record if missing.
 * @param {string} tenantId
 * @param {string} agentId
 * @param {string} skill
 * @param {number} proficiency — 1 to 5
 */
export async function upsertAgentSkill(tenantId, agentId, skill, proficiency) {
  if (proficiency < 1 || proficiency > 5) {
    const err = new Error('proficiency must be between 1 and 5');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const p = getPool();
  let dbId = await getAgentDbId(tenantId, agentId);
  if (!dbId) {
    // Auto-create agent record if it doesn't exist (e.g. headless update)
    const { rows } = await p.query(
      `INSERT INTO routing_agents (tenant_id, agent_id) VALUES ($1, $2)
       ON CONFLICT (tenant_id, agent_id) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [tenantId, agentId],
    );
    dbId = rows[0].id;
  }
  await p.query(
    `INSERT INTO routing_agent_skills (agent_id, skill, proficiency)
     VALUES ($1, $2, $3)
     ON CONFLICT (agent_id, skill)
     DO UPDATE SET proficiency = EXCLUDED.proficiency`,
    [dbId, skill, proficiency],
  );
  // Refresh Redis state so selection picks up new proficiency immediately
  const agent = await getAgent(tenantId, agentId);
  if (agent) {
    await setAgentState(tenantId, agentId, {
      agentSkills: agent.agentSkills,
      skills: agent.skills,
    });
  }
}

/**
 * Delete a skill from an agent.
 */
export async function deleteAgentSkill(tenantId, agentId, skill) {
  const dbId = await getAgentDbId(tenantId, agentId);
  if (!dbId) return;
  const p = getPool();
  await p.query(
    'DELETE FROM routing_agent_skills WHERE agent_id = $1 AND skill = $2',
    [dbId, skill],
  );
  // Refresh Redis state
  const agent = await getAgent(tenantId, agentId);
  if (agent) {
    await setAgentState(tenantId, agentId, {
      agentSkills: agent.agentSkills,
      skills: agent.skills,
    });
  }
}

/**
 * List all agents with their proficiency skills for a tenant.
 * Returns [{agentId, displayName, agentSkills:[{skill,proficiency}]}]
 */
export async function listAgentsWithSkills(tenantId) {
  const agents = await listAgents(tenantId);
  return agents.map((a) => ({
    agentId: a.agentId,
    displayName: a.displayName,
    agentSkills: a.agentSkills ?? [],
  }));
}
