-- Tenant-scoped custom field definitions (values live in ticket_fields per ticket)
CREATE TABLE IF NOT EXISTS ticket_field_definitions (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  field_key   TEXT NOT NULL,
  label       TEXT NOT NULL,
  field_type  TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'select', 'date')),
  options     JSONB,
  required    BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_ticket_field_defs_tenant ON ticket_field_definitions (tenant_id);
