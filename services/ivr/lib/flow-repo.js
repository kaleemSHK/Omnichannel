import { getPool } from './db.js';

const DEFAULT_GRAPH = {
  entry: 'welcome',
  nodes: [
    {
      id: 'welcome',
      type: 'play',
      media: process.env.IVR_WELCOME_MEDIA || 'sound:hello-world',
      text: 'Thank you for calling BlinkOne.',
      next: 'hangup',
    },
    { id: 'hangup', type: 'hangup' },
  ],
};

function rowToFlow(row, graph = null) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description ?? null,
    isDefault: row.is_default,
    activeVersionId: row.active_version_id ?? null,
    activeVersion: row.active_version ?? null,
    graph: graph ?? row.graph ?? null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

function rowToVersion(row) {
  return {
    id: row.id,
    flowId: row.flow_id,
    version: row.version,
    graph: row.graph,
    comment: row.comment ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  };
}

export async function ensureDefaultFlow(tenantId = 'default') {
  const p = getPool();
  if (!p) return null;
  const { rows } = await p.query('SELECT id FROM ivr_flows WHERE tenant_id = $1 AND is_default = true LIMIT 1', [
    tenantId,
  ]);
  if (rows.length) return rows[0].id;

  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const { rows: flowRows } = await client.query(
      `INSERT INTO ivr_flows (tenant_id, name, description, is_default)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [tenantId, 'Default IVR', 'Auto-seeded welcome flow'],
    );
    const flow = flowRows[0];
    const { rows: verRows } = await client.query(
      `INSERT INTO ivr_flow_versions (flow_id, version, graph, comment, created_by)
       VALUES ($1, 1, $2::jsonb, $3, $4)
       RETURNING *`,
      [flow.id, JSON.stringify(DEFAULT_GRAPH), 'Initial seed', 'system'],
    );
    const ver = verRows[0];
    await client.query(
      'UPDATE ivr_flows SET active_version_id = $1, updated_at = now() WHERE id = $2',
      [ver.id, flow.id],
    );
    await client.query('COMMIT');
    return flow.id;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listFlows(tenantId) {
  const p = getPool();
  if (!p) return [];
  await ensureDefaultFlow(tenantId);
  const { rows } = await p.query(
    `SELECT f.*, v.version AS active_version, v.graph
     FROM ivr_flows f
     LEFT JOIN ivr_flow_versions v ON v.id = f.active_version_id
     WHERE f.tenant_id = $1
     ORDER BY f.is_default DESC, f.name ASC`,
    [tenantId],
  );
  return rows.map((r) => rowToFlow(r, r.graph));
}

export async function getFlow(tenantId, flowId) {
  const p = getPool();
  if (!p) return null;
  const { rows } = await p.query(
    `SELECT f.*, v.version AS active_version, v.graph
     FROM ivr_flows f
     LEFT JOIN ivr_flow_versions v ON v.id = f.active_version_id
     WHERE f.tenant_id = $1 AND f.id = $2`,
    [tenantId, flowId],
  );
  return rows[0] ? rowToFlow(rows[0], rows[0].graph) : null;
}

export async function createFlow(tenantId, { name, description, graph, createdBy }) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const { rows: flowRows } = await client.query(
      `INSERT INTO ivr_flows (tenant_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tenantId, name, description ?? null],
    );
    const flow = flowRows[0];
    const { rows: verRows } = await client.query(
      `INSERT INTO ivr_flow_versions (flow_id, version, graph, comment, created_by)
       VALUES ($1, 1, $2::jsonb, $3, $4)
       RETURNING *`,
      [flow.id, JSON.stringify(graph), 'Initial version', createdBy ?? null],
    );
    const ver = verRows[0];
    await client.query(
      'UPDATE ivr_flows SET active_version_id = $1, updated_at = now() WHERE id = $2',
      [ver.id, flow.id],
    );
    await client.query('COMMIT');
    return { flow: rowToFlow(flow), version: rowToVersion(ver) };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function patchFlow(tenantId, flowId, patch) {
  const p = getPool();
  const sets = [];
  const vals = [tenantId, flowId];
  let i = 3;

  if (patch.name != null) {
    sets.push(`name = $${i++}`);
    vals.push(patch.name);
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${i++}`);
    vals.push(patch.description);
  }
  if (patch.isDefault != null) {
    if (patch.isDefault) {
      await p.query('UPDATE ivr_flows SET is_default = false WHERE tenant_id = $1', [tenantId]);
    }
    sets.push(`is_default = $${i++}`);
    vals.push(patch.isDefault);
  }
  if (patch.activeVersionId != null) {
    const { rows: ver } = await p.query(
      'SELECT id FROM ivr_flow_versions WHERE id = $1 AND flow_id = $2',
      [patch.activeVersionId, flowId],
    );
    if (!ver.length) {
      const err = new Error('Version not found for this flow');
      err.code = 'VERSION_NOT_FOUND';
      throw err;
    }
    sets.push(`active_version_id = $${i++}`);
    vals.push(patch.activeVersionId);
  }

  if (!sets.length) return getFlow(tenantId, flowId);

  sets.push('updated_at = now()');
  const { rows } = await p.query(
    `UPDATE ivr_flows SET ${sets.join(', ')}
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    vals,
  );
  if (!rows.length) return null;
  return getFlow(tenantId, flowId);
}

export async function createVersion(tenantId, flowId, { graph, comment, createdBy, setActive = true }) {
  const p = getPool();
  const flow = await getFlow(tenantId, flowId);
  if (!flow) return null;

  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const { rows: maxRows } = await client.query(
      'SELECT COALESCE(MAX(version), 0) AS max FROM ivr_flow_versions WHERE flow_id = $1',
      [flowId],
    );
    const nextVer = Number(maxRows[0].max) + 1;
    const { rows: verRows } = await client.query(
      `INSERT INTO ivr_flow_versions (flow_id, version, graph, comment, created_by)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING *`,
      [flowId, nextVer, JSON.stringify(graph), comment ?? null, createdBy ?? null],
    );
    const ver = verRows[0];
    if (setActive) {
      await client.query(
        'UPDATE ivr_flows SET active_version_id = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3',
        [ver.id, flowId, tenantId],
      );
    } else {
      await client.query('UPDATE ivr_flows SET updated_at = now() WHERE id = $1 AND tenant_id = $2', [
        flowId,
        tenantId,
      ]);
    }
    await client.query('COMMIT');
    return { version: rowToVersion(ver), flow: await getFlow(tenantId, flowId) };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listVersions(tenantId, flowId) {
  const p = getPool();
  const flow = await getFlow(tenantId, flowId);
  if (!flow) return null;
  const { rows } = await p.query(
    `SELECT v.* FROM ivr_flow_versions v
     JOIN ivr_flows f ON f.id = v.flow_id
     WHERE f.tenant_id = $1 AND v.flow_id = $2
     ORDER BY v.version DESC`,
    [tenantId, flowId],
  );
  return rows.map(rowToVersion);
}

export async function getVersion(tenantId, flowId, versionNum) {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT v.* FROM ivr_flow_versions v
     JOIN ivr_flows f ON f.id = v.flow_id
     WHERE f.tenant_id = $1 AND v.flow_id = $2 AND v.version = $3`,
    [tenantId, flowId, versionNum],
  );
  return rows[0] ? rowToVersion(rows[0]) : null;
}

/** Active graph for ARI — default flow for tenant unless flowId given. */
export async function getActiveGraph(tenantId, flowId = null) {
  const p = getPool();
  if (!p) return { graph: DEFAULT_GRAPH, flowId: null, flowName: 'builtin' };
  await ensureDefaultFlow(tenantId);

  let sql;
  let params;
  if (flowId) {
    sql = `SELECT f.id, f.name, v.graph
           FROM ivr_flows f
           JOIN ivr_flow_versions v ON v.id = f.active_version_id
           WHERE f.tenant_id = $1 AND f.id = $2`;
    params = [tenantId, flowId];
  } else {
    sql = `SELECT f.id, f.name, v.graph
           FROM ivr_flows f
           JOIN ivr_flow_versions v ON v.id = f.active_version_id
           WHERE f.tenant_id = $1 AND f.is_default = true
           LIMIT 1`;
    params = [tenantId];
  }

  const { rows } = await p.query(sql, params);
  if (!rows.length) return { graph: DEFAULT_GRAPH, flowId: null, flowName: 'builtin' };
  return { graph: rows[0].graph, flowId: rows[0].id, flowName: rows[0].name };
}

export { DEFAULT_GRAPH };
