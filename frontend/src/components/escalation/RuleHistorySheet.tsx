'use client';

import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { ActionsList } from '@/components/escalation/ActionsList';
import { useRuleRuns } from '@/lib/hooks/useEscalation';
import { normalizeApiActions, type EscalationRuleView } from '@/lib/utils/escalation';
import { cn } from '@/lib/utils/cn';

interface Props {
  rule: EscalationRuleView | null;
  open: boolean;
  onClose: () => void;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function RuleHistorySheet({ rule, open, onClose }: Props) {
  const { data: runs = [], isLoading, isError } = useRuleRuns(rule?.id, open);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={rule ? `Run history — ${rule.name}` : 'Run history'}
      className="max-w-lg"
    >
      {isLoading ? (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : isError ? (
        <p className="text-sm text-amber-800 py-4">Could not load run history.</p>
      ) : !runs.length ? (
        <p className="text-sm text-gray-500 py-4">
          No runs recorded yet. Rules log here when events fire in production (not dry-run).
        </p>
      ) : (
        <ul className="space-y-3 max-h-[420px] overflow-y-auto pe-1">
          {runs.map(run => {
            const eventType = String(
              (run.inputEvent as Record<string, unknown>)?.event_type ?? 'event',
            );
            const convId = (run.inputEvent as Record<string, unknown>)?.conversation_id;
            return (
              <li
                key={run.id}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm',
                  run.conditionsPassed ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-white',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {run.conditionsPassed ? 'Matched' : 'Evaluated — no match'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatWhen(run.triggeredAt)} · {eventType}
                      {convId != null && ` · conv ${String(convId)}`}
                    </p>
                  </div>
                </div>
                {run.conditionsPassed && run.actionsAttempted?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-green-100">
                    <ActionsList actions={normalizeApiActions(run.actionsAttempted)} />
                  </div>
                )}
                {run.error && (
                  <p className="text-xs text-red-600 mt-1">Error: {run.error}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
