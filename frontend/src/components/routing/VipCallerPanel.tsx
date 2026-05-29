'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Trash2 } from 'lucide-react';
import { bnFetch } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

async function getVipCallers(): Promise<string[]> {
  const res = await bnFetch<{ data: { phones: string[] } }>('routing', '/v1/vip');
  return res.data?.phones ?? [];
}

async function addVip(phone: string): Promise<void> {
  await bnFetch<void>('routing', '/v1/vip', { method: 'POST', body: JSON.stringify({ phone }) });
}

async function removeVip(phone: string): Promise<void> {
  await bnFetch<void>('routing', `/v1/vip/${encodeURIComponent(phone)}`, { method: 'DELETE' });
}

export function VipCallerPanel() {
  const qc = useQueryClient();
  const [phone, setPhone] = useState('');

  const { data: phones = [] } = useQuery({ queryKey: ['vip-callers'], queryFn: getVipCallers });

  const add = useMutation({
    mutationFn: () => addVip(phone),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vip-callers'] }); setPhone(''); toast.success('VIP caller added'); },
    onError: () => toast.error('Failed to add VIP caller'),
  });

  const remove = useMutation({
    mutationFn: removeVip,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vip-callers'] }); toast.success('Removed'); },
  });

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" /> VIP Callers
        </h3>
        <p className="text-xs text-muted-foreground mt-1">VIP callers skip the queue and route directly to senior agents</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="+96891234567"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="flex-1"
        />
        <Button size="sm" onClick={() => add.mutate()} disabled={!phone || add.isPending}>
          <Plus className="w-4 h-4 me-1" /> Add
        </Button>
      </div>

      <ul className="space-y-1">
        {phones.map(p => (
          <li key={p} className="flex items-center justify-between border rounded-md px-3 py-2 bg-white text-sm">
            <span className="font-mono">{p}</span>
            <button type="button" onClick={() => remove.mutate(p)} className="text-muted-foreground hover:text-destructive p-1 rounded">
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
        {!phones.length && <li className="text-sm text-muted-foreground">No VIP callers yet.</li>}
      </ul>
    </div>
  );
}
