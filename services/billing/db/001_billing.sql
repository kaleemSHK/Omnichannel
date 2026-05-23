-- BlinkOne Billing (Prompt 9) — OMR default, 5% VAT configurable per tenant
CREATE TABLE IF NOT EXISTS billing_plans (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  tier                  TEXT NOT NULL CHECK (tier IN ('starter', 'business', 'enterprise')),
  base_price_omr        NUMERIC(12, 3) NOT NULL DEFAULT 0,
  included_agents       INTEGER NOT NULL DEFAULT 0,
  included_minutes      INTEGER NOT NULL DEFAULT 0,
  included_messages     INTEGER NOT NULL DEFAULT 0,
  included_ai_credits   INTEGER NOT NULL DEFAULT 0,
  billing_period        TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'quarterly', 'annual')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_plan_overage_rates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           TEXT NOT NULL REFERENCES billing_plans (id) ON DELETE CASCADE,
  dimension         TEXT NOT NULL,
  rate_omr_per_unit NUMERIC(12, 6) NOT NULL DEFAULT 0,
  UNIQUE (plan_id, dimension)
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             TEXT NOT NULL,
  plan_id               TEXT NOT NULL REFERENCES billing_plans (id),
  status                TEXT NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  current_period_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end    TIMESTAMPTZ NOT NULL,
  trial_ends_at         TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
  payment_method_id     UUID,
  vat_rate              NUMERIC(5, 4) NOT NULL DEFAULT 0.05,
  currency              TEXT NOT NULL DEFAULT 'OMR',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_subs_tenant ON billing_subscriptions (tenant_id, status);

CREATE TABLE IF NOT EXISTS billing_usage_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  dimension       TEXT NOT NULL,
  quantity        NUMERIC(14, 4) NOT NULL DEFAULT 1,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_service  TEXT NOT NULL DEFAULT 'unknown',
  source_event_id TEXT NOT NULL,
  UNIQUE (tenant_id, source_event_id)
);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_time ON billing_usage_events (tenant_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS billing_usage_aggregates_daily (
  tenant_id       TEXT NOT NULL,
  date            DATE NOT NULL,
  dimension       TEXT NOT NULL,
  total_quantity  NUMERIC(14, 4) NOT NULL DEFAULT 0,
  total_cost_omr  NUMERIC(12, 3) NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, date, dimension)
);

CREATE TABLE IF NOT EXISTS billing_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  subtotal_omr    NUMERIC(12, 3) NOT NULL DEFAULT 0,
  vat_omr         NUMERIC(12, 3) NOT NULL DEFAULT 0,
  total_omr       NUMERIC(12, 3) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  pdf_minio_key   TEXT,
  issued_at       TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON billing_invoices (tenant_id, period_start DESC);

CREATE TABLE IF NOT EXISTS billing_invoice_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES billing_invoices (id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  description_ar  TEXT,
  quantity        NUMERIC(14, 4) NOT NULL DEFAULT 1,
  unit_price_omr  NUMERIC(12, 6) NOT NULL DEFAULT 0,
  amount_omr      NUMERIC(12, 3) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS billing_payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES billing_invoices (id) ON DELETE CASCADE,
  method       TEXT NOT NULL CHECK (method IN ('card', 'bank_transfer', 'manual')),
  provider_ref TEXT,
  amount_omr   NUMERIC(12, 3) NOT NULL,
  paid_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded'))
);

CREATE TABLE IF NOT EXISTS billing_payment_methods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'card',
  last4           TEXT,
  provider_token  TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default plans (OMR)
INSERT INTO billing_plans (id, name, tier, base_price_omr, included_agents, included_minutes, included_messages, included_ai_credits, billing_period)
VALUES
  ('starter', 'Starter', 'starter', 29.000, 5, 500, 2000, 50000, 'monthly'),
  ('business', 'Business', 'business', 99.000, 25, 3000, 10000, 250000, 'monthly'),
  ('enterprise', 'Enterprise', 'enterprise', 299.000, 100, 15000, 50000, 1000000, 'monthly')
ON CONFLICT (id) DO NOTHING;

INSERT INTO billing_plan_overage_rates (plan_id, dimension, rate_omr_per_unit)
VALUES
  ('starter', 'minute', 0.015),
  ('starter', 'message', 0.002),
  ('starter', 'ai_token', 0.00001),
  ('business', 'minute', 0.012),
  ('business', 'message', 0.0015),
  ('business', 'ai_token', 0.000008),
  ('enterprise', 'minute', 0.010),
  ('enterprise', 'message', 0.001),
  ('enterprise', 'ai_token', 0.000005)
ON CONFLICT (plan_id, dimension) DO NOTHING;
