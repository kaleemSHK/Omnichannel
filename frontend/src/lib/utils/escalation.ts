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
        case 'reassign':
          return a.target.toLowerCase().includes('agent')
            ? { type: 'reassign_to_agent', params: { agent_id: a.target } }
            : { type: 'reassign_to_team', params: { team_id: a.target } };
        case 'notify':
          return { type: 'notify_slack', params: { channel: a.target } };
        case 'label':
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

export function dryRunContext(values: {
  conversationId: string;
  slaTier: string;
  slaStatus: string;
  callStatus: string;
  aiSentiment: string;
  assignedAgent: string;
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
    agent: { id: values.assignedAgent },
  };
}
