'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getSlaDashboard,
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getBreachStats,
  type SlaBreachStat,
} from '@/lib/api/sla';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';
import {
  demoDashboard,
  DEMO_POLICIES,
  DEMO_SLA_BREACH_STATS,
  type SlaInstanceView,
  type SlaUiStatus,
} from '@/lib/demo/slaFixture';
import { mapApiInstance } from '@/lib/utils/sla';
import type { SLAPolicy } from '@/types';

export type SlaFilter = 'dashboard' | 'breached' | 'at_risk' | 'active' | 'met';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useSlaDashboard() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['sla-dashboard', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return demoDashboard();
      try {
        const raw = await getSlaDashboard();
        const data = raw as {
          breached?: unknown[];
          atRisk?: unknown[];
          active?: unknown[];
          met?: unknown[];
          stats?: {
            breachedCount?: number;
            atRiskCount?: number;
            activeCount?: number;
            metToday?: number;
            compliancePct?: number;
          };
        };
        const breached = (data.breached ?? []).map(r => mapApiInstance(r as Record<string, unknown>));
        const atRisk = (data.atRisk ?? []).map(r => mapApiInstance(r as Record<string, unknown>));
        const active = (data.active ?? []).map(r => mapApiInstance(r as Record<string, unknown>));
        const met = (data.met ?? []).map(r => mapApiInstance(r as Record<string, unknown>));
        return {
          breached,
          atRisk,
          active,
          met,
          stats: {
            breachedCount: data.stats?.breachedCount ?? breached.length,
            atRiskCount: data.stats?.atRiskCount ?? atRisk.length,
            activeCount: data.stats?.activeCount ?? active.length,
            metToday: data.stats?.metToday ?? met.length,
            compliancePct: data.stats?.compliancePct ?? 0,
          },
        };
      } catch {
        return {
          breached: [],
          atRisk: [],
          active: [],
          met: [],
          stats: {
            breachedCount: 0,
            atRiskCount: 0,
            activeCount: 0,
            metToday: 0,
            compliancePct: 0,
          },
        };
      }
    },
    enabled: gwEnabled,
    refetchInterval: gwEnabled ? 30_000 : false,
  });
}

// ─── Breach alert toasts (compares previous dashboard state) ──────────────────

export function useSlaBreachAlerts() {
  const { data } = useSlaDashboard();
  const prevBreachedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!data) return;
    const currentIds = new Set(data.breached.map(i => i.id));
    const newBreaches = data.breached.filter(i => !prevBreachedIds.current.has(i.id));
    for (const inst of newBreaches) {
      toast.error(
        `SLA breached — conversation #${inst.conversationId}`,
        {
          description: inst.contact?.name
            ? `${inst.contact.name} · ${inst.policyName ?? 'SLA policy'}`
            : inst.policyName ?? 'SLA policy breached',
          duration: 10_000,
          id: `sla-breach-${inst.id}`,
        },
      );
    }
    prevBreachedIds.current = currentIds;
  }, [data]);
}

// ─── Per-conversation SLA lookup (from cached dashboard) ─────────────────────

export function useSlaForConversation(conversationId?: number): SlaInstanceView | null {
  const { data } = useSlaDashboard();
  if (!data || !conversationId) return null;
  const id = String(conversationId);
  return (
    data.breached.find(i => i.conversationId === id) ??
    data.atRisk.find(i => i.conversationId === id) ??
    data.active.find(i => i.conversationId === id) ??
    null
  );
}

// ─── Policies ─────────────────────────────────────────────────────────────────

export function useSlaPolicies() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['sla-policies', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_POLICIES;
      try {
        const policies = await listPolicies();
        return policies.map(p => normalizePolicy(p));
      } catch {
        return [];
      }
    },
    enabled: gwEnabled,
  });
}

function normalizePolicy(p: SLAPolicy): SLAPolicy {
  if (p.tier && p.firstResponseMinutes) return p;
  const raw = p as SLAPolicy & {
    targets?: { targetType?: string; thresholdMinutes?: number }[];
    businessHoursCalendarId?: string;
  };
  const name = String(p.name ?? 'Policy');
  const tier = name.toLowerCase().includes('gold')
    ? 'gold'
    : name.toLowerCase().includes('silver')
      ? 'silver'
      : 'bronze';
  const targets = raw.targets ?? [];
  const firstTarget =
    targets.find(t => t.targetType === 'first_response') ?? targets[0];
  const resolutionTarget = targets.find(t => t.targetType === 'resolution');
  const firstMin = firstTarget?.thresholdMinutes ?? 30;
  const resolutionHours = resolutionTarget?.thresholdMinutes != null
    ? Math.max(1, Math.round(resolutionTarget.thresholdMinutes / 60))
    : Math.max(1, Math.round(firstMin / 15));
  return {
    id: String(p.id),
    tenantId: String(p.tenantId ?? '1'),
    name,
    tier: tier as SLAPolicy['tier'],
    firstResponseMinutes: firstMin,
    resolutionHours,
    escalationHours: Math.max(1, Math.round(firstMin / 30)),
    calendarId: raw.businessHoursCalendarId,
  };
}

// ─── Policy mutations ─────────────────────────────────────────────────────────

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<SLAPolicy, 'id' | 'tenantId'>) => createPolicy(data),
    onSuccess: () => {
      toast.success('Policy created');
      void qc.invalidateQueries({ queryKey: ['sla-policies'] });
    },
    onError: (e: Error) => toast.error(`Failed to create policy: ${e.message}`),
  });
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<SLAPolicy, 'id' | 'tenantId'>> }) =>
      updatePolicy(id, data),
    onSuccess: () => {
      toast.success('Policy updated');
      void qc.invalidateQueries({ queryKey: ['sla-policies'] });
    },
    onError: (e: Error) => toast.error(`Failed to update policy: ${e.message}`),
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePolicy(id),
    onSuccess: () => {
      toast.success('Policy deleted');
      void qc.invalidateQueries({ queryKey: ['sla-policies'] });
    },
    onError: (e: Error) => toast.error(`Failed to delete policy: ${e.message}`),
  });
}

// ─── Breach stats (for Analytics dashboard) ───────────────────────────────────

export function useSlaBreachStats(since: number, until: number): { data: SlaBreachStat[]; isLoading: boolean } {
  const gwEnabled = isGatewayQueryEnabled();
  const q = useQuery<SlaBreachStat[]>({
    queryKey: ['sla-breach-stats', since, until, isDemoDataEnabled()],
    queryFn: async (): Promise<SlaBreachStat[]> => {
      if (isDemoDataEnabled()) return DEMO_SLA_BREACH_STATS;
      try {
        return await getBreachStats(since, until);
      } catch {
        return DEMO_SLA_BREACH_STATS;
      }
    },
    enabled: gwEnabled,
    staleTime: 5 * 60_000,
  });
  return { data: q.data ?? [], isLoading: q.isLoading };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function instancesForFilter(
  data: ReturnType<typeof demoDashboard> | undefined,
  filter: SlaFilter,
): SlaInstanceView[] {
  if (!data) return [];
  if (filter === 'breached') return data.breached;
  if (filter === 'at_risk') return data.atRisk;
  if (filter === 'active') return data.active;
  if (filter === 'met') return data.met;
  return [...data.breached, ...data.atRisk, ...data.active];
}

export function uiStatusLabel(s: SlaUiStatus): string {
  if (s === 'at_risk') return 'At risk';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
