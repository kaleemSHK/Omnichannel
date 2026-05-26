'use client';

/**
 * Bot Routing Rules Editor — Sprint 2 A01
 *
 * Allows admins to configure per-tenant bot routing rules that determine
 * when the voicebot escalates to a human agent and which queue to use.
 *
 * Features:
 *   - List rules with enable/disable toggle and priority badge
 *   - Add new rule: trigger type + params + action
 *   - Edit existing rule inline
 *   - Delete rule
 *   - Test / dry-run evaluation panel
 *   - Reset to built-in defaults
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getBotRoutingRules,
  saveBotRoutingRules,
  resetBotRoutingRules,
  evaluateBotRoutingRule,
  type BotRoutingConfig,
  type BotRoutingRule,
  type BotTriggerType,
  type BotActionType,
} from '@/lib/api/ai';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Play,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const QUERY_KEY = ['bot-routing-rules'];

// ─── Trigger type labels ──────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<BotTriggerType, string> = {
  intent: 'LLM Intent',
  keyword: 'Keyword in transcript',
  misunderstanding_count: 'Misunderstanding count ≥',
  sentiment: 'Sentiment is',
};

const KNOWN_INTENTS = [
  'billing_inquiry',
  'technical_support',
  'plan_change',
  'complaint',
  'unrecognized',
];

// ─── Blank rule factory ────────────────────────────────────────────────────────

function blankRule(): BotRoutingRule {
  return {
    id: `rule-${Date.now()}`,
    name: 'New rule',
    enabled: true,
    priority: 5,
    trigger: { type: 'intent', intents: [] },
    action: { type: 'transfer_to_agent', queueKey: 'default', message: '' },
  };
}

// ─── Single rule editor ────────────────────────────────────────────────────────

function RuleEditor({
  rule,
  onUpdate,
  onDelete,
}: {
  rule: BotRoutingRule;
  onUpdate: (r: BotRoutingRule) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const set = (patch: Partial<BotRoutingRule>) => onUpdate({ ...rule, ...patch });
  const setTrigger = (patch: Partial<BotRoutingRule['trigger']>) =>
    set({ trigger: { ...rule.trigger, ...patch } });
  const setAction = (patch: Partial<BotRoutingRule['action']>) =>
    set({ action: { ...rule.action, ...patch } });

  const triggerSummary = () => {
    switch (rule.trigger.type) {
      case 'intent':
        return rule.trigger.intents?.join(', ') || '—';
      case 'keyword':
        return rule.trigger.keywords?.join(', ') || '—';
      case 'misunderstanding_count':
        return `≥ ${rule.trigger.threshold ?? 3}`;
      case 'sentiment':
        return rule.trigger.sentiment || '—';
      default:
        return '—';
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border bg-white transition-colors',
        rule.enabled ? 'border-gray-200' : 'border-dashed border-gray-200 opacity-60',
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* enable toggle */}
        <button
          type="button"
          onClick={() => set({ enabled: !rule.enabled })}
          title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          className={cn(
            'w-8 h-5 rounded-full transition-colors shrink-0',
            rule.enabled ? 'bg-green-500' : 'bg-gray-300',
          )}
        >
          <span
            className={cn(
              'block w-3 h-3 rounded-full bg-white shadow mx-1 transition-transform',
              rule.enabled ? 'translate-x-3' : 'translate-x-0',
            )}
          />
        </button>

        <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
          P{rule.priority}
        </Badge>

        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{rule.name}</span>

        <span className="text-[10px] text-muted-foreground hidden sm:block truncate max-w-[140px]">
          {TRIGGER_LABELS[rule.trigger.type]}: {triggerSummary()}
        </span>

        <Badge
          variant="secondary"
          className={cn(
            'text-[10px] shrink-0',
            rule.action.type === 'transfer_to_agent'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-red-50 text-red-700',
          )}
        >
          {rule.action.type === 'transfer_to_agent'
            ? `→ ${rule.action.queueKey}`
            : 'end call'}
        </Badge>

        <button type="button" onClick={() => setExpanded((p) => !p)} className="p-1 text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-3 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700 mb-1">Name</label>
              <input
                value={rule.name}
                onChange={(e) => set({ name: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">Priority (higher = first)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={rule.priority}
                onChange={(e) => set({ priority: Number(e.target.value) })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs"
              />
            </div>
          </div>

          {/* Trigger */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Trigger type</label>
            <select
              value={rule.trigger.type}
              onChange={(e) => setTrigger({ type: e.target.value as BotTriggerType })}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-md bg-white text-xs"
            >
              {(Object.entries(TRIGGER_LABELS) as [BotTriggerType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {rule.trigger.type === 'intent' && (
            <div>
              <label className="block font-medium text-gray-700 mb-1">Intents (comma-separated)</label>
              <input
                value={(rule.trigger.intents ?? []).join(', ')}
                onChange={(e) =>
                  setTrigger({
                    intents: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder={KNOWN_INTENTS.join(', ')}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-md font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Known: {KNOWN_INTENTS.join(' · ')}
              </p>
            </div>
          )}

          {rule.trigger.type === 'keyword' && (
            <div>
              <label className="block font-medium text-gray-700 mb-1">Keywords (comma-separated)</label>
              <input
                value={(rule.trigger.keywords ?? []).join(', ')}
                onChange={(e) =>
                  setTrigger({
                    keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="agent, human, موظف, تحويل"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-md font-mono text-xs"
              />
            </div>
          )}

          {rule.trigger.type === 'misunderstanding_count' && (
            <div>
              <label className="block font-medium text-gray-700 mb-1">Threshold (number of misunderstandings)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={rule.trigger.threshold ?? 3}
                onChange={(e) => setTrigger({ threshold: Number(e.target.value) })}
                className="w-24 px-2 py-1.5 border border-gray-200 rounded-md text-xs"
              />
            </div>
          )}

          {rule.trigger.type === 'sentiment' && (
            <div>
              <label className="block font-medium text-gray-700 mb-1">Sentiment label</label>
              <select
                value={rule.trigger.sentiment ?? 'negative'}
                onChange={(e) => setTrigger({ sentiment: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-md bg-white text-xs"
              >
                <option value="negative">negative</option>
                <option value="neutral">neutral</option>
                <option value="positive">positive</option>
              </select>
            </div>
          )}

          {/* Action */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700 mb-1">Action</label>
              <select
                value={rule.action.type}
                onChange={(e) => setAction({ type: e.target.value as BotActionType })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-md bg-white text-xs"
              >
                <option value="transfer_to_agent">Transfer to agent queue</option>
                <option value="end_call">End call</option>
              </select>
            </div>
            {rule.action.type === 'transfer_to_agent' && (
              <div>
                <label className="block font-medium text-gray-700 mb-1">Queue key</label>
                <input
                  value={rule.action.queueKey ?? ''}
                  onChange={(e) => setAction({ queueKey: e.target.value.trim() })}
                  placeholder="e.g. support"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-md font-mono text-xs"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">Message spoken before action (optional)</label>
            <input
              value={rule.action.message ?? ''}
              onChange={(e) => setAction({ message: e.target.value })}
              placeholder="جاري تحويلك إلى أحد موظفينا، يرجى الانتظار."
              className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs"
              dir="auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Test panel ────────────────────────────────────────────────────────────────

function TestPanel() {
  const [intent, setIntent] = useState('complaint');
  const [transcript, setTranscript] = useState('');
  const [miscCount, setMiscCount] = useState(0);
  const [result, setResult] = useState<{ matched: boolean; action?: { type: string; queueKey?: string }; rule?: { name: string } } | null>(null);

  const test = useMutation({
    mutationFn: () =>
      evaluateBotRoutingRule({
        intent: intent || undefined,
        transcript: transcript || undefined,
        misunderstanding_count: miscCount,
      }),
    onSuccess: (r) => setResult(r),
    onError: () => toast.error('Evaluation failed'),
  });

  return (
    <div className="rounded-lg border border-dashed border-gray-200 p-4 space-y-3 bg-gray-50/50">
      <p className="text-xs font-semibold text-gray-700">Test rule evaluation</p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-gray-600 mb-1">Intent</label>
          <input
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white font-mono"
            placeholder="complaint"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-600 mb-1">Transcript excerpt</label>
          <input
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white"
            placeholder="e.g. I want an agent"
            dir="auto"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-600 mb-1">Misunderstandings</label>
          <input
            type="number"
            min={0}
            value={miscCount}
            onChange={(e) => setMiscCount(Number(e.target.value))}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white"
          />
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => test.mutate()}
        disabled={test.isPending}
        className="h-7 text-xs gap-1"
      >
        <Play className="w-3 h-3" />
        {test.isPending ? 'Evaluating…' : 'Run test'}
      </Button>
      {result && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-md px-3 py-2 text-xs',
            result.matched ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200',
          )}
        >
          {result.matched ? (
            <X className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
          )}
          <div>
            {result.matched ? (
              <>
                <span className="font-medium text-amber-800">Handoff triggered</span>
                {result.rule && <span className="text-amber-700"> — rule: {result.rule.name}</span>}
                {result.action?.type === 'transfer_to_agent' && (
                  <span className="text-amber-700"> → queue: {result.action.queueKey}</span>
                )}
                {result.action?.type === 'end_call' && (
                  <span className="text-amber-700"> → end call</span>
                )}
              </>
            ) : (
              <span className="text-green-800">No handoff — bot continues handling the call</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function BotRoutingRules() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<BotRoutingConfig>({
    queryKey: QUERY_KEY,
    queryFn: getBotRoutingRules,
    staleTime: 60_000,
  });

  // Local draft state (not persisted until Save)
  const [draft, setDraft] = useState<BotRoutingRule[] | null>(null);
  const rules: BotRoutingRule[] = draft ?? data?.rules ?? [];

  const isDirty = draft !== null;

  const save = useMutation({
    mutationFn: () =>
      saveBotRoutingRules({ name: data?.name ?? 'Default', isActive: data?.isActive ?? true, rules }),
    onSuccess: () => {
      toast.success('Bot routing rules saved');
      setDraft(null);
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: () => toast.error('Failed to save rules'),
  });

  const reset = useMutation({
    mutationFn: resetBotRoutingRules,
    onSuccess: (config) => {
      toast.success('Rules reset to defaults');
      setDraft(config.rules);
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: () => toast.error('Reset failed'),
  });

  const updateRule = useCallback((idx: number, updated: BotRoutingRule) => {
    setDraft((prev) => {
      const list = prev ?? (data?.rules ?? []);
      return list.map((r, i) => (i === idx ? updated : r));
    });
  }, [data]);

  const deleteRule = useCallback((idx: number) => {
    setDraft((prev) => {
      const list = prev ?? (data?.rules ?? []);
      return list.filter((_, i) => i !== idx);
    });
  }, [data]);

  const addRule = () => {
    setDraft((prev) => [...(prev ?? (data?.rules ?? [])), blankRule()]);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Bot Routing Rules</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rules are evaluated top-to-bottom by priority. First match triggers a handoff.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            className="h-7 text-xs text-muted-foreground gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Defaults
          </Button>
          {isDirty && (
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="h-7 text-xs bg-brand-primary hover:bg-brand-primary/90"
            >
              {save.isPending ? 'Saving…' : 'Save rules'}
            </Button>
          )}
        </div>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-4 text-center">
          No rules configured. Add a rule or reset to defaults.
        </p>
      ) : (
        <div className="space-y-2">
          {[...rules]
            .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
            .map((rule, displayIdx) => {
              // find original index for mutations
              const origIdx = rules.indexOf(rule);
              return (
                <RuleEditor
                  key={rule.id}
                  rule={rule}
                  onUpdate={(r) => updateRule(origIdx, r)}
                  onDelete={() => deleteRule(origIdx)}
                />
              );
            })}
        </div>
      )}

      {/* Add rule */}
      <Button
        size="sm"
        variant="outline"
        onClick={addRule}
        className="h-7 text-xs gap-1"
      >
        <Plus className="w-3 h-3" />
        Add rule
      </Button>

      {/* Test panel */}
      <TestPanel />
    </div>
  );
}
