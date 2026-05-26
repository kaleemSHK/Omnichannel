'use client';

/**
 * AlertsPanel — P1 Platform Admin
 * Create / edit / delete / toggle alert rules for the platform.
 */

import { useState } from 'react';
import { Loader2, Plus, Trash2, Bell, BellOff } from 'lucide-react';
import { useAlerts, useCreateAlert, useDeleteAlert, useUpdateAlert } from '@/lib/hooks/usePlatform';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { AlertRule } from '@/lib/api/platform';

const CONDITION_OPTIONS = [
  { value: 'sla_breach_rate > threshold',  label: 'SLA breach rate exceeds threshold %' },
  { value: 'service_status == down',        label: 'Any service goes down' },
  { value: 'storage_used_pct > threshold',  label: 'Storage usage exceeds threshold %' },
  { value: 'voicebot_escalation_rate > threshold', label: 'Voicebot escalation rate exceeds threshold %' },
  { value: 'error_rate > threshold',        label: 'Gateway error rate exceeds threshold %' },
];

const CHANNEL_OPTIONS = ['email', 'slack', 'pagerduty', 'webhook'];

function CreateAlertForm({ onClose }: { onClose: () => void }) {
  const create = useCreateAlert();
  const [name, setName]           = useState('');
  const [condition, setCondition] = useState(CONDITION_OPTIONS[0]!.value);
  const [threshold, setThreshold] = useState<string>('20');
  const [channels, setChannels]   = useState<string[]>(['email']);

  const hasThreshold = condition.includes('threshold');

  const toggleChannel = (ch: string) =>
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      {
        name: name.trim(),
        condition,
        threshold: hasThreshold ? Number(threshold) : undefined,
        channels,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <form onSubmit={submit} className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-blue-900">New alert rule</p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Rule name *</label>
          <input
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. SLA breach spike"
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Condition</label>
          <select
            value={condition}
            onChange={e => setCondition(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CONDITION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {hasThreshold && (
        <div className="max-w-[200px]">
          <label className="text-xs text-gray-600 mb-1 block">Threshold (%)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div>
        <label className="text-xs text-gray-600 mb-1 block">Notification channels</label>
        <div className="flex gap-2 flex-wrap">
          {CHANNEL_OPTIONS.map(ch => (
            <button
              key={ch}
              type="button"
              onClick={() => toggleChannel(ch)}
              className={cn(
                'px-3 py-1 rounded-full text-xs border transition-colors capitalize',
                channels.includes(ch)
                  ? 'bg-[#0B5FFF] text-white border-[#0B5FFF]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
              )}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
          Create rule
        </Button>
      </div>
    </form>
  );
}

function AlertRow({ rule }: { rule: AlertRule }) {
  const del    = useDeleteAlert();
  const update = useUpdateAlert();

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 py-3 px-4 border-b border-gray-100 last:border-0',
      !rule.enabled && 'opacity-60',
    )}>
      <div className="flex items-center gap-2.5 min-w-0">
        <Bell size={14} className={rule.enabled ? 'text-blue-500' : 'text-gray-400'} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{rule.name}</p>
          <p className="text-xs text-gray-500 truncate">
            {CONDITION_OPTIONS.find(o => o.value === rule.condition)?.label ?? rule.condition}
            {rule.threshold !== null && ` · >${rule.threshold}%`}
          </p>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {rule.channels.map(ch => (
              <span key={ch} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">
                {ch}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Enable/disable toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={rule.enabled}
          onClick={() => update.mutate({ id: rule.id, data: { enabled: !rule.enabled } })}
          disabled={update.isPending}
          title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          className={cn(
            'relative w-9 h-5 rounded-full transition-colors',
            rule.enabled ? 'bg-[#0B5FFF]' : 'bg-gray-300',
          )}
        >
          <span className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            rule.enabled ? 'translate-x-4' : 'translate-x-0.5',
          )} />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => del.mutate(rule.id)}
          disabled={del.isPending}
          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
          title="Delete rule"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function AlertsPanel() {
  const { data: alerts = [], isLoading } = useAlerts();
  const [creating, setCreating] = useState(false);

  const active   = alerts.filter(a => a.enabled).length;
  const inactive = alerts.length - active;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Alert rules</h3>
          {!isLoading && (
            <p className="text-xs text-gray-500 mt-0.5">
              {active} active · {inactive} disabled
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setCreating(true)} disabled={creating}>
          <Plus size={14} className="mr-1" />
          New rule
        </Button>
      </div>

      {creating && <CreateAlertForm onClose={() => setCreating(false)} />}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="animate-spin text-gray-400" size={22} />
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-12 text-center">
            <BellOff size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No alert rules configured.</p>
            <p className="text-xs text-gray-400 mt-1">Click <strong>New rule</strong> to create your first alert.</p>
          </div>
        ) : (
          alerts.map(a => <AlertRow key={a.id} rule={a} />)
        )}
      </div>
    </div>
  );
}
