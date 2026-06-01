'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listQueues, createQueue, getQueue } from '@/lib/api/routing';
import { bnFetch } from '@/lib/api/client';
import type { Queue } from '@/types';
import { SectionHeader } from './shared/SectionHeader';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { EmptyState } from './shared/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-radix';
import { Layers, Pencil, Trash2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ─── Demo fallback ─────────────────────────────────────────────────────────────

const DEMO_QUEUES: Queue[] = [
  {
    id: 'q1', tenantId: '1', queueKey: 'support', name: 'Support',
    skills: [{ skill: 'support', required: true }],
    selectionAlgorithm: 'round_robin', maxWaitSec: 300, maxDepth: 50,
  },
  {
    id: 'q2', tenantId: '1', queueKey: 'sales', name: 'Sales',
    skills: [{ skill: 'sales', required: true }],
    selectionAlgorithm: 'longest_idle', maxWaitSec: 180, maxDepth: 30,
  },
  {
    id: 'q3', tenantId: '1', queueKey: 'billing', name: 'Billing',
    skills: [{ skill: 'billing', required: true }],
    selectionAlgorithm: 'best_match', maxWaitSec: 240, maxDepth: 40,
  },
];

const ALGO_LABELS: Record<string, string> = {
  round_robin: 'Round Robin',
  longest_idle: 'Longest Idle',
  best_match: 'Best Match (skill-weighted)',
};

// ─── Queue form ────────────────────────────────────────────────────────────────

interface QueueForm {
  name: string;
  queueKey: string;
  selectionAlgorithm: 'round_robin' | 'longest_idle' | 'best_match';
  maxWaitSec: number;
  maxDepth: number;
  skills: Array<{ skill: string; required: boolean }>;
}

const DEFAULT_FORM: QueueForm = {
  name: '',
  queueKey: '',
  selectionAlgorithm: 'round_robin',
  maxWaitSec: 300,
  maxDepth: 50,
  skills: [],
};

function QueueFormSheet({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: QueueForm;
  onSave: (f: QueueForm) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<QueueForm>(initial);
  const [newSkill, setNewSkill] = useState('');
  const [newReq, setNewReq] = useState(true);

  // Reset when opening
  useState(() => { setForm(initial); });

  const set = <K extends keyof QueueForm>(k: K, v: QueueForm[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const addSkill = () => {
    const s = newSkill.trim().toLowerCase();
    if (!s || form.skills.some(x => x.skill === s)) return;
    set('skills', [...form.skills, { skill: s, required: newReq }]);
    setNewSkill('');
  };

  return (
    <Sheet open={open} onClose={onClose} title={initial.name ? `Edit — ${initial.name}` : 'New Queue'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Display name</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Support" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Queue key (ID)</Label>
            <Input
              value={form.queueKey}
              onChange={e => set('queueKey', e.target.value.toLowerCase().replace(/\s/g, '_'))}
              placeholder="support"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Selection algorithm</Label>
          <Select
            value={form.selectionAlgorithm}
            onValueChange={v => set('selectionAlgorithm', v as QueueForm['selectionAlgorithm'])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="round_robin">Round Robin — rotate agents evenly</SelectItem>
              <SelectItem value="longest_idle">Longest Idle — pick least-busy agent</SelectItem>
              <SelectItem value="best_match">Best Match — skill-weighted scoring</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Max wait (seconds)</Label>
            <Input
              type="number"
              min={30}
              max={3600}
              value={form.maxWaitSec}
              onChange={e => set('maxWaitSec', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max queue depth</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={form.maxDepth}
              onChange={e => set('maxDepth', Number(e.target.value))}
            />
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-2">
          <Label className="text-xs">Required skills</Label>
          {form.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {form.skills.map(s => (
                <span
                  key={s.skill}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                    s.required ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600',
                  )}
                >
                  {s.skill}
                  <button type="button" onClick={() => set('skills', form.skills.filter(x => x.skill !== s.skill))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <Input
              value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSkill()}
              placeholder="skill name"
              className="font-mono text-xs h-8 flex-1"
            />
            <button
              type="button"
              onClick={() => setNewReq(p => !p)}
              className={cn(
                'text-[10px] font-bold px-2 rounded h-8 shrink-0',
                newReq ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500',
              )}
            >
              {newReq ? 'REQ' : 'OPT'}
            </button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              onClick={addSkill}
              disabled={!newSkill.trim()}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <Button
          className="w-full bg-brand-primary hover:bg-brand-primary/90"
          disabled={!form.name || !form.queueKey || saving}
          onClick={() => onSave(form)}
        >
          {saving ? 'Saving…' : initial.name ? 'Save changes' : 'Create queue'}
        </Button>
      </div>
    </Sheet>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────────

async function deleteQueueById(id: string): Promise<void> {
  await bnFetch<void>('routing', `/v1/queues/${id}`, { method: 'DELETE' });
}

async function updateQueueById(id: string, data: Partial<Queue>): Promise<Queue> {
  const res = await bnFetch<{ data: Queue }>('routing', `/v1/queues/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export function QueuesSection() {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Queue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Queue | null>(null);

  const { data: queues = [], isLoading } = useQuery({
    queryKey: ['queues-settings'],
    queryFn: async () => {
      try { return await listQueues(); }
      catch { return DEMO_QUEUES; }
    },
  });

  const formInitial: QueueForm = editTarget
    ? {
        name: editTarget.name,
        queueKey: editTarget.queueKey,
        selectionAlgorithm: editTarget.selectionAlgorithm as QueueForm['selectionAlgorithm'],
        maxWaitSec: editTarget.maxWaitSec,
        maxDepth: editTarget.maxDepth,
        skills: editTarget.skills as QueueForm['skills'],
      }
    : DEFAULT_FORM;

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: async (f: QueueForm) => {
      if (editTarget) {
        return updateQueueById(editTarget.id, f);
      }
      return createQueue(f);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues-settings'] });
      toast.success(editTarget ? 'Queue updated' : 'Queue created');
      setSheetOpen(false);
      setEditTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: () => deleteQueueById(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues-settings'] });
      toast.success('Queue deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader
        title="Queues"
        description="Configure ACD queues — routing algorithm, skills requirements, capacity limits."
        actionLabel="New queue"
        onAction={() => { setEditTarget(null); setSheetOpen(true); }}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : queues.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No queues yet"
          description="Create your first queue to start routing calls."
          actionLabel="New queue"
          onAction={() => { setEditTarget(null); setSheetOpen(true); }}
        />
      ) : (
        <div className="space-y-2">
          {queues.map(q => (
            <div key={q.id} className="flex items-center gap-4 border rounded-xl px-4 py-3 bg-white hover:shadow-sm transition-shadow">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{q.name}</p>
                  <code className="text-[10px] font-mono text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">{q.queueKey}</code>
                  <Badge variant="outline" className="text-[10px]">{ALGO_LABELS[q.selectionAlgorithm] ?? q.selectionAlgorithm}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">Max wait: {q.maxWaitSec}s</span>
                  <span className="text-[11px] text-muted-foreground">Depth: {q.maxDepth}</span>
                  {q.skills?.length > 0 && (
                    <div className="flex gap-1">
                      {(q.skills as Array<{ skill: string; required: boolean }>).map(s => (
                        <span key={s.skill} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {s.skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => { setEditTarget(q); setSheetOpen(true); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(q)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <QueueFormSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditTarget(null); }}
        initial={formInitial}
        onSave={save}
        saving={saving}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete queue "${deleteTarget?.name}"?`}
        description="Calls currently in this queue will be dropped. Active calls are not affected."
        isPending={deleting}
        onConfirm={() => remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
