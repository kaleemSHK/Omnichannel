-- Prompt 8 RLS — REVIEW REQUIRED

ALTER TABLE ivr_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE ivr_flows FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ivr_flows;
CREATE POLICY tenant_isolation ON ivr_flows
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE ivr_flow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ivr_flow_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ivr_flow_versions;
CREATE POLICY tenant_isolation ON ivr_flow_versions
  USING (
    flow_id IN (
      SELECT id FROM ivr_flows WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );
