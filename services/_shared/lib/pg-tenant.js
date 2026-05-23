/**
 * Postgres tenant context for RLS (Prompt 8).
 * SET LOCAL app.tenant_id for the transaction — fail-closed when unset.
 */
export async function withTenantClient(pool, tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [String(tenantId)]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function tenantQuery(pool, tenantId, text, params = []) {
  return withTenantClient(pool, tenantId, (client) => client.query(text, params));
}
