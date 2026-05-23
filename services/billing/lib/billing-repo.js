import { randomUUID } from 'node:crypto';
import { getPool, tenantQuery } from './db.js';
import { computeVat } from './vat.js';
import { featuresForPlanId } from '../_shared/lib/plan-features.js';
import { applyPlanEntitlements } from './tenant-entitlements.js';

const CURRENCY = (process.env.CURRENCY || 'OMR').toUpperCase();
const LABBIK_CR = process.env.LABBIK_CR_NUMBER || 'CR-XXXX';
const LABBIK_VAT = process.env.LABBIK_VAT_NUMBER || 'VAT-XXXX';

function periodEndFrom(start, period = 'monthly') {
  const d = new Date(start);
  if (period === 'annual') d.setFullYear(d.getFullYear() + 1);
  else if (period === 'quarterly') d.setMonth(d.getMonth() + 3);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export async function listPlans() {
  const { rows } = await getPool().query('SELECT * FROM billing_plans ORDER BY base_price_omr');
  const plans = [];
  for (const p of rows) {
    const { rows: rates } = await getPool().query(
      'SELECT dimension, rate_omr_per_unit FROM billing_plan_overage_rates WHERE plan_id = $1',
      [p.id],
    );
    plans.push({ ...mapPlan(p), overageRates: rates });
  }
  return plans;
}

function mapPlan(p) {
  return {
    id: p.id,
    name: p.name,
    tier: p.tier,
    basePriceOmr: Number(p.base_price_omr),
    includedAgents: p.included_agents,
    includedMinutes: p.included_minutes,
    includedMessages: p.included_messages,
    includedAiCredits: p.included_ai_credits,
    billingPeriod: p.billing_period,
    features: featuresForPlanId(p.id, p.features),
  };
}

export async function updatePlan(planId, body) {
  const p = getPool();
  const { rows } = await p.query('SELECT id FROM billing_plans WHERE id = $1', [planId]);
  if (!rows.length) {
    const err = new Error('Plan not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const fields = [];
  const vals = [];
  let i = 1;
  const map = {
    name: 'name',
    tier: 'tier',
    basePriceOmr: 'base_price_omr',
    includedAgents: 'included_agents',
    includedMinutes: 'included_minutes',
    includedMessages: 'included_messages',
    includedAiCredits: 'included_ai_credits',
    billingPeriod: 'billing_period',
  };
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) {
      fields.push(`${col} = $${i++}`);
      vals.push(body[k]);
    }
  }
  if (body.features !== undefined) {
    fields.push(`features = $${i++}::jsonb`);
    vals.push(JSON.stringify(body.features));
  }
  if (fields.length) {
    vals.push(planId);
    await p.query(`UPDATE billing_plans SET ${fields.join(', ')} WHERE id = $${i}`, vals);
  }
  if (body.overageRates) {
    for (const [dim, rate] of Object.entries(body.overageRates)) {
      await p.query(
        `INSERT INTO billing_plan_overage_rates (plan_id, dimension, rate_omr_per_unit) VALUES ($1,$2,$3)
         ON CONFLICT (plan_id, dimension) DO UPDATE SET rate_omr_per_unit = $3`,
        [planId, dim, rate],
      );
    }
  }
  return listPlans().then((ps) => ps.find((x) => x.id === planId));
}

export async function createPlan(body) {
  const { id, name, tier, basePriceOmr, includedAgents, includedMinutes, includedMessages, includedAiCredits, billingPeriod, overageRates, features } = body;
  const feat = features ?? featuresForPlanId(id, null);
  await getPool().query(
    `INSERT INTO billing_plans (id, name, tier, base_price_omr, included_agents, included_minutes, included_messages, included_ai_credits, billing_period, features)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [id, name, tier, basePriceOmr, includedAgents ?? 0, includedMinutes ?? 0, includedMessages ?? 0, includedAiCredits ?? 0, billingPeriod || 'monthly', JSON.stringify(feat)],
  );
  if (overageRates) {
    for (const [dim, rate] of Object.entries(overageRates)) {
      await getPool().query(
        `INSERT INTO billing_plan_overage_rates (plan_id, dimension, rate_omr_per_unit) VALUES ($1,$2,$3)
         ON CONFLICT (plan_id, dimension) DO UPDATE SET rate_omr_per_unit = $3`,
        [id, dim, rate],
      );
    }
  }
  return listPlans().then((ps) => ps.find((x) => x.id === id));
}

export async function ingestUsageEvent({ tenantId, dimension, quantity, sourceService, sourceEventId, occurredAt }) {
  try {
    const { rows } = await getPool().query(
      `INSERT INTO billing_usage_events (tenant_id, dimension, quantity, source_service, source_event_id, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, dimension, quantity, sourceService, sourceEventId, occurredAt || new Date().toISOString()],
    );
    return { inserted: true, event: rows[0] };
  } catch (e) {
    if (e.code === '23505') return { inserted: false, duplicate: true };
    throw e;
  }
}

export async function rollupDaily(dateStr) {
  const p = getPool();
  await p.query(
    `INSERT INTO billing_usage_aggregates_daily (tenant_id, date, dimension, total_quantity, total_cost_omr)
     SELECT ue.tenant_id, $1::date, ue.dimension, SUM(ue.quantity), 0
     FROM billing_usage_events ue
     WHERE ue.occurred_at::date = $1::date
     GROUP BY ue.tenant_id, ue.dimension
     ON CONFLICT (tenant_id, date, dimension) DO UPDATE SET total_quantity = EXCLUDED.total_quantity`,
    [dateStr],
  );
}

export async function assignSubscription(tenantId, body = {}) {
  const planId = typeof body === 'string' ? body : (body.planId ?? body.plan_id);
  const trialDays = body.trialDays ?? body.trial_days ?? 14;
  if (!planId) {
    const err = new Error('planId required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const p = getPool();
  const { rows: planRows } = await p.query('SELECT * FROM billing_plans WHERE id = $1', [planId]);
  if (!planRows.length) {
    const err = new Error('Plan not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const plan = planRows[0];
  await p.query(
    `UPDATE billing_subscriptions SET status = 'cancelled', updated_at = now()
     WHERE tenant_id = $1 AND status IN ('trial', 'active', 'past_due')`,
    [tenantId],
  );
  const start = new Date().toISOString();
  const end = periodEndFrom(start, plan.billing_period);
  const trialEnd = trialDays ? new Date(Date.now() + trialDays * 86400000).toISOString() : null;
  const { rows } = await p.query(
    `INSERT INTO billing_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, trial_ends_at, currency)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [tenantId, planId, trialEnd ? 'trial' : 'active', start, end, trialEnd, CURRENCY],
  );
  try {
    await applyPlanEntitlements(tenantId, planId, plan);
  } catch (e) {
    console.warn?.({ tenantId, planId, err: e.message }, 'applyPlanEntitlements failed');
  }
  return mapSub(rows[0], plan);
}

export async function cancelSubscription(tenantId, { immediate = false } = {}) {
  const p = getPool();
  if (immediate) {
    await p.query(
      `UPDATE billing_subscriptions SET status = 'cancelled', updated_at = now() WHERE tenant_id = $1 AND status NOT IN ('cancelled')`,
      [tenantId],
    );
    try {
      await applyPlanEntitlements(tenantId, 'starter', { id: 'starter', features: featuresForPlanId('starter', null) });
    } catch (e) {
      console.warn?.({ tenantId, err: e.message }, 'cancel entitlements revert failed');
    }
  } else {
    await p.query(
      `UPDATE billing_subscriptions SET cancel_at_period_end = true, updated_at = now()
       WHERE tenant_id = $1 AND status IN ('trial', 'active', 'past_due')`,
      [tenantId],
    );
  }
  return getActiveSubscription(tenantId);
}

export async function getActiveSubscription(tenantId) {
  const { rows } = await getPool().query(
    `SELECT s.*, p.name AS plan_name, p.base_price_omr, p.included_agents, p.included_minutes,
            p.included_messages, p.included_ai_credits, p.billing_period
     FROM billing_subscriptions s
     JOIN billing_plans p ON p.id = s.plan_id
     WHERE s.tenant_id = $1 AND s.status IN ('trial', 'active', 'past_due', 'suspended')
     ORDER BY s.created_at DESC LIMIT 1`,
    [tenantId],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return mapSub(r, {
    name: r.plan_name,
    included_agents: r.included_agents,
    included_minutes: r.included_minutes,
    included_messages: r.included_messages,
    included_ai_credits: r.included_ai_credits,
    billing_period: r.billing_period,
  });
}

function mapSub(s, plan) {
  return {
    id: s.id,
    tenantId: s.tenant_id,
    planId: s.plan_id,
    planName: plan.name,
    status: s.status,
    currentPeriodStart: s.current_period_start,
    currentPeriodEnd: s.current_period_end,
    trialEndsAt: s.trial_ends_at,
    cancelAtPeriodEnd: s.cancel_at_period_end,
    currency: s.currency || CURRENCY,
    vatRate: Number(s.vat_rate ?? 0.05),
    included: {
      agents: plan.included_agents,
      minutes: plan.included_minutes,
      messages: plan.included_messages,
      aiCredits: plan.included_ai_credits,
    },
  };
}

/** Returns whether tenant exceeded plan allowances (gateway enforcement). */
export async function getUsageLimits(tenantId) {
  const usage = await getTenantUsage(tenantId);
  if (!usage.subscription) {
    return { tenantId, blocked: false, reason: null, comparison: {} };
  }
  const over = Object.entries(usage.comparison || {}).filter(([, c]) => c.overage > 0);
  const blocked = over.length > 0;
  return {
    tenantId,
    blocked,
    reason: blocked ? `Usage limit exceeded: ${over.map(([d]) => d).join(', ')}` : null,
    comparison: usage.comparison,
    subscription: usage.subscription,
  };
}

export async function recordUsageToBilling(tenantId, dimension, quantity, sourceService, sourceEventId) {
  return ingestUsageEvent({
    tenantId,
    dimension,
    quantity,
    sourceService,
    sourceEventId,
  });
}

export async function getTenantUsage(tenantId) {
  const sub = await getActiveSubscription(tenantId);
  if (!sub) return { tenantId, subscription: null, usage: {} };
  const { rows } = await tenantQuery(
    getPool(),
    tenantId,
    `SELECT dimension, SUM(quantity)::float AS total FROM billing_usage_events
     WHERE tenant_id = $1 AND occurred_at >= $2 AND occurred_at < $3 GROUP BY dimension`,
    [tenantId, sub.currentPeriodStart, sub.currentPeriodEnd],
  );
  const usage = Object.fromEntries(rows.map((r) => [r.dimension, Number(r.total)]));
  const allowances = sub.included;
  const comparison = {};
  for (const dim of ['minute', 'message', 'ai_token', 'agent']) {
    const used = usage[dim] ?? usage[`usage.${dim}`] ?? 0;
    const allowed = allowances[dim === 'minute' ? 'minutes' : dim === 'message' ? 'messages' : dim === 'ai_token' ? 'aiCredits' : 'agents'] ?? 0;
    comparison[dim] = { used, allowed, overage: Math.max(0, used - allowed) };
  }
  return { tenantId, subscription: sub, usage, comparison, currency: CURRENCY };
}

export async function generateInvoice(tenantId, { periodStart, periodEnd, idempotencyKey }) {
  const key = idempotencyKey || `inv-${tenantId}-${periodStart}-${periodEnd}`;
  const existing = await getPool().query('SELECT * FROM billing_invoices WHERE idempotency_key = $1', [key]);
  if (existing.rows.length) return mapInvoice(existing.rows[0]);

  const sub = await getActiveSubscription(tenantId);
  if (!sub) {
    const err = new Error('No active subscription');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const { rows: planRow } = await getPool().query('SELECT * FROM billing_plans WHERE id = $1', [sub.planId]);
  const plan = planRow[0];
  const { rows: rates } = await getPool().query(
    'SELECT dimension, rate_omr_per_unit FROM billing_plan_overage_rates WHERE plan_id = $1',
    [sub.planId],
  );
  const rateMap = Object.fromEntries(rates.map((r) => [r.dimension, Number(r.rate_omr_per_unit)]));

  const usage = await getTenantUsage(tenantId);
  const lines = [
    { description: `${plan.name} subscription`, descriptionAr: `اشتراك ${plan.name}`, quantity: 1, unitPriceOmr: Number(plan.base_price_omr), amountOmr: Number(plan.base_price_omr) },
  ];

  let subtotal = Number(plan.base_price_omr);
  for (const [dim, comp] of Object.entries(usage.comparison)) {
    if (comp.overage > 0 && rateMap[dim]) {
      const amt = Math.round(comp.overage * rateMap[dim] * 1000) / 1000;
      lines.push({
        description: `Overage: ${dim} (${comp.overage} units)`,
        descriptionAr: `تجاوز: ${dim}`,
        quantity: comp.overage,
        unitPriceOmr: rateMap[dim],
        amountOmr: amt,
      });
      subtotal += amt;
    }
  }

  const { vatOmr, totalOmr } = computeVat(subtotal, sub.vatRate);
  const invId = randomUUID();
  await getPool().query(
    `INSERT INTO billing_invoices (id, tenant_id, period_start, period_end, subtotal_omr, vat_omr, total_omr, status, due_at, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',now() + interval '14 days',$8)`,
    [invId, tenantId, periodStart || sub.currentPeriodStart, periodEnd || sub.currentPeriodEnd, subtotal, vatOmr, totalOmr, key],
  );
  for (const line of lines) {
    await getPool().query(
      `INSERT INTO billing_invoice_lines (invoice_id, description, description_ar, quantity, unit_price_omr, amount_omr)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [invId, line.description, line.descriptionAr, line.quantity, line.unitPriceOmr, line.amountOmr],
    );
  }
  const pdfKey = await renderInvoicePdf(invId, tenantId, lines, { subtotal, vatOmr, totalOmr, vatRate: sub.vatRate });
  await getPool().query('UPDATE billing_invoices SET pdf_minio_key = $2 WHERE id = $1', [invId, pdfKey]);
  const { rows } = await getPool().query('SELECT * FROM billing_invoices WHERE id = $1', [invId]);
  return mapInvoice(rows[0], lines);
}

function mapInvoice(row, lines = []) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    subtotalOmr: Number(row.subtotal_omr),
    vatOmr: Number(row.vat_omr),
    totalOmr: Number(row.total_omr),
    status: row.status,
    pdfMinioKey: row.pdf_minio_key,
    lines,
  };
}

async function renderInvoicePdf(invoiceId, tenantId, lines, totals) {
  const html = buildInvoiceHtml(invoiceId, tenantId, lines, totals);
  const key = `tenants/${tenantId}/invoices/${invoiceId}.html`;
  if (process.env.MINIO_STUB !== '0') return key;
  return key;
}

function buildInvoiceHtml(invoiceId, tenantId, lines, { subtotal, vatOmr, totalOmr, vatRate }) {
  const lineRows = lines
    .map(
      (l) =>
        `<tr><td>${l.description}<br/><span dir="rtl">${l.descriptionAr || ''}</span></td><td>${l.quantity}</td><td>${l.unitPriceOmr}</td><td>${l.amountOmr} OMR</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{font-family:Inter,Arial,sans-serif;font-size:13px;color:#37352f}table{width:100%;border-collapse:collapse}td,th{border:0.5px solid #d3d1cb;padding:8px}</style></head><body>
<h1>فاتورة / Invoice</h1>
<p>LABBIK Telecom — CR ${LABBIK_CR} — VAT ${LABBIK_VAT}</p>
<p>Tenant: ${tenantId} · Invoice ${invoiceId}</p>
<table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead><tbody>${lineRows}</tbody></table>
<p>Subtotal: ${subtotal} OMR · VAT (${(vatRate * 100).toFixed(0)}%): ${vatOmr} OMR · <strong>Total: ${totalOmr} OMR</strong></p>
</body></html>`;
}

export async function listInvoices(tenantId) {
  const { rows } = await tenantQuery(
    getPool(),
    tenantId,
    'SELECT * FROM billing_invoices ORDER BY period_start DESC LIMIT 100',
    [],
  );
  return rows.map((r) => mapInvoice(r));
}

export async function markInvoicePaid(invoiceId, { method = 'manual', amountOmr, providerRef }) {
  const { rows } = await getPool().query('SELECT * FROM billing_invoices WHERE id = $1', [invoiceId]);
  if (!rows.length) return null;
  const inv = rows[0];
  await getPool().query(
    `UPDATE billing_invoices SET status = 'paid', paid_at = now() WHERE id = $1`,
    [invoiceId],
  );
  await getPool().query(
    `INSERT INTO billing_payments (invoice_id, method, provider_ref, amount_omr, status)
     VALUES ($1,$2,$3,$4,'succeeded')`,
    [invoiceId, method, providerRef || null, amountOmr ?? inv.total_omr],
  );
  return mapInvoice({ ...inv, status: 'paid' });
}

export async function platformOverview() {
  const p = getPool();
  const { rows: mrr } = await p.query(
    `SELECT SUM(p.base_price_omr)::float AS mrr FROM billing_subscriptions s
     JOIN billing_plans p ON p.id = s.plan_id WHERE s.status IN ('active', 'trial')`,
  );
  const { rows: overdue } = await p.query(
    `SELECT COUNT(*)::int AS c FROM billing_invoices WHERE status = 'overdue'`,
  );
  const { rows: dist } = await p.query(
    `SELECT p.tier, COUNT(*)::int AS c FROM billing_subscriptions s JOIN billing_plans p ON p.id = s.plan_id
     WHERE s.status IN ('active','trial') GROUP BY p.tier`,
  );
  return {
    mrrOmr: mrr[0]?.mrr ?? 0,
    arrOmr: (mrr[0]?.mrr ?? 0) * 12,
    overdueCount: overdue[0]?.c ?? 0,
    planDistribution: dist,
    currency: CURRENCY,
  };
}

export async function runDunning(log = console) {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT * FROM billing_subscriptions WHERE status = 'active' AND current_period_end < now() + interval '3 days'
     AND current_period_end > now()`,
  );
  for (const s of rows) {
    log.info?.({ tenantId: s.tenant_id }, 'billing.dunning.reminder');
  }
  const { rows: due } = await p.query(
    `SELECT * FROM billing_subscriptions WHERE status = 'active' AND current_period_end < now() AND payment_method_id IS NULL`,
  );
  for (const s of due) {
    await p.query(`UPDATE billing_subscriptions SET status = 'past_due', updated_at = now() WHERE id = $1`, [s.id]);
    log.warn?.({ tenantId: s.tenant_id }, 'tenant.past_due');
  }
  const { rows: terminal } = await p.query(
    `SELECT * FROM billing_subscriptions WHERE status = 'past_due' AND current_period_end < now() - interval '7 days'`,
  );
  for (const s of terminal) {
    log.error?.({ tenantId: s.tenant_id }, 'subscription.payment_failed_terminal');
  }
}
