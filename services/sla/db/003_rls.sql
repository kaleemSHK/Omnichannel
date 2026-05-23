-- Prompt 8 RLS — REVIEW REQUIRED (see docs/blinkone/PROMPT8_RLS_REVIEW.md)

ALTER TABLE business_hours_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours_calendars FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON business_hours_calendars;
CREATE POLICY tenant_isolation ON business_hours_calendars
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON sla_policies;
CREATE POLICY tenant_isolation ON sla_policies
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE sla_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_targets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON sla_targets;
CREATE POLICY tenant_isolation ON sla_targets
  USING (
    policy_id IN (
      SELECT id FROM sla_policies WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );

ALTER TABLE sla_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_instances FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON sla_instances;
CREATE POLICY tenant_isolation ON sla_instances
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE sla_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON sla_events;
CREATE POLICY tenant_isolation ON sla_events
  USING (
    instance_id IN (
      SELECT id FROM sla_instances WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );
