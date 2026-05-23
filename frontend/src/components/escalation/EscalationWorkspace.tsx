'use client';

import { useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { RulesetCard } from '@/components/escalation/RulesetCard';
import { DryRunPanel } from '@/components/escalation/DryRunPanel';
import { NewRuleModal } from '@/components/escalation/NewRuleModal';
import {
  useDuplicateRule,
  useEscalationRules,
  useToggleRuleEnabled,
} from '@/lib/hooks/useEscalation';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { DemoBanner } from '@/components/ui/DemoBanner';

export function EscalationWorkspace() {
  const { data: rules = [], isLoading } = useEscalationRules();
  const toggle = useToggleRuleEnabled();
  const duplicate = useDuplicateRule();
  const [modalOpen, setModalOpen] = useState(false);
  const dryRunRef = useRef<HTMLDivElement>(null);

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
            onClick={() => setModalOpen(true)}
            className="px-3 py-1.5 text-sm bg-[#0B5FFF] text-white rounded-md hover:bg-blue-700 inline-flex items-center gap-1"
          >
            <Plus size={16} />
            New rule
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isDemoDataEnabled() && (
            <DemoBanner label="Escalation demo rules (5 sample rulesets)" />
          )}
          {isLoading ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : (
            <>
              {rules.map(rule => (
                <RulesetCard
                  key={rule.id}
                  rule={rule}
                  onToggle={enabled => toggle.mutate({ id: rule.id, enabled })}
                  onDuplicate={() => duplicate.mutate(rule)}
                />
              ))}
              <button
                type="button"
                onClick={() => setModalOpen(true)}
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

      <NewRuleModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
