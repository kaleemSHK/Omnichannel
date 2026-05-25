-- Default BlinkOne escalation rulesets (tenant: default). Idempotent by ruleset name.
INSERT INTO escalation_rulesets (tenant_id, name, enabled)
VALUES
  ('default', 'Gold SLA breach → supervisor', true),
  ('default', 'Negative sentiment escalation', true),
  ('default', 'Abandoned queue', false),
  ('default', 'VIP contact — immediate assign', true),
  ('default', 'Long wait in PSTN queue', true),
  ('default', 'Silver SLA warning → team lead', true),
  ('default', 'WhatsApp unassigned 15 min', true),
  ('default', 'No agent reply 8 min', true),
  ('default', 'Billing tag → finance desk', true),
  ('default', 'Bronze SLA breach → manager queue', true)
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO escalation_rules (ruleset_id, name, enabled, trigger, conditions, actions)
SELECT s.id, 'Gold SLA breach → supervisor', true, 'sla.breached',
  '{"and":[{"==":[{"var":"conversation.sla_tier"},"gold"]},{"==":[{"var":"conversation.sla_status"},"breached"]}]}'::jsonb,
  '[{"type":"reassign_to_team","params":{"team_id":"supervisors"}},{"type":"notify_slack","params":{"channel":"#sla-alerts"}}]'::jsonb
FROM escalation_rulesets s
WHERE s.tenant_id = 'default' AND s.name = 'Gold SLA breach → supervisor'
  AND NOT EXISTS (SELECT 1 FROM escalation_rules r WHERE r.ruleset_id = s.id AND r.name = 'Gold SLA breach → supervisor');

INSERT INTO escalation_rules (ruleset_id, name, enabled, trigger, conditions, actions)
SELECT s.id, 'Negative sentiment escalation', true, 'conversation.priority_changed_to',
  '{"or":[{"==":[{"var":"conversation.ai_sentiment"},"negative"]},{">=":[{"var":"conversation.missed_count"},3]}]}'::jsonb,
  '[{"type":"add_label","params":{"label":"needs-review"}},{"type":"post_internal_note","params":{"body":"Auto-escalated: negative sentiment"}}]'::jsonb
FROM escalation_rulesets s
WHERE s.tenant_id = 'default' AND s.name = 'Negative sentiment escalation'
  AND NOT EXISTS (SELECT 1 FROM escalation_rules r WHERE r.ruleset_id = s.id AND r.name = 'Negative sentiment escalation');

INSERT INTO escalation_rules (ruleset_id, name, enabled, trigger, conditions, actions)
SELECT s.id, 'Abandoned queue (inactive)', false, 'call.abandoned_in_queue',
  '{"and":[{"==":[{"var":"conversation.call_status"},"missed"]}]}'::jsonb,
  '[{"type":"send_webhook","params":{"url":"https://hooks.example.com/abandon"}}]'::jsonb
FROM escalation_rulesets s
WHERE s.tenant_id = 'default' AND s.name = 'Abandoned queue'
  AND NOT EXISTS (SELECT 1 FROM escalation_rules r WHERE r.ruleset_id = s.id AND r.name = 'Abandoned queue (inactive)');

INSERT INTO escalation_rules (ruleset_id, name, enabled, trigger, conditions, actions)
SELECT s.id, 'VIP contact — immediate assign', true, 'conversation.priority_changed_to',
  '{"and":[{"in":["vip",{"var":"conversation.contact_tag"}]},{"==":[{"var":"conversation.inbox_type"},"whatsapp"]}]}'::jsonb,
  '[{"type":"reassign_to_team","params":{"team_id":"vip-desk"}},{"type":"add_label","params":{"label":"vip-escalation"}}]'::jsonb
FROM escalation_rulesets s
WHERE s.tenant_id = 'default' AND s.name = 'VIP contact — immediate assign'
  AND NOT EXISTS (SELECT 1 FROM escalation_rules r WHERE r.ruleset_id = s.id AND r.name = 'VIP contact — immediate assign');

INSERT INTO escalation_rules (ruleset_id, name, enabled, trigger, conditions, actions)
SELECT s.id, 'Long wait in PSTN queue', true, 'call.long_wait',
  '{"and":[{"==":[{"var":"conversation.call_status"},"active"]},{">=":[{"var":"conversation.missed_count"},2]}]}'::jsonb,
  '[{"type":"notify_slack","params":{"channel":"#ops-floor"}},{"type":"bump_queue_priority","params":{}}]'::jsonb
