'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/Dialog';
import { ConditionBuilder, type ConditionBuilderValue } from '@/components/escalation/ConditionBuilder';
import { useCreateEscalationRule } from '@/lib/hooks/useEscalation';
import type { UiActionRow, UiActionType } from '@/lib/utils/escalation';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ACTION_TYPES: { value: UiActionType; label: string }[] = [
  { value: 'reassign', label: 'Reassign' },
  { value: 'notify', label: 'Notify' },
  { value: 'label', label: 'Label' },
  { value: 'message', label: 'Message' },
  { value: 'webhook', label: 'Webhook' },
];

const ACTION_PLACEHOLDER: Record<UiActionType, string> = {
  reassign: 'team:supervisors or agent:123',
  notify: '#sla-alerts',
  label: 'urgent',
  message: 'Internal note text',
  webhook: 'https://hooks.example.com/escalation',
};

export function NewRuleModal({ open, onClose }: Props) {
  const create = useCreateEscalationRule();
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [conditions, setConditions] = useState<ConditionBuilderValue>({
    conditions: [{ field: 'sla_tier', operator: '=', value: 'gold' }],
    logic: 'and',
  });
  const [actions, setActions] = useState<UiActionRow[]>([
    { type: 'reassign', target: 'team:supervisors' },
  ]);

  const addAction = () => setActions(prev => [...prev, { type: 'notify', target: '' }]);
  const updateAction = (i: number, patch: Partial<UiActionRow>) => {
    setActions(prev => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };
  const removeAction = (i: number) => setActions(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    if (!actions.some(a => a.target.trim())) {
      toast.error('Add at least one action with a target');
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        enabled,
        conditions: conditions.conditions,
        conditionLogic: conditions.logic,
        actions,
      });
      toast.success('Rule created');
      setName('');
      setEnabled(true);
      setConditions({
        conditions: [{ field: 'sla_tier', operator: '=', value: 'gold' }],
        logic: 'and',
      });
      setActions([{ type: 'reassign', target: 'team:supervisors' }]);
      onClose();
    } catch {
      toast.error('Could not save rule');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New escalation rule" className="max-w-xl">
      <div className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Rule name</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            placeholder="e.g. Gold SLA breach"
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Enabled</span>
        </label>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Conditions</p>
          <ConditionBuilder value={conditions} onChange={setConditions} />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Actions</p>
          <div className="space-y-2">
            {actions.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={row.type}
                  onChange={e => updateAction(i, { type: e.target.value as UiActionType })}
                  className="text-sm border border-gray-200 rounded-md px-2 py-1.5"
                >
                  {ACTION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  value={row.target}
                  onChange={e => updateAction(i, { target: e.target.value })}
                  placeholder={ACTION_PLACEHOLDER[row.type]}
                  className="flex-1 text-sm border border-gray-200 rounded-md px-2 py-1.5"
                />
                <button
                  type="button"
                  onClick={() => removeAction(i)}
                  className="p-1 text-gray-400 hover:text-red-500"
                  aria-label="Remove action"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addAction}
            className="mt-2 inline-flex items-center gap-1 text-sm text-[#0B5FFF]"
          >
            <Plus size={14} />
            Add action
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={create.isPending}
            className="px-4 py-2 text-sm bg-[#0B5FFF] text-white rounded-md hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            Save rule
          </button>
        </div>
      </div>
    </Dialog>
  );
}
