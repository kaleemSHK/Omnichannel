import { getPool } from './db.js';

export async function getAgentReports(tenantId, query = {}) {
  const p = getPool();
  const from = query.from || new Date(Date.now() - 7 * 86400_000).toISOString();
  const to = query.to || new Date().toISOString();

  const { rows: agentRows } = await p.query(
    `SELECT agent_id,
            COUNT(*) FILTER (WHERE decision = 'assigned') AS handled,
            COUNT(*) FILTER (WHERE decision = 'enqueued') AS offered,
            COUNT(*) FILTER (WHERE decision = 'completed') AS completed,
            AVG((metadata->>'durationMs')::float) FILTER (WHERE decision = 'completed') AS avg_handle_ms
     FROM routing_decisions
     WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
       AND agent_id IS NOT NULL
     GROUP BY agent_id
     ORDER BY handled DESC`,
    [tenantId, from, to],
  );

  const { rows: abandonRows } = await p.query(
    `SELECT COUNT(*)::int AS abandoned
     FROM routing_decisions
     WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
       AND decision IN ('rejected_max_depth', 'abandoned')`,
    [tenantId, from, to],
  );

  const abandoned = abandonRows[0]?.abandoned ?? 0;
  const offered = agentRows.reduce((n, r) => n + Number(r.offered), 0);
  const abandonmentRate = offered > 0 ? abandoned / (offered + abandoned) : 0;

  return {
    tenantId,
    from,
    to,
    summary: {
      abandoned,
      abandonmentRate: Math.round(abandonmentRate * 1000) / 1000,
    },
    agents: agentRows.map((r) => ({
      agentId: r.agent_id,
      handled: Number(r.handled),
      offered: Number(r.offered),
      completed: Number(r.completed),
      avgHandleMs: r.avg_handle_ms != null ? Math.round(Number(r.avg_handle_ms)) : null,
      occupancy: r.handled > 0 ? Math.round((Number(r.completed) / Number(r.handled)) * 100) / 100 : 0,
    })),
  };
}
