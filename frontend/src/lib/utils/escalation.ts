import type { EscalationAction, EscalationCondition } from '@/types';

export const ESCALATION_FIELDS = [
  'sla_tier',
  'sla_status',
  'call_status',
  'missed_count',
  'ai_sentiment',
  'assigned_agent',
  'inbox_type',
  'contact_tag',
] as const;

export const ESCALATION_OPERATORS = ['=', '≠', '>', '≥', '<', '≤', '∈'] as const;

export type EscalationField = (typeof ESCALATION_FIELDS)[number];
export type EscalationOperator = (typeof ESCALATION_OPERATORS)[number];

export interface EscalationRuleView {
  id: string;
  rulesetId: string;
  name: string;
  isActive: boolean;
  rulesetEnabled: boolean;
  conditions: EscalationCondition[];
  conditionLogic: 'and' | 'or';
  actions: EscalationAction[];
  trigger: string;
  runCount?: number;
  lastTriggeredAt?: string | null;
}

export interface EscalationRuleRun {
  id: string;
  ruleId: string;
  ruleName?: string;
  triggeredAt: string;
  inputEvent: Record<string, unknown>;
  conditionsPassed: boolean;
  actionsAttempted: EscalationAction[];
  outcomes: unknown[];
  error?: string | null;
}

const OP_TO_LOGIC: Record<string, string> = {
  '=': '==',
  '≠': '!=',
  '>': '>',
  '≥': '>=',
  '<': '<',
  '≤': '<=',
  '∈': 'in',
};

const LOGIC_TO_OP: Record<string, string> = {
  '==': '=',
  '===': '=',
  '!=': '≠',
  '>': '>',
  '>=': '≥',
  '<': '<',
  '<=': '≤',
  in: '∈',
};

function fieldToVar(field: string): string {
  if (field.includes('.')) return field;
  return `conversation.${field}`;
}

export function conditionsToLogic(
  conditions: EscalationCondition[],
  logic: 'and' | 'or',
): Record<string, unknown> | boolean {
  if (!conditions.length) return true;
  const parts = conditions.map(c => ({
    [OP_TO_LOGIC[c.operator] ?? '==']: [{ var: fieldToVar(c.field) }, c.value],
  }));
  if (parts.length === 1) return parts[0]!;
  return { [logic]: parts };
}

export function logicToConditions(
  node: unknown,
): { conditions: EscalationCondition[]; logic: 'and' | 'or' } {
  if (node === true || node === false || node == null) {
    return { conditions: [], logic: 'and' };
  }
  if (typeof node !== 'object' || Array.isArray(node)) {
    return { conditions: [], logic: 'and' };
  }
  const key = Object.keys(node as object)[0];
  const val = (node as Record<string, unknown>)[key!];
  if (key === 'and' || key === 'or') {
    const list = Array.isArray(val) ? val : [];
    const conditions = list
      .map(clause => clauseToCondition(clause))
      .filter((c): c is EscalationCondition => c != null);
    return { conditions, logic: key };
  }
  const single = clauseToCondition(node);
  return { conditions: single ? [single] : [], logic: 'and' };
}

function clauseToCondition(clause: unknown): EscalationCondition | null {
  if (!clause || typeof clause !== 'object' || Array.isArray(clause)) return null;
  const op = Object.keys(clause as object)[0];
  const args = (clause as Record<string, unknown>)[op!];
  if (!Array.isArray(args) || args.length < 2) return null;
  const left = args[0] as { var?: string };
  const field = String(left?.var ?? '').replace(/^conversation\./, '');
  const operator = (LOGIC_TO_OP[op] ?? '=') as EscalationOperator;
  return { field, operator, value: args[1] as string | number };
}

export const ESCALATION_TRIGGERS = [
  { value: 'sla.warning', label: 'SLA warning' },
  { value: 'sla.breached', label: 'SLA breached' },
  { value: 'conversation.unassigned_for_minutes', label: 'Conversation unassigned (timer)' },
  { value: 'conversation.no_response_for_minutes', label: 'No agent response (timer)' },
  { value: 'conversation.priority_changed_to', label: 'Priority changed' },
  { value: 'call.abandoned_in_queue', label: 'Call abandoned in queue' },
  { value: 'call.long_wait', label: 'Long queue wait' },
] as const;

export const DEFAULT_RULESET_NAME = 'Default escalations';

/** Normalize API actions (flat seed format or `{ type, params }`). */
export function normalizeApiActions(actions: unknown): EscalationAction[] {
  if (!Array.isArray(actions)) return [];
  return actions.map(raw => {
    const action = raw as Record<string, unknown>;
    const type = String(action.type ?? '');
    if (action.params && typeof action.params === 'object') {
      return { type, params: action.params as Record<string, unknown> };
    }
    const params: Record<string, unknown> = {};
    switch (type) {
      case 'reassign_to_team':
        params.team_id = action.team_id ?? action.target;
        break;
      case 'reassign_to_agent':
        params.agent_id = action.agent_id ?? action.target;
        break;
      case 'add_label':
        params.label = action.label ?? action.name;
        break;
      case 'change_priority':
        params.priority = action.priority;
        break;
      case 'post_internal_note':
        params.body = action.body ?? action.content ?? action.template ?? action.message;
        break;
      case 'notify_slack':
        params.channel = action.channel ?? action.webhook_url;
        break;
      case 'send_webhook':
        params.url = action.url;
        break;
      case 'bump_queue_priority':
        params.delta = action.delta ?? 1;
        break;
      default:
        for (const [k, v] of Object.entries(action)) {
          if (k !== 'type') params[k] = v;
        }
    }
    return { type, params };
  });
}

