import type { EscalationRuleView } from '@/lib/utils/escalation';

export const DEMO_ESCALATION_RULES: EscalationRuleView[] = [
  {
    id: 'rule-1',
    rulesetId: 'rs-1',
    name: 'Gold SLA breach → supervisor',
    isActive: true,
    rulesetEnabled: true,
    trigger: 'sla.breached',
    conditionLogic: 'and',
    conditions: [
      { field: 'sla_tier', operator: '=', value: 'gold' },
      { field: 'sla_status', operator: '=', value: 'breached' },
    ],
    actions: [
      { type: 'reassign_to_team', params: { team_id: 'supervisors' } },
      { type: 'notify_slack', params: { channel: '#sla-alerts' } },
    ],
  },
  {
    id: 'rule-2',
    rulesetId: 'rs-2',
    name: 'Negative sentiment escalation',
    isActive: true,
    rulesetEnabled: true,
    trigger: 'conversation.priority_changed_to',
    conditionLogic: 'or',
    conditions: [
      { field: 'ai_sentiment', operator: '=', value: 'negative' },
      { field: 'missed_count', operator: '≥', value: 3 },
    ],
    actions: [
      { type: 'add_label', params: { label: 'needs-review' } },
      { type: 'post_internal_note', params: { body: 'Auto-escalated: negative sentiment' } },
    ],
  },
  {
    id: 'rule-3',
    rulesetId: 'rs-3',
    name: 'Abandoned queue (inactive)',
    isActive: false,
    rulesetEnabled: true,
    trigger: 'call.abandoned_in_queue',
    conditionLogic: 'and',
    conditions: [{ field: 'call_status', operator: '=', value: 'missed' }],
    actions: [{ type: 'send_webhook', params: { url: 'https://hooks.example.com/abandon' } }],
  },
  {
    id: 'rule-4',
    rulesetId: 'rs-4',
    name: 'VIP contact — immediate assign',
    isActive: true,
    rulesetEnabled: true,
    trigger: 'conversation.priority_changed_to',
    conditionLogic: 'and',
    conditions: [
      { field: 'contact_tag', operator: '∈', value: 'vip' },
      { field: 'inbox_type', operator: '=', value: 'whatsapp' },
    ],
    actions: [
      { type: 'reassign_to_team', params: { team_id: 'vip-desk' } },
      { type: 'add_label', params: { label: 'vip-escalation' } },
    ],
  },
  {
    id: 'rule-5',
    rulesetId: 'rs-5',
    name: 'Long wait in PSTN queue',
    isActive: true,
    rulesetEnabled: true,
    trigger: 'call.long_wait',
    conditionLogic: 'and',
    conditions: [
      { field: 'call_status', operator: '=', value: 'active' },
      { field: 'missed_count', operator: '≥', value: 2 },
    ],
    actions: [
      { type: 'notify_slack', params: { channel: '#ops-floor' } },
      { type: 'bump_queue_priority', params: {} },
    ],
  },
  {
    id: 'rule-6',
    rulesetId: 'rs-6',
    name: 'Silver SLA warning → team lead',
    isActive: true,
    rulesetEnabled: true,
    trigger: 'sla.warning',
    conditionLogic: 'and',
    conditions: [
      { field: 'sla_tier', operator: '=', value: 'silver' },
      { field: 'sla_status', operator: '=', value: 'warning' },
    ],
    actions: [
      { type: 'post_internal_note', params: { body: 'SLA warning: silver tier approaching breach' } },
      { type: 'notify_slack', params: { channel: '#sla-alerts' } },
    ],
  },
  {
    id: 'rule-7',
    rulesetId: 'rs-7',
    name: 'WhatsApp unassigned 15 min',
    isActive: true,
    rulesetEnabled: true,
    trigger: 'conversation.unassigned_for_minutes',
    conditionLogic: 'and',
    conditions: [
      { field: 'inbox_type', operator: '=', value: 'whatsapp' },
      { field: 'assigned_agent', operator: '=', value: '' },
    ],
    actions: [
      { type: 'reassign_to_team', params: { team_id: 'whatsapp-queue' } },
      { type: 'add_label', params: { label: 'unassigned-escalation' } },
    ],
  },
  {
    id: 'rule-8',
    rulesetId: 'rs-8',
    name: 'No agent reply 8 min',
    isActive: true,
    rulesetEnabled: true,
    trigger: 'conversation.no_response_for_minutes',
    conditionLogic: 'and',
    conditions: [
      { field: 'sla_status', operator: '≠', value: 'breached' },
      { field: 'missed_count', operator: '≥', value: 1 },
    ],
    actions: [
      { type: 'change_priority', params: { priority: 'urgent' } },
      { type: 'add_label', params: { label: 'awaiting-reply' } },
    ],
  },
  {
    id: 'rule-9',
    rulesetId: 'rs-9',
    name: 'Billing tag → finance desk',
    isActive: true,
    rulesetEnabled: true,
    trigger: 'conversation.priority_changed_to',
    conditionLogic: 'and',
    conditions: [
      { field: 'contact_tag', operator: '∈', value: 'billing' },
      { field: 'inbox_type', operator: '=', value: 'email' },
    ],
    actions: [
      { type: 'reassign_to_team', params: { team_id: 'finance-desk' } },
      { type: 'post_internal_note', params: { body: 'Routed to finance: billing-tagged contact' } },
    ],
  },
  {
    id: 'rule-10',
    rulesetId: 'rs-10',
    name: 'Bronze SLA breach → manager queue',
    isActive: true,
    rulesetEnabled: true,
    trigger: 'sla.breached',
    conditionLogic: 'and',
    conditions: [
      { field: 'sla_tier', operator: '=', value: 'bronze' },
      { field: 'sla_status', operator: '=', value: 'breached' },
    ],
    actions: [
      { type: 'reassign_to_team', params: { team_id: 'managers' } },
      { type: 'change_priority', params: { priority: 'high' } },
    ],
  },
];

export const DEMO_ESCALATION_RULE_COUNT = DEMO_ESCALATION_RULES.length;
