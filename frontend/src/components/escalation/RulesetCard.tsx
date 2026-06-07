'use client';

import { Copy, History, Pencil, Trash2 } from 'lucide-react';
import { ActionsList } from '@/components/escalation/ActionsList';
import { cn } from '@/lib/utils/cn';
import { ESCALATION_TRIGGERS, type EscalationRuleView } from '@/lib/utils/escalation';

interface Props {
  rule: EscalationRuleView;
  onToggle: (enabled: boolean) => void;
  onDuplicate: () => void;
  onEdit?: () => void;
  onHistory?: () => void;
  onDelete?: () => void;
}

function triggerLabel(value: string) {
  return ESCALATION_TRIGGERS.find(t => t.value === value)?.label ?? value;
}

function formatLastRun(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function RulesetCard({ rule, onToggle, onDuplicate, onEdit, onHistory, onDelete }: Props) {
  const active = rule.isActive && rule.rulesetEnabled;
  const lastRun = formatLastRun(rule.lastTriggeredAt);

  return (
    <article
      className={cn(
        'bn-card p-4 space-y-4 transition-opacity',
        !active && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900">{rule.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Trigger: {triggerLabel(rule.trigger)}
            {typeof rule.runCount === 'number' && (
              <> · {rule.runCount} run{rule.runCount === 1 ? '' : 's'}</>
            )}
            {lastRun && <> · Last fired {lastRun}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => onToggle(!rule.isActive)}
            className={cn(
              'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              active
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-gray-100 text-gray-600 border-gray-200',
            )}
          >
            <span
              className={cn(
                'w-8 h-4 rounded-full relative transition-colors',
                active ? 'bg-green-500' : 'bg-gray-300',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform',
                  active ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </span>
            {active ? 'Active' : 'Inactive'}
          </button>
          {onHistory && !rule.id.includes('-placeholder') && (
            <button
              type="button"
              onClick={onHistory}
              className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
            >
              <History size={12} />
              History
            </button>
          )}
          {onEdit && !rule.id.includes('-placeholder') && (
            <button
              type="button"
              onClick={onEdit}
              className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
          {onDelete && !rule.id.includes('-placeholder') && (
            <button
              type="button"
              onClick={onDelete}
              className="text-xs text-gray-500 hover:text-red-600 inline-flex items-center gap-1"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onDuplicate}
            className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
          >
            <Copy size={12} />
            Duplicate
          </button>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold tracking-wide text-gray-400 mb-2">
          CONDITIONS · {rule.conditionLogic === 'or' ? 'ANY MATCH' : 'ALL MATCH'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {rule.conditions.length === 0 ? (
            <span className="text-sm text-gray-400">No conditions (always match)</span>
          ) : (
            rule.conditions.map((c, i) => (
              <span key={`${c.field}-${i}`} className="contents">
                {i > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                    {rule.conditionLogic.toUpperCase()}
                  </span>
                )}
                <span className="inline-flex items-center px-3 py-1 rounded-full border border-gray-200 text-sm text-gray-800 bg-white">
                  {c.field} {c.operator} {String(c.value)}
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold tracking-wide text-gray-400 mb-2">ACTIONS</p>
        <ActionsList actions={rule.actions} />
      </div>
    </article>
  );
}
