'use client';

import { Check, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { ActionsList } from '@/components/escalation/ActionsList';
import { dryRunContext } from '@/lib/utils/escalation';
import { useDryRunSimulation, type DryRunResult } from '@/lib/hooks/useEscalation';
import type { EscalationRuleView } from '@/lib/utils/escalation';
import { cn } from '@/lib/utils/cn';

interface FormValues {
  conversationId: string;
  slaTier: string;
  slaStatus: string;
  callStatus: string;
  aiSentiment: string;
  assignedAgent: string;
}

interface Props {
  rules: EscalationRuleView[];
}

export function DryRunPanel({ rules }: Props) {
  const simulate = useDryRunSimulation();
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      conversationId: '42',
      slaTier: 'gold',
      slaStatus: 'breached',
      callStatus: 'active',
      aiSentiment: 'negative',
      assignedAgent: 'agent-1',
    },
  });

  const onSubmit = (values: FormValues) => {
    simulate.mutate({
      rules,
      context: dryRunContext(values),
    });
  };

  return (
    <aside className="w-[260px] shrink-0 border-s border-gray-200 bg-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Dry-run</h2>
        <p className="text-xs text-gray-500 mt-1">
          Simulate which rules would fire for a conversation context.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3 overflow-y-auto flex-1">
        <Field label="Conversation ID">
          <input
            {...register('conversationId')}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5"
          />
        </Field>
        <Field label="SLA tier">
          <select {...register('slaTier')} className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5">
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="bronze">Bronze</option>
          </select>
        </Field>
        <Field label="SLA status">
          <select {...register('slaStatus')} className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5">
            <option value="breached">breached</option>
            <option value="at_risk">at_risk</option>
            <option value="active">active</option>
            <option value="met">met</option>
          </select>
        </Field>
        <Field label="Call status">
          <select {...register('callStatus')} className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5">
            <option value="active">active</option>
            <option value="missed">missed</option>
            <option value="ended">ended</option>
          </select>
        </Field>
        <Field label="AI sentiment">
          <select {...register('aiSentiment')} className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5">
            <option value="positive">positive</option>
            <option value="neutral">neutral</option>
            <option value="negative">negative</option>
          </select>
        </Field>
        <Field label="Assigned agent">
          <input
            {...register('assignedAgent')}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5"
          />
        </Field>

        <button
          type="submit"
          disabled={simulate.isPending}
          className="w-full py-2 rounded-md bg-[#0B5FFF] text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {simulate.isPending && <Loader2 size={14} className="animate-spin" />}
          Run simulation
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            simulate.reset();
          }}
          className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          Reset
        </button>

        {simulate.data && (
          <ResultsList results={simulate.data} />
        )}
      </form>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ResultsList({ results }: { results: DryRunResult[] }) {
  return (
    <div className="pt-3 border-t border-gray-100 space-y-3">
      <p className="text-xs font-semibold text-gray-700">Results</p>
      {results.map(r => (
        <div key={r.ruleId} className="text-xs">
          <div className="flex items-start gap-1.5">
            {r.matched ? (
              <Check size={14} className="text-green-600 shrink-0 mt-0.5" />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full bg-gray-200 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className={cn('font-medium', r.matched ? 'text-green-700' : 'text-gray-500')}>
                {r.ruleName}
                {!r.matched && ' — no match'}
                {r.matched && !r.skippedInactive && ' — matched'}
              </p>
              {r.skippedInactive && (
                <p className="text-gray-400 italic">(inactive, skipped)</p>
              )}
              {r.matched && r.actions.length > 0 && !r.skippedInactive && (
                <div className="mt-2 ps-1 border-s-2 border-green-100">
                  <ActionsList actions={r.actions} />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
