/**
 * Prompt 8 step 10 — cross-tenant isolation gauntlet.
 * Run: BLINKONE_DATABASE_URL=... RUN_GAUNTLET=1 node --test tests/blinkone/cross-tenant-gauntlet.test.js
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { tenantQuery, withTenantClient } from '../../services/tenant/lib/pg-tenant.js';

const url = process.env.BLINKONE_DATABASE_URL || '';
const skip = !url || process.env.RUN_GAUNTLET !== '1';

const TENANT_A = 'gauntlet-a';
const TENANT_B = 'gauntlet-b';

describe('Cross-tenant gauntlet', { skip }, () => {
  /** @type {pg.Pool} */
  let pool;

  before(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query(
      `INSERT INTO tenants (id, name, slug, status, owner_email, chatwoot_account_id)
       VALUES ($1,'Gauntlet A','gauntlet-a','active','a@g.test',9001),
              ($2,'Gauntlet B','gauntlet-b','active','b@g.test',9002)
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_A, TENANT_B],
    );
  });

  const tablesWithTenantId = [
    ['business_hours_calendars', 'name', 'Cal'],
    ['sla_policies', 'name', 'Policy'],
    ['routing_queues', 'queue_key', 'q'],
    ['ivr_flows', 'name', 'Flow'],
    ['escalation_rulesets', 'name', 'Rules'],
    ['rag_collections', 'name', 'KB'],
    ['call_sessions', 'room_id', 'room'],
  ];

  for (const [table, col, label] of tablesWithTenantId) {
    it(`${table}: A write hidden from B`, async () => {
      const uniq = `${label}-${Date.now()}`;
      await withTenantClient(pool, TENANT_A, async (client) => {
        if (table === 'business_hours_calendars') {
          await client.query(
            `INSERT INTO ${table} (tenant_id, name, timezone) VALUES ($1,$2,'UTC')`,
            [TENANT_A, uniq],
          );
        } else if (table === 'routing_queues') {
          await client.query(
            `INSERT INTO ${table} (tenant_id, queue_key, name) VALUES ($1,$2,$3)`,
            [TENANT_A, uniq, uniq],
          );
        } else if (table === 'call_sessions') {
          await client.query(
            `INSERT INTO ${table} (tenant_id, room_id, started_at) VALUES ($1,$2,now())`,
            [TENANT_A, uniq],
          );
        } else {
          await client.query(
            `INSERT INTO ${table} (tenant_id, ${col}) VALUES ($1,$2)`,
            [TENANT_A, uniq],
          );
        }
      });

      const { rows } = await tenantQuery(
        pool,
        TENANT_B,
        `SELECT * FROM ${table} WHERE ${col} = $1`,
        [uniq],
      );
      assert.equal(rows.length, 0, `Tenant B must not see ${table} row from A`);
    });
  }

  it('tenant_domains: custom domain maps to single tenant', async () => {
    const domain = `gauntlet-${Date.now()}.test.local`;
    await pool.query(
      `INSERT INTO tenant_domains (tenant_id, domain, is_primary) VALUES ($1,$2,true)`,
      [TENANT_A, domain],
    );
    const { rows } = await pool.query(
      'SELECT tenant_id FROM tenant_domains WHERE domain = $1',
      [domain],
    );
    assert.equal(rows[0].tenant_id, TENANT_A);
  });

  it('Redis key prefix convention', async () => {
    const { tenantRedisKey } = await import('../../services/_shared/lib/redis-keys.js');
    assert.equal(tenantRedisKey('5', 'routing', 'agent', '1'), 't:5:routing:agent:1');
    assert.throws(() => tenantRedisKey('', 'x'));
  });
});
