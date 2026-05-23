-- BlinkOne Integration (Prompt 10) — webhooks, SSO, connectors, API keys

CREATE TABLE IF NOT EXISTS integration_webhook_endpoints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL,
  name              TEXT NOT NULL,
  url               TEXT NOT NULL,
  secret_hash       TEXT,
  secret_enc        TEXT,
  events_subscribed TEXT[] NOT NULL DEFAULT ARRAY['*'],
  enabled           BOOLEAN NOT NULL DEFAULT true,
  extra_headers     JSONB NOT NULL DEFAULT '{}',
  retry_policy      TEXT NOT NULL DEFAULT 'default',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant ON integration_webhook_endpoints (tenant_id, enabled);

CREATE TABLE IF NOT EXISTS integration_webhook_deliveries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id             UUID NOT NULL REFERENCES integration_webhook_endpoints (id) ON DELETE CASCADE,
  tenant_id               TEXT NOT NULL,
  event_id                TEXT NOT NULL,
  event_type              TEXT NOT NULL,
  attempt                 INTEGER NOT NULL DEFAULT 1,
  status                  TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'dead')),
  request_body            JSONB,
  response_status         INTEGER,
  response_body_truncated TEXT,
  attempted_at            TIMESTAMPTZ,
  next_retry_at           TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON integration_webhook_deliveries (status, next_retry_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON integration_webhook_deliveries (endpoint_id, created_at DESC);

CREATE TABLE IF NOT EXISTS integration_sso_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL UNIQUE,
  slug            TEXT NOT NULL,
  realm_name      TEXT NOT NULL,
  provider_type   TEXT NOT NULL CHECK (provider_type IN ('oidc', 'saml', 'ldap')),
  client_id       TEXT,
  discovery_url   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  enabled         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_connectors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  connector_type  TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  config          JSONB NOT NULL DEFAULT '{}',
  secrets_enc     TEXT,
  status          TEXT NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('disabled', 'configured', 'connected', 'error')),
  last_health_at  TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_type)
);

CREATE TABLE IF NOT EXISTS integration_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  key_prefix      TEXT NOT NULL,
  key_hash        TEXT NOT NULL,
  scopes          TEXT[] NOT NULL DEFAULT ARRAY['read'],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON integration_api_keys (tenant_id) WHERE revoked_at IS NULL;
