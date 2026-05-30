ALTER TABLE ticket_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_field_definitions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ticket_field_definitions;
CREATE POLICY tenant_isolation ON ticket_field_definitions
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
