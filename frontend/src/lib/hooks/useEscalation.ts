'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRule,
  createRuleset,
  deleteRule,
  getRules,
  getRunStats,
  listRuleRuns,
  listRulesets,
  simulateRule,
  updateRule,
} from '@/lib/api/escalation';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';
import { DEMO_ESCALATION_RULES } from '@/lib/demo/escalationFixture';
import {
  conditionsToLogic,
  DEFAULT_RULESET_NAME,
  logicToConditions,
  normalizeApiActions,
  uiActionsToApi,
  type EscalationRuleView,
  type EscalationRuleRun,
  type UiActionRow,
} from '@/lib/utils/escalation';
import type { EscalationCondition } from '@/types';

export const ESCALATION_QUERY_KEY = ['escalation-rules'] as const;

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
  actions?: unknown;
};

async function findOrCreateDefaultRuleset(): Promise<string> {
  const sets = (await listRulesets()) as unknown as ApiRuleset[];
  const existing =
    sets.find(s => s.name === DEFAULT_RULESET_NAME) ??
    sets.find(s => s.enabled !== false && s.isActive !== false) ??
    sets[0];
  if (existing) return existing.id;
  const rs = await createRuleset({ name: DEFAULT_RULESET_NAME, enabled: true });
  return rs.id;
}

async function loadAllRules(): Promise<EscalationRuleView[]> {
  if (isDemoDataEnabled()) return DEMO_ESCALATION_RULES;

  const sets = (await listRulesets()) as unknown as ApiRuleset[];
  const views: EscalationRuleView[] = [];

  for (const set of sets) {
    const rulesetEnabled = set.enabled ?? set.isActive ?? true;
    const rules = (await getRules(set.id)) as ApiRule[];
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
        actions: normalizeApiActions(rule.actions),
      });
    }
  }
  const realIds = views.filter(v => !v.id.includes('-placeholder')).map(v => v.id);
  if (realIds.length) {
    try {
      const stats = await getRunStats(realIds);
      for (const v of views) {
        const s = stats[v.id];
        if (s) {
          v.runCount = s.runCount;
          v.lastTriggeredAt = s.lastTriggeredAt;
        }
      }
    } catch {
      /* stats optional */
    }
  }
  return views;
}

export function useEscalationRules() {
  const demo = isDemoDataEnabled();
  return useQuery({
    queryKey: [...ESCALATION_QUERY_KEY, demo],
    queryFn: loadAllRules,
    enabled: isGatewayQueryEnabled(),
    retry: demo ? false : 1,
  });
}

export function useToggleRuleEnabled() {
  const qc = useQueryClient();
  const demo = isDemoDataEnabled();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      if (demo || id.includes('-placeholder')) {
        const current = qc.getQueryData<EscalationRuleView[]>(ESCALATION_QUERY_KEY) ?? [];
        return current.map(r => (r.id === id ? { ...r, isActive: enabled } : r));
      }
      await updateRule(id, { enabled });
      return loadAllRules();
    },
    onSuccess: data => {
      qc.setQueryData([...ESCALATION_QUERY_KEY, demo], data);
    },
  });
}

export function useDuplicateRule() {
  const qc = useQueryClient();
  const demo = isDemoDataEnabled();
  return useMutation({
    mutationFn: async (rule: EscalationRuleView) => {
      const copyName = `${rule.name} (copy)`;
      if (!demo) {
        const rulesetId = rule.rulesetId || (await findOrCreateDefaultRuleset());
        await createRule(rulesetId, {
          name: copyName,
          enabled: rule.isActive,
          trigger: rule.trigger,
          conditions: conditionsToLogic(rule.conditions, rule.conditionLogic),
          actions: rule.actions,
        } as unknown as Parameters<typeof createRule>[1]);
        return loadAllRules();
      }
      const current = qc.getQueryData<EscalationRuleView[]>(ESCALATION_QUERY_KEY) ?? [];
      const copy: EscalationRuleView = {
        ...rule,
        id: `copy-${Date.now()}`,
        name: copyName,
      };
      return [...current, copy];
    },
    onSuccess: data => {
      qc.setQueryData([...ESCALATION_QUERY_KEY, demo], data);
    },
  });
}

