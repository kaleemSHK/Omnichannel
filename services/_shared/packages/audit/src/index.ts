import { randomUUID } from 'node:crypto';
import { getTenantContext } from '@blinkone/tenant-context';

export interface AuditWriter {
  audit(
    action: string,
    target: { type: string; id: string },
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}

let poolPromise: Promise<import('pg').Pool | null> | null = null;

async function getPool(): Promise<import('pg').Pool | null> {
  const url = process.env.BLINKONE_DATABASE_URL;
  if (!url) return null;
  if (!poolPromise) {
    poolPromise = import('pg').then(({ default: pg }) => new pg.Pool({ connectionString: url, max: 3 }));
  }
  return poolPromise;
}

/** TR-57 append-only audit — persists to blinkone_audit_events when BLINKONE_DATABASE_URL is set */
export function createAuditWriter(): AuditWriter {
  return {
    async audit(action, target, before, after, metadata) {
      const ctx = getTenantContext();
      await persistAuditRow({
        tenant_id: ctx.tenantId,
        actor_id: ctx.userId || 'system',
        action,
        target_type: target.type,
        target_id: target.id,
        before: before ?? null,
        after: after ?? null,
        metadata: metadata ?? null,
      });
    },
  };
}

export async function persistAuditRow(row: {
  tenant_id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}): Promise<string | null> {
  const pool = await getPool();
  if (!pool) return null;
  const id = randomUUID();
  await pool.query(
    `INSERT INTO blinkone_audit_events (id, tenant_id, actor_id, action, target_type, target_id, before, after, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      row.tenant_id,
      row.actor_id,
      row.action,
      row.target_type,
      row.target_id,
      row.before ?? null,
      row.after ?? null,
      row.metadata ?? null,
    ],
  );
  return id;
}