FROM escalation_rulesets s
WHERE s.tenant_id = 'default' AND s.name = 'Long wait in PSTN queue'
  AND NOT EXISTS (SELECT 1 FROM escalation_rules r WHERE r.ruleset_id = s.id AND r.name = 'Long wait in PSTN queue');

INSERT INTO escalation_rules (ruleset_id, name, enabled, trigger, conditions, actions)
SELECT s.id, 'Silver SLA warning → team lead', true, 'sla.warning',
  '{"and":[{"==":[{"var":"conversation.sla_tier"},"silver"]},{"==":[{"var":"conversation.sla_status"},"warning"]}]}'::jsonb,
  '[{"type":"post_internal_note","params":{"body":"SLA warning: silver tier approaching breach"}},{"type":"notify_slack","params":{"channel":"#sla-alerts"}}]'::jsonb
FROM escalation_rulesets s
WHERE s.tenant_id = 'default' AND s.name = 'Silver SLA warning → team lead'
  AND NOT EXISTS (SELECT 1 FROM escalation_rules r WHERE r.ruleset_id = s.id AND r.name = 'Silver SLA warning → team lead');

INSERT INTO escalation_rules (ruleset_id, name, enabled, trigger, conditions, actions)
SELECT s.id, 'WhatsApp unassigned 15 min', true, 'conversation.unassigned_for_minutes',
  '{"and":[{"==":[{"var":"conversation.inbox_type"},"whatsapp"]},{"==":[{"var":"conversation.assigned_agent"},""]}]}'::jsonb,
  '[{"type":"reassign_to_team","params":{"team_id":"whatsapp-queue"}},{"type":"add_label","params":{"label":"unassigned-escalation"}}]'::jsonb
FROM escalation_rulesets s
WHERE s.tenant_id = 'default' AND s.name = 'WhatsApp unassigned 15 min'
  AND NOT EXISTS (SELECT 1 FROM escalation_rules r WHERE r.ruleset_id = s.id AND r.name = 'WhatsApp unassigned 15 min');

INSERT INTO escalation_rules (ruleset_id, name, enabled, trigger, conditions, actions)
SELECT s.id, 'No agent reply 8 min', true, 'conversation.no_response_for_minutes',
  '{"and":[{"!=":[{"var":"conversation.sla_status"},"breached"]},{">=":[{"var":"conversation.missed_count"},1]}]}'::jsonb,
  '[{"type":"change_priority","params":{"priority":"urgent"}},{"type":"add_label","params":{"label":"awaiting-reply"}}]'::jsonb
FROM escalation_rulesets s
WHERE s.tenant_id = 'default' AND s.name = 'No agent reply 8 min'
  AND NOT EXISTS (SELECT 1 FROM escalation_rules r WHERE r.ruleset_id = s.id AND r.name = 'No agent reply 8 min');

INSERT INTO escalation_rules (ruleset_id, name, enabled, trigger, conditions, actions)
SELECT s.id, 'Billing tag → finance desk', true, 'conversation.priority_changed_to',
  '{"and":[{"in":["billing",{"var":"conversation.contact_tag"}]},{"==":[{"var":"conversation.inbox_type"},"email"]}]}'::jsonb,
  '[{"type":"reassign_to_team","params":{"team_id":"finance-desk"}},{"type":"post_internal_note","params":{"body":"Routed to finance: billing-tagged contact"}}]'::jsonb
FROM escalation_rulesets s
WHERE s.tenant_id = 'default' AND s.name = 'Billing tag → finance desk'
  AND NOT EXISTS (SELECT 1 FROM escalation_rules r WHERE r.ruleset_id = s.id AND r.name = 'Billing tag → finance desk');

INSERT INTO escalation_rules (ruleset_id, name, enabled, trigger, conditions, actions)
SELECT s.id, 'Bronze SLA breach → manager queue', true, 'sla.breached',
  '{"and":[{"==":[{"var":"conversation.sla_tier"},"bronze"]},{"==":[{"var":"conversation.sla_status"},"breached"]}]}'::jsonb,
  '[{"type":"reassign_to_team","params":{"team_id":"managers"}},{"type":"change_priority","params":{"priority":"high"}}]'::jsonb
FROM escalation_rulesets s
WHERE s.tenant_id = 'default' AND s.name = 'Bronze SLA breach → manager queue'
  AND NOT EXISTS (SELECT 1 FROM escalation_rules r WHERE r.ruleset_id = s.id AND r.name = 'Bronze SLA breach → manager queue');
