-- BlinkOne SLA (Prompt 6)
CREATE TABLE IF NOT EXISTS business_hours_calendars (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      TEXT NOT NULL,
  name           TEXT NOT NULL,
  timezone       TEXT NOT NULL DEFAULT 'UTC',
  holidays       JSONB NOT NULL DEFAULT '[]',
  weekday_hours  JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS sla_policies (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 TEXT NOT NULL,
  name                      TEXT NOT NULL,
  description               TEXT,
  enabled                   BOOLEAN NOT NULL DEFAULT true,
  is_default                BOOLEAN NOT NULL DEFAULT false,
  business_hours_calendar_id UUID REFERENCES business_hours_calendars (id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS sla_targets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id             UUID NOT NULL REFERENCES sla_policies (id) ON DELETE CASCADE,
  applies_when          JSONB NOT NULL DEFAULT '{}',
  target_type           TEXT NOT NULL CHECK (target_type IN ('first_response', 'next_response', 'resolution')),
  threshold_minutes     INTEGER NOT NULL CHECK (threshold_minutes > 0),
  warning_threshold_pct INTEGER NOT NULL DEFAULT 80 CHECK (warning_threshold_pct BETWEEN 1 AND 99),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sla_targets_policy ON sla_targets (policy_id);

CREATE TABLE IF NOT EXISTS sla_instances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  conversation_id     BIGINT NOT NULL,
  policy_id           UUID NOT NULL REFERENCES sla_policies (id) ON DELETE CASCADE,
  target_id           UUID NOT NULL REFERENCES sla_targets (id) ON DELETE CASCADE,
  started_at          TIMESTAMPTZ NOT NULL,
  due_at              TIMESTAMPTZ NOT NULL,
  paused_at_total_ms  BIGINT NOT NULL DEFAULT 0,
  paused_since        TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'met', 'breached', 'warning_sent')),
  met_at              TIMESTAMPTZ,
  breached_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sla_instances_tenant_conv ON sla_instances (tenant_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_sla_instances_active ON sla_instances (tenant_id, status) WHERE status IN ('active', 'paused', 'warning_sent');

CREATE TABLE IF NOT EXISTS sla_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES sla_instances (id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot    JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sla_events_instance ON sla_events (instance_id, at DESC);
