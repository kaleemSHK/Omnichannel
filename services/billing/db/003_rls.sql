-- Prompt 8/9 RLS — tenant isolation on billing tables with tenant_id
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'billing_subscriptions', 'billing_usage_events', 'billing_usage_aggregates_daily',
    'billing_invoices', 'billing_payment_methods'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t
    );
  END LOOP;
END $$;

ALTER TABLE billing_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoice_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON billing_invoice_lines;
CREATE POLICY tenant_isolation ON billing_invoice_lines
  USING (
    invoice_id IN (
      SELECT id FROM billing_invoices WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );

ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON billing_payments;
CREATE POLICY tenant_isolation ON billing_payments
  USING (
    invoice_id IN (
      SELECT id FROM billing_invoices WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );
