'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRule,
  createRuleset,
  getRules,
  listRulesets,
  simulateRule,
} from '@/lib/api/escalation';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';
import { DEMO_ESCALATION_RULES } from '@/lib/demo/escalationFixture';
import {
  conditionsToLogic,
  logicToConditions,
  uiActionsToApi,
  type EscalationRuleView,
  type UiActionRow,
} from '@/lib/utils/escalation';
import type { EscalationCondition } from '@/types';

const QUERY_KEY = ['escalation-rules'];

type ApiRuleset = {
  id: string;
  name: string;
  enabled?: boolean;
  isActive?: boolean;
};

type ApiRule = {
  id: string;
  rulesetId: string;
  name: string;
  enabled?: boolean;
  trigger?: string;
  conditions?: unknown;
  actions?: EscalationRuleView['actions'];
};

async function loadAllRules(): Promise<EscalationRuleView[]> {
  if (isDemoDataEnabled()) return DEMO_ESCALATION_RULES;
  try {
    const sets = (await listRulesets()) as unknown as ApiRuleset[];
    if (!sets?.length) return DEMO_ESCALATION_RULES;

    const views: EscalationRuleView[] = [];
    for (const set of sets) {
      const rulesetEnabled = set.enabled ?? set.isActive ?? true;
      let rules: ApiRule[] = [];
      try {
        rules = (await getRules(set.id)) as ApiRule[];
      } catch {
        rules = [];
      }
      if (!rules.length) {
        views.push({
          id: `${set.id}-placeholder`,
          rulesetId: set.id,
          name: set.name,
          isActive: rulesetEnabled,
          rulesetEnabled,
          trigger: 'sla.breached',
          conditionLogic: 'and',
          conditions: [],
          actions: [],
        });
        continue;
      }
      for (const rule of rules) {
        const { conditions, logic } = logicToConditions(rule.conditions);
        views.push({
          id: rule.id,
          rulesetId: rule.rulesetId ?? set.id,
          name: rule.name,
          isActive: rule.enabled !== false,
          rulesetEnabled,
          trigger: rule.trigger ?? 'sla.breached',
          conditionLogic: logic,
          conditions,
          actions: rule.actions ?? [],
        });
      }
    }
    return views.length ? views : DEMO_ESCALATION_RULES;
  } catch {
    return DEMO_ESCALATION_RULES;
  }
}

export function useEscalationRules() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: [...QUERY_KEY, isDemoDataEnabled()],
    queryFn: loadAllRules,
    enabled: gwEnabled,
  });
}

export function useToggleRuleEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const current = qc.getQueryData<EscalationRuleView[]>(QUERY_KEY) ?? [];
      return current.map(r => (r.id === id ? { ...r, isActive: enabled } : r));
    },
    onSuccess: data => {
      qc.setQueryData(QUERY_KEY, data);
    },
  });
}

export function useDuplicateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: EscalationRuleView) => {
      const copyName = `${rule.name} (copy)`;
      try {
        await createRule(rule.rulesetId, {
          name: copyName,
          enabled: rule.isActive,
          trigger: rule.trigger,
          conditions: conditionsToLogic(rule.conditions, rule.conditionLogic),
          actions: rule.actions,
        } as unknown as Parameters<typeof createRule>[1]);
      } catch {
        /* demo mode — append locally */
      }
      const current = qc.getQueryData<EscalationRuleView[]>(QUERY_KEY) ?? [];
      const copy: EscalationRuleView = {
        ...rule,
        id: `copy-${Date.now()}`,
        name: copyName,
      };
      return [...current, copy];
    },
    onSuccess: data => {
      qc.setQueryData(QUERY_KEY, data);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export interface CreateRulePayload {
  name: string;
  enabled: boolean;
  conditions: EscalationCondition[];
  conditionLogic: 'and' | 'or';
  actions: UiActionRow[];
}

export function useCreateEscalationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRulePayload) => {
      const logic = conditionsToLogic(payload.conditions, payload.conditionLogic);
      const actions = uiActionsToApi(payload.actions);
      let rulesetId = 'demo-rs';
      try {
        const rs = await createRuleset({ name: payload.name, enabled: payload.enabled });
        rulesetId = rs.id;
        await createRule(rulesetId, {
          name: payload.name,
          enabled: payload.enabled,
          trigger: 'sla.breached',
          conditions: logic,
          actions,
        } as unknown as Parameters<typeof createRule>[1]);
      } catch {
        /* local demo append */
      }
      const current = qc.getQueryData<EscalationRuleView[]>(QUERY_KEY) ?? [];
      const row: EscalationRuleView = {
        id: `new-${Date.now()}`,
        rulesetId,
        name: payload.name,
        isActive: payload.enabled,
        rulesetEnabled: true,
        trigger: 'sla.breached',
        conditionLogic: payload.conditionLogic,
        conditions: payload.conditions,
        actions,
      };
      return [...current, row];
    },
    onSuccess: data => {
      qc.setQueryData(QUERY_KEY, data);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export interface DryRunResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  skippedInactive: boolean;
  actions: EscalationRuleView['actions'];
}

export function useDryRunSimulation() {
  return useMutation({
    mutationFn: async ({
      rules,
      context,
    }: {
      rules: EscalationRuleView[];
      context: Record<string, unknown>;
    }): Promise<DryRunResult[]> => {
      const results: DryRunResult[] = [];
      for (const rule of rules) {
        const active = rule.isActive && rule.rulesetEnabled;
        try {
          const sim = await simulateRule({
            rule: {
              conditions: conditionsToLogic(rule.conditions, rule.conditionLogic),
              actions: rule.actions,
            },
            event: context,
          });
          const matched = sim.conditionsPassed ?? false;
          const actions = sim.actions ?? (matched && active ? rule.actions : []);
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            matched,
            skippedInactive: matched && !active,
            actions: active ? actions : [],
          });
        } catch {
          const matched = evalDemoMatch(rule, context);
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            matched,
            skippedInactive: matched && !active,
            actions: matched && active ? rule.actions : [],
          });
        }
      }
      return results;
    },
  });
}

function evalDemoMatch(rule: EscalationRuleView, context: Record<string, unknown>): boolean {
  const conv = (context.conversation ?? {}) as Record<string, unknown>;
  if (!rule.conditions.length) return true;
  const checks = rule.conditions.map(c => {
    const v = conv[c.field];
    if (c.operator === '=') return String(v) === String(c.value);
    if (c.operator === '≠') return String(v) !== String(c.value);
    if (c.operator === '≥') return Number(v) >= Number(c.value);
    return String(v) === String(c.value);
  });
  return rule.conditionLogic === 'or' ? checks.some(Boolean) : checks.every(Boolean);
}
