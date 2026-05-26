'use client';

/**
 * PolicyFormModal — create or edit an SLA policy.
 * Used inside the SLAWorkspace Policies view.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreatePolicy, useUpdatePolicy } from '@/lib/hooks/useSla';
import type { SLAPolicy } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** If provided, pre-fills the form for editing */
  existing?: SLAPolicy | null;
}

const TIER_OPTIONS: SLAPolicy['tier'][] = ['gold', 'silver', 'bronze', 'custom'];

const TIER_DEFAULTS: Record<SLAPolicy['tier'], { firstResponseMinutes: number; resolutionHours: number; escalationHours: number }> = {
  gold:   { firstResponseMinutes: 15, resolutionHours: 4,  escalationHours: 2 },
  silver: { firstResponseMinutes: 30, resolutionHours: 8,  escalationHours: 4 },
  bronze: { firstResponseMinutes: 60, resolutionHours: 24, escalationHours: 8 },
  custom: { firstResponseMinutes: 60, resolutionHours: 24, escalationHours: 8 },
};

const TIER_LABEL: Record<SLAPolicy['tier'], string> = {
  gold: '🥇 Gold', silver: '🥈 Silver', bronze: '🥉 Bronze', custom: 'Custom',
};

interface FormState {
  name: string;
  tier: SLAPolicy['tier'];
  firstResponseMinutes: string;
  resolutionHours: string;
  escalationHours: string;
}

function defaultState(existing?: SLAPolicy | null): FormState {
  if (existing) {
    return {
      name: existing.name,
      tier: existing.tier,
      firstResponseMinutes: String(existing.firstResponseMinutes),
      resolutionHours: String(existing.resolutionHours),
      escalationHours: String(existing.escalationHours),
    };
  }
  return {
    name: '',
    tier: 'silver',
    firstResponseMinutes: '30',
    resolutionHours: '8',
    escalationHours: '4',
  };
}

export function PolicyFormModal({ open, onClose, existing }: Props) {
  const createMut = useCreatePolicy();
  const updateMut = useUpdatePolicy();
  const isPending = createMut.isPending || updateMut.isPending;
  const isEdit = !!existing;

  const [form, setForm] = useState<FormState>(defaultState(existing));

  useEffect(() => {
    setForm(defaultState(existing));
  }, [existing, open]);

  function handleTierChange(tier: SLAPolicy['tier']) {
    const d = TIER_DEFAULTS[tier];
    setForm(f => ({
      ...f,
      tier,
      firstResponseMinutes: String(d.firstResponseMinutes),
      resolutionHours: String(d.resolutionHours),
      escalationHours: String(d.escalationHours),
    }));
  }

  function handleSubmit() {
    const payload = {
      name: form.name.trim(),
      tier: form.tier,
      firstResponseMinutes: Number(form.firstResponseMinutes),
      resolutionHours: Number(form.resolutionHours),
      escalationHours: Number(form.escalationHours),
    };

    if (!payload.name) return;

    if (isEdit && existing) {
      updateMut.mutate({ id: existing.id, data: payload }, { onSuccess: onClose });
    } else {
      createMut.mutate(payload, { onSuccess: onClose });
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit: ${existing?.name}` : 'New SLA policy'}
    >
      <div className="space-y-4">
        {/* Policy name */}
        <div className="space-y-1">
          <Label htmlFor="policy-name" className="text-xs">Policy name</Label>
          <Input
            id="policy-name"
            placeholder="e.g. Gold SLA – Enterprise"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>

        {/* Tier */}
        <div className="space-y-1">
          <Label className="text-xs">Tier</Label>
          <div className="grid grid-cols-2 gap-2">
            {TIER_OPTIONS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => handleTierChange(t)}
                className={`border rounded-md px-3 py-2 text-xs text-left transition-colors ${
                  form.tier === t
                    ? 'border-brand-primary bg-brand-primary/5 font-semibold'
                    : 'hover:bg-muted'
                }`}
              >
                {TIER_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {/* First response */}
        <div className="space-y-1">
          <Label htmlFor="first-response" className="text-xs">First response target (minutes)</Label>
          <Input
            id="first-response"
            type="number"
            min={1}
            value={form.firstResponseMinutes}
            onChange={e => setForm(f => ({ ...f, firstResponseMinutes: e.target.value }))}
          />
        </div>

        {/* Resolution */}
        <div className="space-y-1">
          <Label htmlFor="resolution" className="text-xs">Resolution target (hours)</Label>
          <Input
            id="resolution"
            type="number"
            min={1}
            value={form.resolutionHours}
            onChange={e => setForm(f => ({ ...f, resolutionHours: e.target.value }))}
          />
        </div>

        {/* Escalation */}
        <div className="space-y-1">
          <Label htmlFor="escalation" className="text-xs">Escalate after (hours)</Label>
          <Input
            id="escalation"
            type="number"
            min={1}
            value={form.escalationHours}
            onChange={e => setForm(f => ({ ...f, escalationHours: e.target.value }))}
          />
          <p className="text-[10px] text-muted-foreground">
            SLA worker will notify the escalation service after this many hours without resolution.
          </p>
        </div>

        {/* Submit */}
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={handleSubmit} disabled={!form.name.trim() || isPending}>
            {isPending ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{isEdit ? 'Saving…' : 'Creating…'}</>
            ) : isEdit ? (
              'Save changes'
            ) : (
              'Create policy'
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Sheet>
  );
}
