-- BlinkOne IVR flows (Prompt 5 step 3)
CREATE TABLE IF NOT EXISTS ivr_flows (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  active_version_id UUID,
  is_default        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ivr_flows_tenant ON ivr_flows (tenant_id);

CREATE TABLE IF NOT EXISTS ivr_flow_versions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id    UUID NOT NULL REFERENCES ivr_flows (id) ON DELETE CASCADE,
  version    INTEGER NOT NULL,
  graph      JSONB NOT NULL,
  comment    TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flow_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ivr_flow_versions_flow ON ivr_flow_versions (flow_id);

ALTER TABLE ivr_flows
  DROP CONSTRAINT IF EXISTS ivr_flows_active_version_fk;

ALTER TABLE ivr_flows
  ADD CONSTRAINT ivr_flows_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES ivr_flow_versions (id) ON DELETE SET NULL;
