-- Per-tenant Chatwoot automation user (escalation, SLA actions, etc.)
CREATE TABLE IF NOT EXISTS tenant_chatwoot_service (
  tenant_id          TEXT PRIMARY KEY REFERENCES tenants (id) ON DELETE CASCADE,
  chatwoot_user_id   BIGINT NOT NULL,
  service_email      TEXT NOT NULL,
  access_token       TEXT NOT NULL,
  token_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_chatwoot_service_user
  ON tenant_chatwoot_service (chatwoot_user_id);
