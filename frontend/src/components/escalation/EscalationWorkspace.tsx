'use client';

import { useRef, useState } from 'react';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { RulesetCard } from '@/components/escalation/RulesetCard';
import { DryRunPanel } from '@/components/escalation/DryRunPanel';
import { NewRuleModal } from '@/components/escalation/NewRuleModal';
import { EditRuleModal } from '@/components/escalation/EditRuleModal';
import { RuleHistorySheet } from '@/components/escalation/RuleHistorySheet';
import { ConfirmDialog } from '@/components/settings/shared/ConfirmDialog';
import {
  useDeleteEscalationRule,
  useDuplicateRule,
  useEscalationRules,
  useToggleRuleEnabled,
} from '@/lib/hooks/useEscalation';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { DEMO_ESCALATION_RULE_COUNT } from '@/lib/demo/escalationFixture';
import { DemoBanner } from '@/components/ui/DemoBanner';
import type { EscalationRuleView } from '@/lib/utils/escalation';

export function EscalationWorkspace() {
  const { data: rules = [], isLoading, isError, error, refetch } = useEscalationRules();
  const toggle = useToggleRuleEnabled();
  const duplicate = useDuplicateRule();
  const remove = useDeleteEscalationRule();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule] = useState<EscalationRuleView | null>(null);
  const [historyRule, setHistoryRule] = useState<EscalationRuleView | null>(null);
  const [deleteRule, setDeleteRule] = useState<EscalationRuleView | null>(null);
  const dryRunRef = useRef<HTMLDivElement>(null);
  const demo = isDemoDataEnabled();

  const scrollToDryRun = () => {
    dryRunRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-3rem)] bg-surface-tertiary">
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
        <h1 className="text-base font-semibold text-gray-900">Escalation rules</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={scrollToDryRun}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Dry-run simulator
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-3 py-1.5 text-sm bg-[#0B5FFF] text-white rounded-md hover:bg-blue-700 inline-flex items-center gap-1"
          >
            <Plus size={16} />
            New rule
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {demo && (
            <DemoBanner
              label={`Sample escalation rules (${DEMO_ESCALATION_RULE_COUNT} presets — set NEXT_PUBLIC_USE_DEMO_DATA=false for live API)`}
            />
          )}

          {isError && !demo && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Could not load escalation rules</p>
                <p className="text-xs mt-0.5 text-amber-800">
                  {(error as Error)?.message ?? 'Check gateway JWT and escalation service.'}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-xs underline mt-1 hover:text-amber-950"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : (
            <>
              {!rules.length && !isError && (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No escalation rules yet. Create one or run the SLA demo seed for defaults.
                </div>
              )}
              {rules.map(rule => (
                <RulesetCard
                  key={rule.id}
                  rule={rule}
                  onToggle={enabled => toggle.mutate({ id: rule.id, enabled })}
                  onDuplicate={() => duplicate.mutate(rule)}
                  onEdit={() => setEditRule(rule)}
                  onHistory={() => setHistoryRule(rule)}
                  onDelete={() => setDeleteRule(rule)}
                />
              ))}
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-[#0B5FFF] hover:text-[#0B5FFF] transition-colors"
              >
                + Add rule
              </button>
            </>
          )}
        </div>

        <div ref={dryRunRef}>
          <DryRunPanel rules={rules} />
        </div>
      </div>

      <NewRuleModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditRuleModal rule={editRule} open={Boolean(editRule)} onClose={() => setEditRule(null)} />
      <RuleHistorySheet
        rule={historyRule}
        open={Boolean(historyRule)}
        onClose={() => setHistoryRule(null)}
      />
      <ConfirmDialog
        open={Boolean(deleteRule)}
        title="Delete escalation rule?"
        description={
          deleteRule
            ? `"${deleteRule.name}" will be permanently removed. Run history for this rule will also be deleted.`
            : ''
        }
        confirmLabel="Delete rule"
        isPending={remove.isPending}
        onCancel={() => setDeleteRule(null)}
        onConfirm={() => {
          if (!deleteRule) return;
          remove.mutate(deleteRule.id, {
            onSuccess: () => setDeleteRule(null),
          });
        }}
      />
    </div>
  );
}
