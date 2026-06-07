import type { SlaInstanceView, SlaUiStatus } from '@/lib/demo/slaFixture';

export function mapApiInstance(raw: Record<string, unknown>): SlaInstanceView {
  const status = String(raw.status ?? 'active');
  let uiStatus: SlaUiStatus = 'active';
  if (status === 'breached') uiStatus = 'breached';
  else if (status === 'warning_sent') uiStatus = 'at_risk';
  else if (status === 'met') uiStatus = 'met';

  const dueAt = String(raw.dueAt ?? raw.due_at ?? '');
  const startedAt = String(raw.startedAt ?? raw.started_at ?? '');
  const dueMs = dueAt ? new Date(dueAt).getTime() : NaN;
  const startMs = startedAt ? new Date(startedAt).getTime() : NaN;
  const totalSeconds =
    Number.isFinite(dueMs) && Number.isFinite(startMs)
      ? Math.max(60, Math.floor((dueMs - startMs) / 1000))
      : 3600;
  const elapsedSeconds = Number.isFinite(startMs)
    ? Math.max(0, Math.floor((Date.now() - startMs) / 1000))
    : 0;

  const targetType = String(raw.targetType ?? raw.target_type ?? '');
  const targetLabel =
    targetType === 'first_response'
      ? 'First response'
      : targetType === 'next_response'
        ? 'Next response'
        : targetType === 'resolution'
          ? 'Resolution'
          : targetType;

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
    subject: String(raw.subject ?? (targetLabel ? `${policyName} · ${targetLabel}` : policyName)),
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
  const dueMs = inst.dueAt ? new Date(inst.dueAt).getTime() : NaN;
  if (!Number.isFinite(dueMs)) return '—';
  const leftSec = Math.floor((dueMs - Date.now()) / 1000);
  const abs = Math.abs(leftSec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  if (inst.uiStatus === 'breached' || leftSec < 0) return `−${label}`;
  if (inst.uiStatus === 'met') return '—';
  // Sanity cap — bad legacy rows (e.g. missing calendar during backfill)
  if (leftSec > 365 * 24 * 3600) return '—';
  return `${label} left`;
}

export function formatDeadline(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
