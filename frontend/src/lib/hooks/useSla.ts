'use client';

import { useQuery } from '@tanstack/react-query';
import { getSlaDashboard, listPolicies } from '@/lib/api/sla';
import {
  demoDashboard,
  DEMO_POLICIES,
  type SlaInstanceView,
  type SlaUiStatus,
} from '@/lib/demo/slaFixture';
import { mapApiInstance } from '@/lib/utils/sla';
import type { SLAPolicy } from '@/types';

export type SlaFilter = 'dashboard' | 'breached' | 'at_risk' | 'active' | 'met';

export function useSlaDashboard() {
  return useQuery({
    queryKey: ['sla-dashboard'],
    queryFn: async () => {
      try {
        const raw = await getSlaDashboard();
        const data = raw as {
          breached?: unknown[];
          atRisk?: unknown[];
          active?: unknown[];
          met?: unknown[];
          stats?: { breachedCount?: number; atRiskCount?: number; activeCount?: number; metToday?: number; compliancePct?: number };
        };
        const breached = (data.breached ?? []).map(r => mapApiInstance(r as Record<string, unknown>));
        const atRisk = (data.atRisk ?? []).map(r => mapApiInstance(r as Record<string, unknown>));
        const active = (data.active ?? []).map(r => mapApiInstance(r as Record<string, unknown>));
        const met = (data.met ?? []).map(r => mapApiInstance(r as Record<string, unknown>));
        if (breached.length + atRisk.length + active.length === 0 && met.length === 0) {
          return demoDashboard();
        }
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
            compliancePct: data.stats?.compliancePct ?? 87,
          },
        };
      } catch {
        return demoDashboard();
      }
    },
    refetchInterval: 30_000,
  });
}

export function useSlaPolicies() {
  return useQuery({
    queryKey: ['sla-policies'],
    queryFn: async () => {
      try {
        const policies = await listPolicies();
        const mapped = policies.map(p => normalizePolicy(p));
        return mapped.length ? mapped : DEMO_POLICIES;
      } catch {
        return DEMO_POLICIES;
      }
    },
  });
}

function normalizePolicy(p: SLAPolicy): SLAPolicy {
  if (p.tier && p.firstResponseMinutes) return p;
  const raw = p as SLAPolicy & { targets?: { thresholdMinutes?: number }[]; businessHoursCalendarId?: string };
  const name = String(p.name ?? 'Policy');
  const tier = name.toLowerCase().includes('gold')
    ? 'gold'
    : name.toLowerCase().includes('bronze')
      ? 'bronze'
      : 'silver';
  const targets = raw.targets;
  const firstMin = targets?.[0]?.thresholdMinutes ?? 30;
  return {
    id: String(p.id),
    tenantId: String(p.tenantId ?? '1'),
    name,
    tier: tier as SLAPolicy['tier'],
    firstResponseMinutes: firstMin,
    resolutionHours: Math.max(1, Math.round(firstMin / 15)),
    escalationHours: Math.max(1, Math.round(firstMin / 30)),
    calendarId: raw.businessHoursCalendarId,
  };
}

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
