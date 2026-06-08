'use client';

/**
 * SLAConversationBadge — compact SLA status widget for a specific conversation.
 * Reads from the cached SLA dashboard (no extra request per conversation).
 * Used inside AgentAssistPanel.
 */

import { useConversationSla } from '@/lib/hooks/useSla';
import { formatRemaining, formatDeadline, statusChipClass } from '@/lib/utils/sla';
import { uiStatusLabel } from '@/lib/hooks/useSla';
import { CountdownBar } from '@/components/sla/CountdownBar';
import { cn } from '@/lib/utils/cn';

interface Props {
  conversationId: number;
}

export function SLAConversationBadge({ conversationId }: Props) {
  const { data: inst, isLoading } = useConversationSla(conversationId);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading SLA…</p>;
  }

  if (!inst) {
    return (
      <p className="text-xs text-muted-foreground">No active SLA for this conversation</p>
    );
  }

  const isUrgent = inst.uiStatus === 'breached' || inst.uiStatus === 'at_risk';

  return (
    <div className={cn(
      'rounded-md border p-3 space-y-2',
      inst.uiStatus === 'breached' ? 'border-red-200 bg-red-50'
      : inst.uiStatus === 'at_risk' ? 'border-amber-200 bg-amber-50'
      : 'border-gray-200 bg-background'
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusChipClass(inst.uiStatus))}>
          {uiStatusLabel(inst.uiStatus)}
        </span>
        <span className="text-[10px] text-muted-foreground truncate">
          {inst.policyName ?? 'SLA'}
        </span>
      </div>

      {/* Countdown bar (at_risk only) */}
      {inst.uiStatus === 'at_risk' && (
        <CountdownBar
          elapsedSeconds={inst.elapsedSeconds ?? 0}
          totalSeconds={inst.totalSeconds ?? 1}
        />
      )}

      {/* Deadline + remaining */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Due {formatDeadline(inst.dueAt ?? inst.resolutionDeadline)}
        </span>
        <span className={cn(
          'font-medium tabular-nums',
          isUrgent ? (inst.uiStatus === 'breached' ? 'text-red-600' : 'text-amber-600') : 'text-green-700',
        )}>
          {formatRemaining(inst)}
        </span>
      </div>
    </div>
  );
}
