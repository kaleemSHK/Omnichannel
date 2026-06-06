'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listPolicies, createPolicy, updatePolicy, deletePolicy } from '@/lib/api/sla';
import type { SLAPolicy } from '@/types';
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
import { ShieldAlert, Pencil, Trash2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useAuthStore } from '@/lib/store/auth';

// ─── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_POLICIES: SLAPolicy[] = [
  {
    id: 'p1', tenantId: '1', name: 'Gold SLA',
    tier: 'gold', firstResponseMinutes: 5, resolutionHours: 4, escalationHours: 2,
  },
  {
    id: 'p2', tenantId: '1', name: 'Standard SLA',
    tier: 'silver', firstResponseMinutes: 15, resolutionHours: 24, escalationHours: 8,
  },
  {
    id: 'p3', tenantId: '1', name: 'Basic SLA',
    tier: 'bronze', firstResponseMinutes: 60, resolutionHours: 72, escalationHours: 24,
  },
];

const TIER_STYLES: Record<string, string> = {
  gold:   'bg-amber-50 text-amber-700 border-amber-200',
  silver: 'bg-gray-50 text-gray-700 border-gray-200',
  bronze: 'bg-orange-50 text-orange-700 border-orange-200',
  custom: 'bg-purple-50 text-purple-700 border-purple-200',
};

// ─── Form ──────────────────────────────────────────────────────────────────────

interface PolicyForm {
  name: string;
  tier: SLAPolicy['tier'];
  firstResponseMinutes: number;
  resolutionHours: number;
  escalationHours: number;
}

const DEFAULT_FORM: PolicyForm = {
  name: '',
  tier: 'silver',
  firstResponseMinutes: 15,
  resolutionHours: 24,
  escalationHours: 8,
};

function PolicySheet({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: PolicyForm;
  onSave: (f: PolicyForm) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<PolicyForm>(initial);
  const set = <K extends keyof PolicyForm>(k: K, v: PolicyForm[K]) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Sheet open={open} onClose={onClose} title={initial.name ? `Edit — ${initial.name}` : 'New SLA Policy'}>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Policy name</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Gold SLA" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Tier</Label>
          <Select value={form.tier} onValueChange={v => set('tier', v as PolicyForm['tier'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gold">Gold — highest priority</SelectItem>
              <SelectItem value="silver">Silver — standard</SelectItem>
              <SelectItem value="bronze">Bronze — basic</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-gray-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> SLA Targets
          </p>

          {[
            { k: 'firstResponseMinutes' as const, label: 'First response (minutes)', min: 1, max: 1440 },
            { k: 'escalationHours' as const, label: 'Escalation threshold (hours)', min: 1, max: 168 },
            { k: 'resolutionHours' as const, label: 'Resolution target (hours)', min: 1, max: 720 },
          ].map(({ k, label, min, max }) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={min}
                  max={max}
                  value={form[k]}
                  onChange={e => set(k, Number(e.target.value))}
                  className="w-24 h-8 text-sm"
                />
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={form[k]}
                  onChange={e => set(k, Number(e.target.value))}
                  className="flex-1 accent-brand-primary"
                />
              </div>
            </div>
          ))}
        </div>

        <Button
          className="w-full bg-brand-primary hover:bg-brand-primary/90"
          disabled={!form.name || saving}
          onClick={() => onSave(form)}
        >
          {saving ? 'Saving…' : initial.name ? 'Save changes' : 'Create policy'}
        </Button>
      </div>
    </Sheet>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────────

export function SLAPoliciesSection() {
  const qc = useQueryClient();
  const tenantId = useAuthStore(s => s.user?.tenantId ?? '');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SLAPolicy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SLAPolicy | null>(null);

  const { data: policies = [], isLoading, isError, error } = useQuery({
    queryKey: ['sla-policies', tenantId],
    enabled: Boolean(tenantId) || isDemoDataEnabled(),
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_POLICIES;
      return listPolicies();
    },
  });

  const formInitial: PolicyForm = editTarget
    ? {
        name: editTarget.name,
        tier: editTarget.tier,
        firstResponseMinutes: editTarget.firstResponseMinutes,
        resolutionHours: editTarget.resolutionHours,
        escalationHours: editTarget.escalationHours,
      }
    : DEFAULT_FORM;

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (f: PolicyForm) => editTarget
      ? updatePolicy(editTarget.id, f)
      : createPolicy({ ...f, calendarId: undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla-policies'] });
      toast.success(editTarget ? 'Policy updated' : 'Policy created');
      setSheetOpen(false);
      setEditTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: () => deletePolicy(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla-policies'] });
      toast.success('Policy deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader
        title="SLA Policies"
        description="Define response and resolution time targets. Assign policies to contacts by tier."
        actionLabel="New policy"
        onAction={() => { setEditTarget(null); setSheetOpen(true); }}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : policies.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No SLA policies"
          description="Create a policy to track first-response and resolution targets."
          actionLabel="New policy"
          onAction={() => { setEditTarget(null); setSheetOpen(true); }}
        />
      ) : (
        <div className="space-y-2">
          {policies.map(p => (
            <div key={p.id} className="flex items-start gap-4 border rounded-xl px-4 py-3.5 bg-white hover:shadow-sm transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <Badge className={cn('text-[10px] border capitalize', TIER_STYLES[p.tier])} variant="outline">
                    {p.tier}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    First response: <strong className="text-gray-700">{p.firstResponseMinutes}m</strong>
                  </span>
                  <span>Escalation: <strong className="text-gray-700">{p.escalationHours}h</strong></span>
                  <span>Resolution: <strong className="text-gray-700">{p.resolutionHours}h</strong></span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => { setEditTarget(p); setSheetOpen(true); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(p)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PolicySheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditTarget(null); }}
        initial={formInitial}
        onSave={save}
        saving={saving}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        description="Active SLA instances using this policy will continue until resolved. New conversations won't be assigned this policy."
        isPending={deleting}
        onConfirm={() => remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
