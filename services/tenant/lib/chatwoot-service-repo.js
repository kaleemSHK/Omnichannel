import { getPool } from './db.js';

export async function getServiceRecord(tenantId) {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    'SELECT * FROM tenant_chatwoot_service WHERE tenant_id = $1 LIMIT 1',
    [String(tenantId)],
  );
  return rows[0] ?? null;
}

export async function upsertServiceRecord({
  tenantId,
  chatwootUserId,
  serviceEmail,
  accessToken,
}) {
  const pool = getPool();
  if (!pool) throw new Error('Database not configured');
  const { rows } = await pool.query(
    `INSERT INTO tenant_chatwoot_service (
       tenant_id, chatwoot_user_id, service_email, access_token, token_updated_at
     ) VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (tenant_id) DO UPDATE SET
       chatwoot_user_id = EXCLUDED.chatwoot_user_id,
       service_email = EXCLUDED.service_email,
       access_token = EXCLUDED.access_token,
       token_updated_at = now()
     RETURNING *`,
    [String(tenantId), Number(chatwootUserId), serviceEmail, accessToken],
  );
  return rows[0];
}
