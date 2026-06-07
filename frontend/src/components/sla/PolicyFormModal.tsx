'use client';

/**
 * PolicyFormModal — create or edit an SLA policy.
 * Used inside the SLAWorkspace Policies view.
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreatePolicy, useUpdatePolicy } from '@/lib/hooks/useSla';
import { listCalendars } from '@/lib/api/sla';
import { isGatewayQueryEnabled } from '@/lib/demo/config';
import type { SLAPolicy } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** If provided, pre-fills the form for editing */
  existing?: SLAPolicy | null;
}

const TIER_OPTIONS: SLAPolicy['tier'][] = ['gold', 'silver', 'bronze', 'custom'];

const TIER_DEFAULTS: Record<SLAPolicy['tier'], { firstResponseMinutes: number; resolutionHours: number }> = {
  gold:   { firstResponseMinutes: 15, resolutionHours: 4 },
  silver: { firstResponseMinutes: 30, resolutionHours: 8 },
  bronze: { firstResponseMinutes: 60, resolutionHours: 24 },
  custom: { firstResponseMinutes: 60, resolutionHours: 24 },
};

const TIER_LABEL: Record<SLAPolicy['tier'], string> = {
  gold: '🥇 Gold', silver: '🥈 Silver', bronze: '🥉 Bronze', custom: 'Custom',
};

interface FormState {
  name: string;
  tier: SLAPolicy['tier'];
  firstResponseMinutes: string;
  resolutionHours: string;
  calendarId: string;
}

function defaultState(existing?: SLAPolicy | null): FormState {
  if (existing) {
    return {
      name: existing.name,
      tier: existing.tier,
      firstResponseMinutes: String(existing.firstResponseMinutes),
      resolutionHours: String(existing.resolutionHours),
      calendarId: existing.calendarId ?? '',
    };
  }
  return {
    name: '',
    tier: 'silver',
    firstResponseMinutes: '30',
    resolutionHours: '8',
    calendarId: '',
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
    }));
  }

  const { data: calendars = [] } = useQuery({
    queryKey: ['sla-calendars'],
    queryFn: listCalendars,
    enabled: open && isGatewayQueryEnabled(),
  });

  useEffect(() => {
    if (!existing && calendars.length && !form.calendarId) {
      setForm(f => ({ ...f, calendarId: calendars[0].id }));
    }
  }, [calendars, existing, form.calendarId]);

  function handleSubmit() {
    const payload = {
      name: form.name.trim(),
      tier: form.tier,
      firstResponseMinutes: Number(form.firstResponseMinutes),
      resolutionHours: Number(form.resolutionHours),
      calendarId: form.calendarId || undefined,
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

        {/* Business hours calendar */}
        <div className="space-y-1">
          <Label htmlFor="calendar" className="text-xs">Business hours calendar</Label>
          <select
            id="calendar"
            className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            value={form.calendarId}
            onChange={e => setForm(f => ({ ...f, calendarId: e.target.value }))}
          >
            <option value="">24/7 (no calendar)</option>
            {calendars.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.timezone})
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">
            Tier applies to priorities: Gold = urgent/high, Silver = medium, Bronze = low.
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
