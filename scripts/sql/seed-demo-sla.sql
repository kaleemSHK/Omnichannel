-- SLA + escalation demo for tenant 1 (Oman business hours)

INSERT INTO business_hours_calendars (tenant_id, name, timezone, holidays, weekday_hours)
VALUES (
  '1',
  'Default business hours',
  'Asia/Muscat',
  '[]'::jsonb,
  '{"sunday":[],"monday":[{"start":"08:00","end":"17:00"}],"tuesday":[{"start":"08:00","end":"17:00"}],"wednesday":[{"start":"08:00","end":"17:00"}],"thursday":[{"start":"08:00","end":"17:00"}],"friday":[{"start":"08:00","end":"12:00"}],"saturday":[]}'::jsonb
)
ON CONFLICT (tenant_id, name) DO UPDATE SET weekday_hours = EXCLUDED.weekday_hours;

INSERT INTO sla_policies (tenant_id, name, enabled, is_default, business_hours_calendar_id)
SELECT '1', 'Gold', true, true, c.id
FROM business_hours_calendars c WHERE c.tenant_id = '1' AND c.name = 'Default business hours'
ON CONFLICT (tenant_id, name) DO UPDATE SET is_default = true;

INSERT INTO sla_policies (tenant_id, name, enabled, is_default, business_hours_calendar_id)
SELECT '1', 'Silver', true, false, c.id
FROM business_hours_calendars c WHERE c.tenant_id = '1' AND c.name = 'Default business hours'
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO sla_policies (tenant_id, name, enabled, is_default, business_hours_calendar_id)
SELECT '1', 'Bronze', true, false, c.id
FROM business_hours_calendars c WHERE c.tenant_id = '1' AND c.name = 'Default business hours'
ON CONFLICT (tenant_id, name) DO NOTHING;

DELETE FROM sla_targets WHERE policy_id IN (
  SELECT id FROM sla_policies WHERE tenant_id = '1' AND name = 'Gold'
);
INSERT INTO sla_targets (policy_id, applies_when, target_type, threshold_minutes)
SELECT p.id, '{"priority":["urgent","high"]}'::jsonb, 'first_response', 15
FROM sla_policies p WHERE p.tenant_id = '1' AND p.name = 'Gold';
INSERT INTO sla_targets (policy_id, applies_when, target_type, threshold_minutes)
SELECT p.id, '{}'::jsonb, 'resolution', 240
FROM sla_policies p WHERE p.tenant_id = '1' AND p.name = 'Gold';

DELETE FROM sla_targets WHERE policy_id IN (
  SELECT id FROM sla_policies WHERE tenant_id = '1' AND name = 'Silver'
);
INSERT INTO sla_targets (policy_id, applies_when, target_type, threshold_minutes)
SELECT p.id, '{"priority":["medium"]}'::jsonb, 'first_response', 60
FROM sla_policies p WHERE p.tenant_id = '1' AND p.name = 'Silver';
INSERT INTO sla_targets (policy_id, applies_when, target_type, threshold_minutes)
SELECT p.id, '{}'::jsonb, 'resolution', 480
FROM sla_policies p WHERE p.tenant_id = '1' AND p.name = 'Silver';

DELETE FROM sla_targets WHERE policy_id IN (
  SELECT id FROM sla_policies WHERE tenant_id = '1' AND name = 'Bronze'
);
INSERT INTO sla_targets (policy_id, applies_when, target_type, threshold_minutes)
SELECT p.id, '{"priority":["low"]}'::jsonb, 'first_response', 120
FROM sla_policies p WHERE p.tenant_id = '1' AND p.name = 'Bronze';
INSERT INTO sla_targets (policy_id, applies_when, target_type, threshold_minutes)
SELECT p.id, '{}'::jsonb, 'resolution', 1440
FROM sla_policies p WHERE p.tenant_id = '1' AND p.name = 'Bronze';

INSERT INTO escalation_rulesets (tenant_id, name, enabled)
VALUES ('1', 'Default escalations', true)
ON CONFLICT (tenant_id, name) DO UPDATE SET enabled = true;

DELETE FROM escalation_rules WHERE ruleset_id IN (
  SELECT id FROM escalation_rulesets WHERE tenant_id = '1' AND name = 'Default escalations'
);
INSERT INTO escalation_rules (ruleset_id, name, trigger, conditions, actions)
SELECT r.id, 'SLA warning → bump priority', 'sla.warning', 'true'::jsonb, '[{"type":"change_priority","priority":"high"}]'::jsonb
FROM escalation_rulesets r WHERE r.tenant_id = '1' AND r.name = 'Default escalations';
INSERT INTO escalation_rules (ruleset_id, name, trigger, conditions, actions)
SELECT r.id, 'SLA breach → label', 'sla.breached', 'true'::jsonb, '[{"type":"add_label","label":"sla-breached"}]'::jsonb
FROM escalation_rulesets r WHERE r.tenant_id = '1' AND r.name = 'Default escalations';
INSERT INTO escalation_rules (ruleset_id, name, trigger, conditions, actions)
SELECT r.id, 'Long queue wait', 'call.long_wait', '{">":[{"var":"event.wait_minutes"},10]}'::jsonb, '[{"type":"bump_queue_priority","delta":1}]'::jsonb
FROM escalation_rulesets r WHERE r.tenant_id = '1' AND r.name = 'Default escalations';
INSERT INTO escalation_rules (ruleset_id, name, trigger, conditions, actions)
SELECT r.id, 'Abandoned call', 'call.abandoned_in_queue', 'true'::jsonb, '[{"type":"add_label","label":"abandoned-call"}]'::jsonb
FROM escalation_rulesets r WHERE r.tenant_id = '1' AND r.name = 'Default escalations';
INSERT INTO escalation_rules (ruleset_id, name, trigger, conditions, actions)
SELECT r.id, 'Priority urgent', 'conversation.priority_changed_to', '{"==":[{"var":"event.priority"},"urgent"]}'::jsonb, '[{"type":"add_label","label":"urgent"}]'::jsonb
FROM escalation_rulesets r WHERE r.tenant_id = '1' AND r.name = 'Default escalations';
