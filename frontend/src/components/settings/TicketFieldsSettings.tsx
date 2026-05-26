'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import {
  listTicketFields,
  createTicketField,
  deleteTicketField,
  type TicketField,
} from '@/lib/api/ticketFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const FIELD_TYPES = ['text', 'number', 'boolean', 'select', 'date'] as const;

export function TicketFieldsSettings() {
  const qc = useQueryClient();
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['ticket-fields'],
    queryFn: listTicketFields,
  });

  const [form, setForm] = useState({
    field_key: '',
    label: '',
    field_type: 'text' as TicketField['field_type'],
    required: false,
  });
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: () =>
      createTicketField({ ...form, sort_order: fields.length }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-fields'] });
      setForm({ field_key: '', label: '', field_type: 'text', required: false });
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteTicketField,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-fields'] }),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">Custom Ticket Fields</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add custom fields that appear on every ticket form.
        </p>
      </div>

      <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
        <h3 className="text-sm font-medium">Add new field</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="Field key (e.g. order_id)"
            value={form.field_key}
            onChange={e =>
              setForm(f => ({
                ...f,
                field_key: e.target.value.toLowerCase().replace(/\s+/g, '_'),
              }))
            }
          />
          <Input
            placeholder="Display label"
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={form.field_type}
            onChange={e =>
              setForm(f => ({
                ...f,
                field_type: e.target.value as TicketField['field_type'],
              }))
            }
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
          >
            {FIELD_TYPES.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.required}
              onChange={e => setForm(f => ({ ...f, required: e.target.checked }))}
            />
            Required
          </label>
          <Button
            size="sm"
            onClick={() => create.mutate()}
            disabled={!form.field_key || !form.label || create.isPending}
            className="ms-auto"
          >
            <Plus className="w-4 h-4 me-1" />
            Add Field
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {fields.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">No custom fields yet.</p>
        )}
        {fields.map(f => (
          <div
            key={f.id}
            className="flex items-center justify-between border rounded-md px-3 py-2 bg-background"
          >
            <div>
              <span className="text-sm font-medium">{f.label}</span>
              <span className="text-xs text-muted-foreground ms-2">
                {f.field_key} · {f.field_type}
                {f.required && ' · required'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => remove.mutate(f.id)}
              className="text-muted-foreground hover:text-destructive p-1 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
