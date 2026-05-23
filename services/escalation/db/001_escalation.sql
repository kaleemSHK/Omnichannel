-- BlinkOne Escalation (Prompt 6)
CREATE TABLE IF NOT EXISTS escalation_rulesets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS escalation_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id  UUID NOT NULL REFERENCES escalation_rulesets (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  trigger     TEXT NOT NULL,
  conditions  JSONB NOT NULL DEFAULT 'true',
  actions     JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalation_rules_ruleset ON escalation_rules (ruleset_id);

CREATE TABLE IF NOT EXISTS escalation_rule_runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id            UUID NOT NULL REFERENCES escalation_rules (id) ON DELETE CASCADE,
  triggered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  input_event        JSONB NOT NULL DEFAULT '{}',
  conditions_passed  BOOLEAN NOT NULL DEFAULT false,
  actions_attempted  JSONB NOT NULL DEFAULT '[]',
  outcomes           JSONB NOT NULL DEFAULT '[]',
  error              TEXT
);

CREATE INDEX IF NOT EXISTS idx_escalation_rule_runs_rule ON escalation_rule_runs (rule_id, triggered_at DESC);
