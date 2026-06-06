UPDATE routing_agents SET display_name = 'Demo Agent', chatwoot_user_id = '3' WHERE tenant_id = '1' AND agent_id = '3';
UPDATE call_sessions SET agent_label = 'Demo Agent' WHERE tenant_id = '1' AND assigned_agent_id = '3';
SELECT agent_id, display_name, chatwoot_user_id FROM routing_agents WHERE tenant_id = '1' ORDER BY agent_id;
