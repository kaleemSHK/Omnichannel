import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { tenantQuery } from '../lib/pg-tenant.js';

const url = process.env.BLINKONE_DATABASE_URL || '';
const skip = !url || process.env.RUN_RLS_TESTS !== '1';

describe('RLS cross-tenant isolation', { skip }, () => {
  /** @type {pg.Pool} */
  let pool;
  const tenantA = 'rls-test-a';
  const tenantB = 'rls-test-b';

  before(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query(
      `INSERT INTO tenants (id, name, slug, status, owner_email, chatwoot_account_id)
       VALUES ($1,'A','a','active','a@test',1), ($2,'B','b','active','b@test',2)
       ON CONFLICT (id) DO NOTHING`,
      [tenantA, tenantB],
    );
    await pool.query(
      `DELETE FROM business_hours_calendars WHERE tenant_id IN ($1,$2)`,
      [tenantA, tenantB],
    );
    await tenantQuery(
      pool,
      tenantA,
      `INSERT INTO business_hours_calendars (tenant_id, name, timezone) VALUES ($1,$2,'UTC')`,
      [tenantA, `rls-cal-${tenantA}`],
    );
  });

  it('tenant B cannot read tenant A calendars when app.tenant_id=B', async () => {
    const { rows } = await tenantQuery(
      pool,
      tenantB,
      `SELECT * FROM business_hours_calendars WHERE tenant_id = $1`,
      [tenantA],
    );
    assert.equal(rows.length, 0, 'RLS must hide tenant A rows from tenant B context');
  });

  it('tenant A sees only own calendars', async () => {
    const { rows } = await tenantQuery(
      pool,
      tenantA,
      'SELECT * FROM business_hours_calendars',
      [],
    );
    assert.ok(rows.every((r) => r.tenant_id === tenantA));
  });
});
