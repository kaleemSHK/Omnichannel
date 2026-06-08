'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import {
  listTicketFields,
  createTicketField,
  deleteTicketField,
  refreshTicketFieldsSession,
  isTicketFieldsGatewayError,
  type TicketField,
} from '@/lib/api/ticketFields';
import { isGatewayQueryEnabled } from '@/lib/demo/config';
import { useTenantId } from '@/lib/hooks/useTenantScope';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const FIELD_TYPES = ['text', 'number', 'boolean', 'select', 'date'] as const;

export function TicketFieldsSettings() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const gatewayReady = isGatewayQueryEnabled();

  const { data: fields = [], isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['ticket-fields', tenantId],
    queryFn: listTicketFields,
    enabled: gatewayReady,
    retry: 1,
  });

  const [form, setForm] = useState({
    field_key: '',
    label: '',
    field_type: 'text' as TicketField['field_type'],
    required: false,
  });
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function retryGateway() {
    setRefreshing(true);
    setError('');
    try {
      await refreshTicketFieldsSession();
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore BlinkOne session');
    } finally {
      setRefreshing(false);
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!gatewayReady) {
        await refreshTicketFieldsSession();
      }
      return createTicketField({ ...form, sort_order: fields.length });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-fields', tenantId] });
      setForm({ field_key: '', label: '', field_type: 'text', required: false });
      setError('');
    },
    onError: (e: Error) => {
      setError(
        isTicketFieldsGatewayError(e)
          ? 'BlinkOne session unavailable. Use “Reconnect” below or sign out and sign in again.'
          : e.message,
      );
    },
  });

  const remove = useMutation({
    mutationFn: deleteTicketField,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-fields', tenantId] }),
    onError: (e: Error) => setError(e.message),
  });

  const gatewayMessage =
    !gatewayReady
      ? 'Ticket fields use the BlinkOne gateway. Your session has no gateway token yet.'
      : loadError && isTicketFieldsGatewayError(loadError)
        ? (loadError as Error).message
        : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">Custom Ticket Fields</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add custom fields that appear on every ticket form.
        </p>
      </div>

      {gatewayMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center gap-3">
          <span className="flex-1 min-w-[200px]">{gatewayMessage}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={() => void retryGateway()}
          >
            <RefreshCw className={`w-4 h-4 me-1 ${refreshing ? 'animate-spin' : ''}`} />
            Reconnect
          </Button>
        </div>
      )}

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
        {isLoading && gatewayReady && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {fields.length === 0 && !isLoading && gatewayReady && !loadError && (
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
