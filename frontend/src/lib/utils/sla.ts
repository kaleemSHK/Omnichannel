import type { SlaInstanceView, SlaUiStatus } from '@/lib/demo/slaFixture';

export function mapApiInstance(raw: Record<string, unknown>): SlaInstanceView {
  const status = String(raw.status ?? 'active');
  let uiStatus: SlaUiStatus = 'active';
  if (status === 'breached') uiStatus = 'breached';
  else if (status === 'warning_sent') uiStatus = 'at_risk';

  const dueAt = String(raw.dueAt ?? raw.due_at ?? '');
  const startedAt = String(raw.startedAt ?? raw.started_at ?? '');
  const dueMs = dueAt ? new Date(dueAt).getTime() : Date.now();
  const startMs = startedAt ? new Date(startedAt).getTime() : dueMs - 3_600_000;
  const totalSeconds = Math.max(60, Math.floor((dueMs - startMs) / 1000));
  const elapsedSeconds = Math.floor((Date.now() - startMs) / 1000);

  const policyName = String(raw.policyName ?? raw.policy_name ?? 'SLA');
  const tierGuess = policyName.toLowerCase().includes('gold')
    ? 'gold'
    : policyName.toLowerCase().includes('bronze')
      ? 'bronze'
      : 'silver';

  return {
    id: String(raw.id),
    conversationId: String(raw.conversationId ?? raw.conversation_id ?? ''),
    policyId: String(raw.policyId ?? raw.policy_id ?? ''),
    status: status === 'breached' ? 'breached' : status === 'met' ? 'met' : 'active',
    firstResponseDeadline: dueAt,
    resolutionDeadline: dueAt,
    breachedAt: raw.breachedAt as string | undefined,
    metAt: raw.metAt as string | undefined,
    contact: {
      name: String((raw.contact as { name?: string })?.name ?? `Conversation ${raw.conversationId}`),
      tier: tierGuess,
    },
    subject: String(raw.subject ?? policyName),
    uiStatus,
    dueAt,
    startedAt,
    policyName,
    tier: tierGuess,
    elapsedSeconds,
    totalSeconds,
    assignee: raw.assignee as string | undefined,
  };
}

export function tierBadgeClass(tier?: string): string {
  if (tier === 'gold') return 'bg-amber-100 text-amber-800';
  if (tier === 'bronze') return 'bg-orange-100 text-orange-800';
  return 'bg-gray-100 text-gray-600';
}

export function statusChipClass(status: SlaUiStatus): string {
  if (status === 'breached') return 'bg-red-100 text-red-800';
  if (status === 'at_risk') return 'bg-amber-100 text-amber-800';
  if (status === 'met') return 'bg-gray-100 text-gray-600';
  return 'bg-blue-100 text-blue-800';
}

export function formatRemaining(inst: SlaInstanceView): string {
  const left = (inst.totalSeconds ?? 0) - (inst.elapsedSeconds ?? 0);
  const abs = Math.abs(left);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  if (inst.uiStatus === 'breached') return `−${label}`;
  if (inst.uiStatus === 'met') return '—';
  return `${label} left`;
}

export function formatDeadline(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
