-- BlinkOne demo tenant (id = Chatwoot account 1)
INSERT INTO tenants (id, name, slug, status, owner_email, chatwoot_account_id, billing_plan_id)
VALUES ('1', 'BlinkOne Demo', 'blinkone-demo', 'active', 'demo.agent@blinkone.ai', 1, 'business')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'active',
  billing_plan_id = EXCLUDED.billing_plan_id,
  updated_at = now();

INSERT INTO tenant_features (tenant_id, feature_key, enabled, config) VALUES
  ('1', 'sla', true, '{}'),
  ('1', 'escalation', true, '{}'),
  ('1', 'sso', false, '{}'),
  ('1', 'audit', true, '{}'),
  ('1', 'agent_assist', true, '{}'),
  ('1', 'voice_bot', true, '{}'),
  ('1', 'rag', true, '{}'),
  ('1', 'telephony', true, '{}'),
  ('1', 'calling.pstn', true, '{}'),
  ('1', 'calling.whatsapp', false, '{}'),
  ('1', 'telephony.supervisor', true, '{}'),
  ('1', 'telephony.reports', true, '{}')
ON CONFLICT (tenant_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;
