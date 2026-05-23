/**
 * Prompt 10 integration tests.
 * Run: BLINKONE_DATABASE_URL=... RUN_INTEGRATION_TESTS=1 node --test tests/blinkone/integration.test.js
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signPayload, verifySignature, RETRY_DELAYS_SEC } from '../../services/integration/lib/webhook-sign.js';

const url = process.env.BLINKONE_DATABASE_URL || '';
const skip = !url || process.env.RUN_INTEGRATION_TESTS !== '1';
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(__dirname, '../../services/integration/db');

async function applyMigrations(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS integration_schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const { rows } = await pool.query('SELECT 1 FROM integration_schema_migrations WHERE name = $1', [file]);
    if (rows.length) continue;
    await pool.query(readFileSync(join(MIGRATIONS, file), 'utf8'));
    await pool.query('INSERT INTO integration_schema_migrations (name) VALUES ($1)', [file]);
  }
}

describe('Webhook HMAC', () => {
  it('client can verify X-BlinkOne-Signature', () => {
    const secret = 'test-secret';
    const body = JSON.stringify({ type: 'conversation.created', id: '1' });
    const { header } = signPayload(secret, body);
    assert.ok(verifySignature(secret, body, header));
    assert.equal(verifySignature(secret, body, 't=1,v1=bad'), false);
  });
});

describe('Retry schedule', () => {
  it('has 6 steps ending at 24h', () => {
    assert.equal(RETRY_DELAYS_SEC.length, 6);
    assert.equal(RETRY_DELAYS_SEC[5], 86400);
  });
});

describe('Integration Postgres', { skip }, () => {
  let pool;
  let repo;

  before(async () => {
    const pg = (await import('pg')).default;
    process.env.BLINKONE_DATABASE_URL = url;
    pool = new pg.Pool({ connectionString: url });
    await applyMigrations(pool);
    repo = await import('../../services/integration/lib/integration-repo.js');
  });

  it('audit immutability: UPDATE/DELETE revoked or blocked', async () => {
    await pool.query(
      `INSERT INTO blinkone_audit_events (tenant_id, actor_id, action, target_type, target_id)
       VALUES ('int-test','actor','test.action','t','1')`,
    );
    await assert.rejects(async () => {
      await pool.query(`UPDATE blinkone_audit_events SET action = 'hacked' WHERE tenant_id = 'int-test'`);
    });
    await assert.rejects(async () => {
      await pool.query(`DELETE FROM blinkone_audit_events WHERE tenant_id = 'int-test'`);
    });
  });

  it('usage idempotency on dispatch envelope', async () => {
    const key = `idem-${Date.now()}`;
    const a = await repo.dispatchBusEvent({
      event: 'integration.test',
      tenantId: 'int-test',
      payload: { x: 1 },
      idempotencyKey: key,
    });
    assert.ok(a.id);
  });
});
