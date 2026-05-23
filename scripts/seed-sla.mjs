#!/usr/bin/env node
/** pnpm seed:sla — demo Gold/Silver/Bronze policies + sample escalation rules */
import pg from 'pg';

const url = process.env.BLINKONE_DATABASE_URL;
const tenantId = process.env.SEED_TENANT || 'default';
if (!url) {
  console.error('BLINKONE_DATABASE_URL required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

const calendar = {
  timezone: 'Asia/Muscat',
  holidays: [],
  weekdayHours: {
    sunday: [],
    monday: [{ start: '08:00', end: '17:00' }],
    tuesday: [{ start: '08:00', end: '17:00' }],
    wednesday: [{ start: '08:00', end: '17:00' }],
    thursday: [{ start: '08:00', end: '17:00' }],
    friday: [{ start: '08:00', end: '12:00' }],
    saturday: [],
  },
};

const policies = [
  {
    name: 'Gold',
    isDefault: true,
    targets: [
      { targetType: 'first_response', thresholdMinutes: 15, appliesWhen: { priority: ['urgent', 'high'] } },
      { targetType: 'resolution', thresholdMinutes: 240, appliesWhen: {} },
    ],
  },
  {
    name: 'Silver',
    targets: [
      { targetType: 'first_response', thresholdMinutes: 60, appliesWhen: { priority: ['medium'] } },
      { targetType: 'resolution', thresholdMinutes: 480, appliesWhen: {} },
    ],
  },
  {
    name: 'Bronze',
    targets: [
      { targetType: 'first_response', thresholdMinutes: 120, appliesWhen: { priority: ['low'] } },
      { targetType: 'resolution', thresholdMinutes: 1440, appliesWhen: {} },
    ],
  },
];

async function main() {
  const { rows: calRows } = await pool.query(
    `INSERT INTO business_hours_calendars (tenant_id, name, timezone, holidays, weekday_hours)
     VALUES ($1,'Default business hours',$2,$3::jsonb,$4::jsonb)
     ON CONFLICT (tenant_id, name) DO UPDATE SET weekday_hours = EXCLUDED.weekday_hours
     RETURNING id`,
    [tenantId, calendar.timezone, JSON.stringify(calendar.holidays), JSON.stringify(calendar.weekdayHours)],
  );
  const calId = calRows[0].id;

  for (const p of policies) {
    const { rows } = await pool.query(
      `INSERT INTO sla_policies (tenant_id, name, enabled, is_default, business_hours_calendar_id)
       VALUES ($1,$2,true,$3,$4)
       ON CONFLICT (tenant_id, name) DO UPDATE SET is_default = EXCLUDED.is_default
       RETURNING id`,
      [tenantId, p.name, !!p.isDefault, calId],
    );
    const policyId = rows[0].id;
    await pool.query('DELETE FROM sla_targets WHERE policy_id = $1', [policyId]);
    for (const t of p.targets) {
      await pool.query(
        `INSERT INTO sla_targets (policy_id, applies_when, target_type, threshold_minutes)
         VALUES ($1,$2::jsonb,$3,$4)`,
        [policyId, JSON.stringify(t.appliesWhen), t.targetType, t.thresholdMinutes],
      );
    }
    console.log('policy', p.name);
  }

  const { rows: rs } = await pool.query(
    `INSERT INTO escalation_rulesets (tenant_id, name, enabled)
     VALUES ($1,'Default escalations',true)
     ON CONFLICT (tenant_id, name) DO UPDATE SET enabled = true
     RETURNING id`,
    [tenantId],
  );
  const rulesetId = rs[0].id;
  const rules = [
    { name: 'SLA warning → bump priority', trigger: 'sla.warning', conditions: true, actions: [{ type: 'change_priority', priority: 'high' }] },
    { name: 'SLA breach → label', trigger: 'sla.breached', conditions: true, actions: [{ type: 'add_label', label: 'sla-breached' }] },
    { name: 'Long queue wait', trigger: 'call.long_wait', conditions: { '>': [{ var: 'event.wait_minutes' }, 10] }, actions: [{ type: 'bump_queue_priority', delta: 1 }] },
    { name: 'Abandoned call', trigger: 'call.abandoned_in_queue', conditions: true, actions: [{ type: 'add_label', label: 'abandoned-call' }] },
    { name: 'Priority urgent', trigger: 'conversation.priority_changed_to', conditions: { '==': [{ var: 'event.priority' }, 'urgent'] }, actions: [{ type: 'add_label', label: 'urgent' }] },
  ];
  await pool.query('DELETE FROM escalation_rules WHERE ruleset_id = $1', [rulesetId]);
  for (const r of rules) {
    await pool.query(
      `INSERT INTO escalation_rules (ruleset_id, name, trigger, conditions, actions)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)`,
      [rulesetId, r.name, r.trigger, JSON.stringify(r.conditions), JSON.stringify(r.actions)],
    );
    console.log('rule', r.name);
  }

  await pool.end();
  console.log('seed complete for tenant', tenantId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
