/**
 * Prompt 9 billing tests.
 * Run: BLINKONE_DATABASE_URL=... RUN_BILLING_TESTS=1 node --test tests/blinkone/billing.test.js
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { computeVat } from '../../services/billing/lib/vat.js';

const url = process.env.BLINKONE_DATABASE_URL || '';
const skip = !url || process.env.RUN_BILLING_TESTS !== '1';
const TENANT_A = 'billing-test-a';
const TENANT_B = 'billing-test-b';
const PLAN_TEST = 'billing-test-plan';

async function applyBillingMigrations(pool, migrationsDir) {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())
  `);
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    const { rows } = await pool.query('SELECT 1 FROM billing_schema_migrations WHERE name = $1', [file]);
    if (rows.length) continue;
    await pool.query(readFileSync(join(migrationsDir, file), 'utf8'));
    await pool.query('INSERT INTO billing_schema_migrations (name) VALUES ($1)', [file]);
  }
}

describe('Billing VAT', () => {
  it('100 OMR + 5% VAT = 105 OMR total', () => {
    const { vatOmr, totalOmr } = computeVat(100, 0.05);
    assert.equal(vatOmr, 5);
    assert.equal(totalOmr, 105);
  });
});

describe('Billing integration', { skip }, () => {
  let pool;
  let repo;
  let tenantQuery;

  before(async () => {
    const pg = (await import('pg')).default;
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../services/billing/db');
    repo = await import('../../services/billing/lib/billing-repo.js');
    ({ tenantQuery } = await import('../../services/billing/lib/pg-tenant.js'));
    process.env.BLINKONE_DATABASE_URL = url;
    pool = new pg.Pool({ connectionString: url });
    await applyBillingMigrations(pool, migrationsDir);
    await pool.query(
      `INSERT INTO billing_plans (id, name, tier, base_price_omr, included_agents, included_minutes, included_messages, included_ai_credits)
       VALUES ($1,'Test','starter',10,1,1000,100,1000) ON CONFLICT (id) DO UPDATE SET included_minutes = 1000`,
      [PLAN_TEST],
    );
    await pool.query(
      `INSERT INTO billing_plan_overage_rates (plan_id, dimension, rate_omr_per_unit) VALUES ($1,'minute',0.02)
       ON CONFLICT (plan_id, dimension) DO UPDATE SET rate_omr_per_unit = 0.02`,
      [PLAN_TEST],
    );
    for (const t of [TENANT_A, TENANT_B]) {
      await pool.query(`DELETE FROM billing_usage_events WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM billing_subscriptions WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM billing_invoices WHERE tenant_id = $1`, [t]);
    }
  });

  it('usage idempotency: duplicate source_event_id inserts once', async () => {
    await repo.assignSubscription(TENANT_A, { planId: PLAN_TEST, trialDays: 0 });
    const payload = {
      tenantId: TENANT_A,
      dimension: 'minute',
      quantity: 10,
      sourceService: 'test',
      sourceEventId: `idem-${Date.now()}`,
    };
    const a = await repo.ingestUsageEvent(payload);
    const b = await repo.ingestUsageEvent(payload);
    assert.equal(a.inserted, true);
    assert.equal(b.inserted, false);
    assert.equal(b.duplicate, true);
  });

  it('overage: 1500 minutes with 1000 included → line for 500 × rate', async () => {
    await repo.assignSubscription(TENANT_A, { planId: PLAN_TEST, trialDays: 0 });
    const sub = await repo.getActiveSubscription(TENANT_A);
    for (let i = 0; i < 1500; i++) {
      await repo.ingestUsageEvent({
        tenantId: TENANT_A,
        dimension: 'minute',
        quantity: 1,
        sourceService: 'test',
        sourceEventId: `min-${Date.now()}-${i}`,
        occurredAt: new Date().toISOString(),
      });
    }
    const usage = await repo.getTenantUsage(TENANT_A);
    assert.ok(usage.comparison.minute.overage >= 500);
    const inv = await repo.generateInvoice(TENANT_A, {
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      idempotencyKey: `test-overage-${Date.now()}`,
    });
    const overLine = inv.lines?.find((l) => l.description?.includes('Overage'));
    assert.ok(overLine, 'expected overage line');
    assert.ok(Number(overLine.quantity) >= 500);
  });

  it('cross-tenant: tenant B cannot read tenant A invoices via RLS', async () => {
    await repo.assignSubscription(TENANT_A, { planId: PLAN_TEST, trialDays: 0 });
    const sub = await repo.getActiveSubscription(TENANT_A);
    const inv = await repo.generateInvoice(TENANT_A, {
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      idempotencyKey: `rls-${Date.now()}`,
    });
    const { rows } = await tenantQuery(pool, TENANT_B, 'SELECT * FROM billing_invoices WHERE id = $1', [inv.id]);
    assert.equal(rows.length, 0);
  });

  it('getUsageLimits blocks when minute overage exceeds allowance', async () => {
    await repo.assignSubscription(TENANT_A, { planId: PLAN_TEST, trialDays: 0 });
    for (let i = 0; i < 1001; i++) {
      await repo.ingestUsageEvent({
        tenantId: TENANT_A,
        dimension: 'minute',
        quantity: 1,
        sourceService: 'test',
        sourceEventId: `limit-min-${Date.now()}-${i}`,
      });
    }
    const limits = await repo.getUsageLimits(TENANT_A);
    assert.equal(limits.blocked, true);
    assert.ok(limits.reason?.includes('minute'));
  });

  it('dunning: period end without payment method → past_due', async () => {
    const { rows } = await pool.query(
      `INSERT INTO billing_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, payment_method_id)
       VALUES ($1,$2,'active',now() - interval '40 days', now() - interval '1 day', NULL) RETURNING id`,
      [TENANT_B, PLAN_TEST],
    );
    await repo.runDunning();
    const { rows: after } = await pool.query('SELECT status FROM billing_subscriptions WHERE id = $1', [rows[0].id]);
    assert.equal(after[0].status, 'past_due');
  });
});