export interface CreateRulePayload {
  name: string;
  enabled: boolean;
  trigger: string;
  conditions: EscalationCondition[];
  conditionLogic: 'and' | 'or';
  actions: UiActionRow[];
}

export type UpdateRulePayload = CreateRulePayload & { id: string };

export function useUpdateEscalationRule() {
  const qc = useQueryClient();
  const demo = isDemoDataEnabled();
  return useMutation({
    mutationFn: async (payload: UpdateRulePayload) => {
      const logic = conditionsToLogic(payload.conditions, payload.conditionLogic);
      const actions = uiActionsToApi(payload.actions);

      if (demo || payload.id.includes('-placeholder')) {
        const current = qc.getQueryData<EscalationRuleView[]>(ESCALATION_QUERY_KEY) ?? [];
        return current.map(r =>
          r.id === payload.id
            ? {
                ...r,
                name: payload.name,
                isActive: payload.enabled,
                trigger: payload.trigger,
                conditionLogic: payload.conditionLogic,
                conditions: payload.conditions,
                actions,
              }
            : r,
        );
      }

      await updateRule(payload.id, {
        name: payload.name,
        enabled: payload.enabled,
        trigger: payload.trigger,
        conditions: logic,
        actions,
      });
      return loadAllRules();
    },
    onSuccess: data => {
      qc.setQueryData([...ESCALATION_QUERY_KEY, demo], data);
    },
  });
}

export function useDeleteEscalationRule() {
  const qc = useQueryClient();
  const demo = isDemoDataEnabled();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      if (demo || ruleId.includes('-placeholder')) {
        const current = qc.getQueryData<EscalationRuleView[]>(ESCALATION_QUERY_KEY) ?? [];
        return current.filter(r => r.id !== ruleId);
      }
      await deleteRule(ruleId);
      return loadAllRules();
    },
    onSuccess: data => {
      qc.setQueryData([...ESCALATION_QUERY_KEY, demo], data);
    },
  });
}

export function useRuleRuns(ruleId: string | undefined, enabled: boolean) {
  const demo = isDemoDataEnabled();
  return useQuery({
    queryKey: ['escalation-runs', ruleId],
    queryFn: async (): Promise<EscalationRuleRun[]> => {
      if (!ruleId || demo) return [];
      return listRuleRuns(ruleId, 30);
    },
    enabled: enabled && Boolean(ruleId) && !demo && isGatewayQueryEnabled(),
  });
}

export function useCreateEscalationRule() {
  const qc = useQueryClient();
  const demo = isDemoDataEnabled();
  return useMutation({
    mutationFn: async (payload: CreateRulePayload) => {
      const logic = conditionsToLogic(payload.conditions, payload.conditionLogic);
      const actions = uiActionsToApi(payload.actions);

      if (demo) {
        const current = qc.getQueryData<EscalationRuleView[]>(ESCALATION_QUERY_KEY) ?? [];
        const row: EscalationRuleView = {
          id: `new-${Date.now()}`,
          rulesetId: 'demo-rs',
          name: payload.name,
          isActive: payload.enabled,
          rulesetEnabled: true,
          trigger: payload.trigger,
          conditionLogic: payload.conditionLogic,
          conditions: payload.conditions,
          actions,
        };
        return [...current, row];
      }

      const rulesetId = await findOrCreateDefaultRuleset();
      await createRule(rulesetId, {
        name: payload.name,
        enabled: payload.enabled,
        trigger: payload.trigger,
        conditions: logic,
        actions,
      } as unknown as Parameters<typeof createRule>[1]);
      return loadAllRules();
    },
    onSuccess: data => {
      qc.setQueryData([...ESCALATION_QUERY_KEY, demo], data);
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
  const demo = isDemoDataEnabled();
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
          const actions = normalizeApiActions(sim.actions ?? (matched && active ? rule.actions : []));
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            matched,
            skippedInactive: matched && !active,
            actions: active ? actions : [],
          });
        } catch {
          if (!demo) throw new Error('Simulation failed');
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
