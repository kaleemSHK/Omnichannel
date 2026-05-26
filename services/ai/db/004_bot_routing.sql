-- BlinkOne AI service — A01: Bot routing rules (Sprint 2)
-- Stores per-tenant bot routing rulesets as a single JSONB document.
-- One active ruleset per tenant; rules[] evaluated in priority order.

CREATE TABLE IF NOT EXISTS bot_routing_configs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL DEFAULT 'Default',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  rules       JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_routing_tenant
  ON bot_routing_configs (tenant_id);
