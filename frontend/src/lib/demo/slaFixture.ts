import type { SLAPolicy, SLAInstance } from '@/types';
import type { SlaBreachStat } from '@/lib/api/sla';

export type SlaUiStatus = 'breached' | 'at_risk' | 'active' | 'met';

export interface SlaInstanceView extends SLAInstance {
  uiStatus: SlaUiStatus;
  dueAt?: string;
  startedAt?: string;
  policyName?: string;
  assignee?: string;
  tier?: 'gold' | 'silver' | 'bronze';
  elapsedSeconds?: number;
  totalSeconds?: number;
}

export const DEMO_POLICIES: SLAPolicy[] = [
  {
    id: 'p-gold',
    tenantId: '1',
    name: 'Gold SLA',
    tier: 'gold',
    firstResponseMinutes: 15,
    resolutionHours: 4,
    escalationHours: 2,
    calendarId: 'bh-1',
  },
  {
    id: 'p-silver',
    tenantId: '1',
    name: 'Silver SLA',
    tier: 'silver',
    firstResponseMinutes: 30,
    resolutionHours: 8,
    escalationHours: 4,
  },
  {
    id: 'p-bronze',
    tenantId: '1',
    name: 'Bronze SLA',
    tier: 'bronze',
    firstResponseMinutes: 60,
    resolutionHours: 24,
    escalationHours: 8,
  },
];

const now = Date.now();

function inst(
  id: string,
  convId: number,
  uiStatus: SlaUiStatus,
  name: string,
  tier: 'gold' | 'silver' | 'bronze',
  dueOffsetMs: number,
  subject: string,
  assignee?: string,
): SlaInstanceView {
  const due = new Date(now + dueOffsetMs).toISOString();
  const started = new Date(now - 3_600_000).toISOString();
  const totalSeconds = 4 * 3600;
  const elapsed =
    uiStatus === 'breached'
      ? totalSeconds + 1800
      : uiStatus === 'at_risk'
        ? totalSeconds * 0.88
        : totalSeconds * 0.4;
  return {
    id,
    conversationId: String(convId),
    policyId: `p-${tier}`,
    status: uiStatus === 'met' ? 'met' : uiStatus === 'breached' ? 'breached' : 'active',
    firstResponseDeadline: due,
    resolutionDeadline: due,
    breachedAt: uiStatus === 'breached' ? new Date().toISOString() : undefined,
    contact: { name, tier },
    subject,
    uiStatus,
    dueAt: due,
    startedAt: started,
    policyName: `${tier.charAt(0).toUpperCase()}${tier.slice(1)} SLA`,
    assignee,
    tier,
    elapsedSeconds: elapsed,
    totalSeconds,
  };
}

export const DEMO_BREACHED: SlaInstanceView[] = [
  inst('sla-1', 3, 'breached', 'Yusuf Khan', 'gold', -7200_000, 'Outage in Muscat', undefined),
];

export const DEMO_AT_RISK: SlaInstanceView[] = [
  inst('sla-2', 7, 'at_risk', 'Hassan Al-Farsi', 'gold', 900_000, 'Payment failed', 'Sarah Al-Hinai'),
  inst('sla-3', 1, 'at_risk', 'Ahmed Al-Balushi', 'silver', 600_000, 'Fiber plan upgrade', 'Sarah Al-Hinai'),
];

export const DEMO_ACTIVE: SlaInstanceView[] = [
  inst('sla-4', 4, 'active', 'Maryam Al-Habsi', 'silver', 5400_000, 'New business line', 'BlinkOne'),
  inst('sla-5', 6, 'active', 'Layla Al-Abri', 'bronze', 12_000_000, 'Mobile roaming', 'BlinkOne'),
];

export const DEMO_MET: SlaInstanceView[] = [
  inst('sla-6', 5, 'met', 'Khalid Al-Rashdi', 'bronze', 0, 'Resolved — thank you', 'Sarah Al-Hinai'),
];

export const DEMO_SLA_BREACH_STATS: SlaBreachStat[] = [
  { date: '2026-05-21', breaches: 3, total: 74, breachRate: 4.1 },
  { date: '2026-05-22', breaches: 5, total: 82, breachRate: 6.1 },
  { date: '2026-05-23', breaches: 2, total: 88, breachRate: 2.3 },
  { date: '2026-05-24', breaches: 6, total: 79, breachRate: 7.6 },
  { date: '2026-05-25', breaches: 4, total: 86, breachRate: 4.7 },
  { date: '2026-05-26', breaches: 1, total: 36, breachRate: 2.8 },
  { date: '2026-05-27', breaches: 0, total: 24, breachRate: 0 },
];

export function demoDashboard() {
  return {
    breached: DEMO_BREACHED,
    atRisk: DEMO_AT_RISK,
    active: DEMO_ACTIVE,
    met: DEMO_MET,
    stats: {
      breachedCount: DEMO_BREACHED.length,
      atRiskCount: DEMO_AT_RISK.length,
      activeCount: DEMO_ACTIVE.length,
      metToday: DEMO_MET.length,
      compliancePct: 87,
    },
  };
}
