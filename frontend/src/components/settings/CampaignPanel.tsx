'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Pause, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { bnFetch } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

interface Campaign {
  id: string;
  name: string;
  type: 'sms' | 'email' | 'voice';
  status: 'draft' | 'running' | 'paused' | 'completed';
  targets: { phone?: string; email?: string; name?: string }[];
  messageTemplate: string;
  createdAt: string;
  sentCount: number;
  failedCount: number;
}

const STATUS_STYLES: Record<Campaign['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  running: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
};

async function listCampaigns(): Promise<Campaign[]> {
  const res = await bnFetch<{ data: Campaign[] }>('calls', '/v1/campaigns');
  return res.data ?? [];
}

async function createCampaign(payload: Partial<Campaign>): Promise<Campaign> {
  const res = await bnFetch<{ data: Campaign }>('calls', '/v1/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

async function startCampaign(id: string): Promise<Campaign> {
  const res = await bnFetch<{ data: Campaign }>('calls', `/v1/campaigns/${id}/start`, { method: 'POST' });
  return res.data;
}

async function pauseCampaign(id: string): Promise<Campaign> {
  const res = await bnFetch<{ data: Campaign }>('calls', `/v1/campaigns/${id}/pause`, { method: 'POST' });
  return res.data;
}

import { useTenantId } from '@/lib/hooks/useTenantScope';

export function CampaignPanel() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', type: 'sms' as Campaign['type'], messageTemplate: '' });
  const [showForm, setShowForm] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns', tenantId],
    queryFn: listCampaigns,
  });

  const create = useMutation({
    mutationFn: () => createCampaign(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns', tenantId] }); setShowForm(false); setForm({ name: '', type: 'sms', messageTemplate: '' }); },
    onError: () => toast.error('Failed to create campaign. Please try again.'),
  });

  const start = useMutation({
    mutationFn: startCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns', tenantId] }),
    onError: () => toast.error('Failed to start campaign.'),
  });

  const pause = useMutation({
    mutationFn: pauseCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns', tenantId] }),
    onError: () => toast.error('Failed to pause campaign.'),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Outbound Campaigns</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Automated SMS, email, and voice campaigns</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          <Plus className="w-4 h-4 me-1" /> New Campaign
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
          <h3 className="text-sm font-medium">New campaign</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Campaign name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as Campaign['type'] }))}
              className="text-sm border border-gray-200 rounded-md px-2 bg-white"
            >
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="voice">Voice</option>
            </select>
          </div>
          <textarea
            placeholder="Message template (use {{name}} for contact name)"
            value={form.messageTemplate}
            onChange={e => setForm(f => ({ ...f, messageTemplate: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 h-20 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Create</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {campaigns.map(c => (
          <div key={c.id} className="border rounded-lg p-4 bg-white flex items-center gap-4">
            <Megaphone className="w-5 h-5 text-brand-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.type.toUpperCase()} · {c.targets.length} targets · {c.sentCount} sent / {c.failedCount} failed</p>
            </div>
            <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', STATUS_STYLES[c.status])}>
              {c.status}
            </span>
            <div className="flex gap-1">
              {c.status === 'draft' || c.status === 'paused' ? (
                <button type="button" onClick={() => start.mutate(c.id)} className="p-1.5 rounded hover:bg-green-50 text-green-600">
                  <Play className="w-4 h-4" />
                </button>
              ) : c.status === 'running' ? (
                <button type="button" onClick={() => pause.mutate(c.id)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600">
                  <Pause className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {!isLoading && campaigns.length === 0 && (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        )}
      </div>
    </div>
  );
}