export function describeAction(action: EscalationAction): { label: string; icon: string } {
  const p = action.params ?? {};
  switch (action.type) {
    case 'reassign_to_agent':
      return { label: `Reassign to agent ${p.agent_id ?? p.target ?? ''}`.trim(), icon: 'reassign' };
    case 'reassign_to_team':
      return { label: `Reassign to ${p.team_id ?? p.target ?? 'team'}`.trim(), icon: 'reassign' };
    case 'notify_slack':
      return { label: `Notify via Slack ${p.channel ?? ''}`.trim(), icon: 'notify' };
    case 'add_label':
      return { label: `Add label: ${p.label ?? p.name ?? ''}`.trim(), icon: 'label' };
    case 'post_internal_note':
      return { label: `Send internal note: ${String(p.body ?? p.message ?? '').slice(0, 40)}`, icon: 'message' };
    case 'send_webhook':
      return { label: `POST to ${p.url ?? 'webhook'}`, icon: 'webhook' };
    case 'change_priority':
      return { label: `Change priority to ${p.priority ?? ''}`.trim(), icon: 'label' };
    case 'bump_queue_priority':
      return { label: 'Bump queue priority', icon: 'notify' };
    default:
      return { label: action.type.replace(/_/g, ' '), icon: 'webhook' };
  }
}

export type UiActionType = 'reassign' | 'notify' | 'label' | 'message' | 'webhook';

export interface UiActionRow {
  type: UiActionType;
  target: string;
}

export function uiActionsToApi(actions: UiActionRow[]): EscalationAction[] {
  return actions
    .filter(a => a.target.trim())
    .map(a => {
      switch (a.type) {
        case 'reassign': {
          const t = a.target.trim();
          if (/^agent:/i.test(t)) {
            return { type: 'reassign_to_agent', params: { agent_id: t.replace(/^agent:/i, '').trim() } };
          }
          if (/^team:/i.test(t)) {
            return { type: 'reassign_to_team', params: { team_id: t.replace(/^team:/i, '').trim() } };
          }
          return t.toLowerCase().includes('agent')
            ? { type: 'reassign_to_agent', params: { agent_id: t } }
            : { type: 'reassign_to_team', params: { team_id: t } };
        }
        case 'notify':
          return { type: 'notify_slack', params: { channel: a.target } };
        case 'label':
          if (/^priority:/i.test(a.target)) {
            return { type: 'change_priority', params: { priority: a.target.replace(/^priority:/i, '').trim() } };
          }
          return { type: 'add_label', params: { label: a.target } };
        case 'message':
          return { type: 'post_internal_note', params: { body: a.target } };
        case 'webhook':
          return { type: 'send_webhook', params: { url: a.target } };
        default:
          return { type: 'send_webhook', params: { url: a.target } };
      }
    });
}

/** Map stored API actions back to the rule form rows. */
export function apiActionsToUi(actions: EscalationAction[]): UiActionRow[] {
  if (!actions.length) return [{ type: 'label', target: '' }];
  return actions.map(a => {
    const p = a.params ?? {};
    switch (a.type) {
      case 'reassign_to_team':
        return { type: 'reassign', target: `team:${p.team_id ?? ''}` };
      case 'reassign_to_agent':
        return { type: 'reassign', target: `agent:${p.agent_id ?? ''}` };
      case 'notify_slack':
        return { type: 'notify', target: String(p.channel ?? p.webhook_url ?? '') };
      case 'add_label':
        return { type: 'label', target: String(p.label ?? p.name ?? '') };
      case 'post_internal_note':
        return { type: 'message', target: String(p.body ?? p.message ?? p.content ?? '') };
      case 'send_webhook':
        return { type: 'webhook', target: String(p.url ?? '') };
      case 'change_priority':
        return { type: 'label', target: `priority:${p.priority ?? 'urgent'}` };
      case 'bump_queue_priority':
        return { type: 'notify', target: 'queue-priority' };
      default:
        return { type: 'webhook', target: a.type };
    }
  });
}

export function dryRunContext(values: {
  conversationId: string;
  slaTier: string;
  slaStatus: string;
  callStatus: string;
  aiSentiment: string;
  assignedAgent: string;
  priority: string;
}): Record<string, unknown> {
  return {
    event_type: 'dry_run',
    conversation: {
      id: values.conversationId,
      sla_tier: values.slaTier,
      sla_status: values.slaStatus,
      call_status: values.callStatus,
      ai_sentiment: values.aiSentiment,
      assigned_agent: values.assignedAgent,
    },
    event: {
      priority: values.priority,
    },
    agent: { id: values.assignedAgent },
  };
}
