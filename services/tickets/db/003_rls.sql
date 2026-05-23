ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tickets;
CREATE POLICY tenant_isolation ON tickets
  USING (COALESCE(tenant_id, chatwoot_account_id::text) = current_setting('app.tenant_id', true))
  WITH CHECK (COALESCE(tenant_id, chatwoot_account_id::text) = current_setting('app.tenant_id', true));

ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ticket_events;
CREATE POLICY tenant_isolation ON ticket_events
  USING (
    ticket_id IN (
      SELECT id FROM tickets
      WHERE COALESCE(tenant_id, chatwoot_account_id::text) = current_setting('app.tenant_id', true)
    )
  );

ALTER TABLE ticket_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_fields FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ticket_fields;
CREATE POLICY tenant_isolation ON ticket_fields
  USING (
    ticket_id IN (
      SELECT id FROM tickets
      WHERE COALESCE(tenant_id, chatwoot_account_id::text) = current_setting('app.tenant_id', true)
    )
  );
