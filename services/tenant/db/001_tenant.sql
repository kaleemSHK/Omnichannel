-- BlinkOne tenant control plane (Prompt 8)
CREATE TABLE IF NOT EXISTS tenants (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  status                TEXT NOT NULL DEFAULT 'trial'
    CHECK (status IN ('active', 'trial', 'suspended', 'terminated')),
  owner_email           TEXT NOT NULL,
  primary_contact_phone TEXT,
  billing_plan_id       TEXT,
  chatwoot_account_id   BIGINT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_features (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  feature_key  TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  config       JSONB NOT NULL DEFAULT '{}',
  UNIQUE (tenant_id, feature_key)
);

CREATE TABLE IF NOT EXISTS tenant_branding (
  tenant_id  TEXT PRIMARY KEY REFERENCES tenants (id) ON DELETE CASCADE,
  brand      JSONB NOT NULL DEFAULT '{}',
  subdomain  TEXT
);

CREATE TABLE IF NOT EXISTS tenant_domains (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  domain              TEXT NOT NULL UNIQUE,
  is_primary          BOOLEAN NOT NULL DEFAULT false,
  ssl_status          TEXT NOT NULL DEFAULT 'pending',
  verification_token  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON tenant_domains (tenant_id);

CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL,
  scopes       JSONB NOT NULL DEFAULT '[]',
  created_by   TEXT,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_admins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  chatwoot_user_id  BIGINT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'viewer')),
  UNIQUE (tenant_id, chatwoot_user_id)
);
