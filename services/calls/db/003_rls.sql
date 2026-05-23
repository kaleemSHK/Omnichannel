-- Prompt 8 RLS — REVIEW REQUIRED

ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON call_sessions;
CREATE POLICY tenant_isolation ON call_sessions
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE recording_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_objects FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON recording_objects;
CREATE POLICY tenant_isolation ON recording_objects
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
