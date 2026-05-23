import { randomUUID } from 'node:crypto';
import { getPool } from './db.js';
import { createChatwootAccount } from './chatwoot-platform.js';
import { assignBillingPlan } from './billing-client.js';
import { DEFAULT_FEATURES, seedTenantDefaults } from './seed-defaults.js';
import * as repo from './repo.js';

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export async function provisionTenant(body) {
  const {
    name,
    slug: slugIn,
    ownerEmail,
    primaryContactPhone,
    billingPlanId,
    plan = 'trial',
    features: featuresIn,
    brand = {},
    subdomain,
  } = body ?? {};

  if (!name?.trim() || !ownerEmail?.trim()) {
    const err = new Error('name and ownerEmail required');
    err.code = 'VALIDATION';
    throw err;
  }

  const slug = (slugIn || slugify(name)).toLowerCase();
  const existing = await repo.getTenantBySlug(slug);
  if (existing) {
    const err = new Error('Slug already exists');
    err.code = 'CONFLICT';
    throw err;
  }

  const account = await createChatwootAccount({ name: name.trim(), ownerEmail: ownerEmail.trim() });
  const tenantId = String(account.id);
  const features = { ...DEFAULT_FEATURES, ...featuresIn };

  const tenant = await repo.insertTenant({
    id: tenantId,
    name: name.trim(),
    slug,
    status: plan === 'trial' ? 'trial' : 'active',
    ownerEmail: ownerEmail.trim(),
    primaryContactPhone,
    billingPlanId,
    chatwootAccountId: account.id,
  });

  const planId = billingPlanId || (plan === 'trial' ? 'starter' : null);
  if (planId) {
    try {
      await assignBillingPlan(tenantId, planId);
    } catch (e) {
      await repo.upsertFeatures(tenantId, features);
    }
  } else {
    await repo.upsertFeatures(tenantId, features);
  }
  await repo.upsertBranding(tenantId, {
    product_name: name.trim(),
    primary_color: brand.primaryColor || '#0B5FFF',
    ...brand,
  }, subdomain || `${slug}.${process.env.BLINKONE_DOMAIN_SUFFIX || 'blinkone.local'}`);

  await getPool().query(
    `INSERT INTO tenant_admins (tenant_id, chatwoot_user_id, role) VALUES ($1,$2,'owner')
     ON CONFLICT (tenant_id, chatwoot_user_id) DO NOTHING`,
    [tenantId, 1],
  );

  const seedResults = await seedTenantDefaults(tenantId, { name: name.trim(), features });

  const frontendBase = (process.env.FRONTEND_URL || 'http://localhost').replace(/\/$/, '');
  const onboardingUrl = `${frontendBase}/app/accounts/${account.id}/settings`;

  return {
    tenant,
    chatwootAccountId: account.id,
    chatwootStub: account.stub === true,
    onboardingUrl,
    seedResults,
    inviteToken: randomUUID(),
  };
}
