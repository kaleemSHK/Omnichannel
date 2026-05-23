'use client';

import { Plus, X } from 'lucide-react';
import {
  ESCALATION_FIELDS,
  ESCALATION_OPERATORS,
  type EscalationField,
  type EscalationOperator,
} from '@/lib/utils/escalation';
import { cn } from '@/lib/utils/cn';
import type { EscalationCondition } from '@/types';

export interface ConditionBuilderValue {
  conditions: EscalationCondition[];
  logic: 'and' | 'or';
}

interface Props {
  value: ConditionBuilderValue;
  onChange: (value: ConditionBuilderValue) => void;
}

export function ConditionBuilder({ value, onChange }: Props) {
  const addRow = () => {
    onChange({
      ...value,
      conditions: [...value.conditions, { field: 'sla_tier', operator: '=', value: '' }],
    });
  };

  const updateRow = (index: number, patch: Partial<EscalationCondition>) => {
    const conditions = value.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c));
    onChange({ ...value, conditions });
  };

  const removeRow = (index: number) => {
    onChange({ ...value, conditions: value.conditions.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      {value.conditions.map((row, index) => (
        <div key={index} className="space-y-2">
          {index > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...value, logic: 'and' })}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  value.logic === 'and' ? 'bg-gray-200 text-gray-800' : 'bg-gray-50 text-gray-500',
                )}
              >
                AND
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, logic: 'or' })}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  value.logic === 'or' ? 'bg-gray-200 text-gray-800' : 'bg-gray-50 text-gray-500',
                )}
              >
                OR
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={row.field}
              onChange={e => updateRow(index, { field: e.target.value })}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
            >
              {ESCALATION_FIELDS.map(f => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select
              value={row.operator}
              onChange={e => updateRow(index, { operator: e.target.value as EscalationOperator })}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white w-14"
            >
              {ESCALATION_OPERATORS.map(op => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={String(row.value)}
              onChange={e =>
                updateRow(index, {
                  value: e.target.value,
                })
              }
              placeholder="value"
              className="flex-1 min-w-[120px] text-sm border border-gray-200 rounded-md px-2 py-1.5"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="p-1 text-gray-400 hover:text-red-500"
              aria-label="Remove condition"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1 text-sm text-[#0B5FFF] hover:underline"
      >
        <Plus size={14} />
        Add condition
      </button>
    </div>
  );
}
