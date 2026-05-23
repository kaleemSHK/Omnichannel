-- Prompt 8 RLS — REVIEW REQUIRED

ALTER TABLE escalation_rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rulesets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON escalation_rulesets;
CREATE POLICY tenant_isolation ON escalation_rulesets
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON escalation_rules;
CREATE POLICY tenant_isolation ON escalation_rules
  USING (
    ruleset_id IN (
      SELECT id FROM escalation_rulesets WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );

ALTER TABLE escalation_rule_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rule_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON escalation_rule_runs;
CREATE POLICY tenant_isolation ON escalation_rule_runs
  USING (
    rule_id IN (
      SELECT r.id FROM escalation_rules r
      JOIN escalation_rulesets s ON s.id = r.ruleset_id
      WHERE s.tenant_id = current_setting('app.tenant_id', true)
    )
  );
