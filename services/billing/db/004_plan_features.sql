-- Plan-level feature entitlements (BlinkOne enterprise gating)
ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}';

UPDATE billing_plans SET features = '{
  "sla": false, "escalation": false, "sso": false, "audit": true,
  "agent_assist": {"enabled": true, "config": {"tier": "limited"}},
  "voice_bot": false, "rag": false, "telephony": false,
  "calling.pstn": false, "calling.whatsapp": false,
  "telephony.supervisor": false, "telephony.reports": false
}'::jsonb WHERE id = 'starter' AND (features = '{}'::jsonb OR features IS NULL);

UPDATE billing_plans SET features = '{
  "sla": true, "escalation": true, "sso": false, "audit": true,
  "agent_assist": true, "voice_bot": true, "rag": true, "telephony": true,
  "calling.pstn": true, "calling.whatsapp": false,
  "telephony.supervisor": true, "telephony.reports": true
}'::jsonb WHERE id = 'business' AND (features = '{}'::jsonb OR features IS NULL);

UPDATE billing_plans SET features = '{
  "sla": true, "escalation": true, "sso": true, "audit": true,
  "agent_assist": true, "voice_bot": true, "rag": true, "telephony": true,
  "calling.pstn": true, "calling.whatsapp": true,
  "telephony.supervisor": true, "telephony.reports": true, "white_label": true
}'::jsonb WHERE id = 'enterprise' AND (features = '{}'::jsonb OR features IS NULL);
