-- Prompt 8 RLS — REVIEW REQUIRED

ALTER TABLE routing_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_queues FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON routing_queues;
CREATE POLICY tenant_isolation ON routing_queues
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE routing_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_agents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON routing_agents;
CREATE POLICY tenant_isolation ON routing_agents
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE routing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_decisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON routing_decisions;
CREATE POLICY tenant_isolation ON routing_decisions
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE routing_queue_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_queue_skills FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON routing_queue_skills;
CREATE POLICY tenant_isolation ON routing_queue_skills
  USING (
    queue_id IN (
      SELECT id FROM routing_queues WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );

ALTER TABLE routing_agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_agent_skills FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON routing_agent_skills;
CREATE POLICY tenant_isolation ON routing_agent_skills
  USING (
    agent_id IN (
      SELECT id FROM routing_agents WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );

ALTER TABLE routing_agent_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_agent_queues FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON routing_agent_queues;
CREATE POLICY tenant_isolation ON routing_agent_queues
  USING (
    agent_id IN (
      SELECT id FROM routing_agents WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );
