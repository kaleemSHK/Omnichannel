'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getAcwConfig, updateAcwConfig } from '@/lib/api/routing';
import { useTenantId } from '@/lib/hooks/useTenantScope';
import { SectionHeader } from './shared/SectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Info } from 'lucide-react';

function fmtSec(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

export function ACWSection() {
  const tenantId = useTenantId();
  const { data, isLoading } = useQuery({
    queryKey: ['acw-config', tenantId],
    queryFn: async () => {
      try { return await getAcwConfig(); }
      catch { return { durationSeconds: 60 }; }
    },
  });

  const [duration, setDuration] = useState(60);
  const [enabled, setEnabled] = useState(true);
  const [lockAgent, setLockAgent] = useState(true);

  useEffect(() => {
    if (data) setDuration(data.durationSeconds);
  }, [data]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => updateAcwConfig(enabled ? duration : 0),
    onSuccess: () => toast.success('ACW settings saved'),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>;
  }

  return (
    <div className="space-y-6 max-w-xl">
      <SectionHeader
        title="After Call Work (ACW)"
        description="Configure the wrap-up time agents get after each call to complete notes and disposition."
      />

      {/* Explainer */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-start gap-3 text-sm text-blue-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
        <p>
          After a call ends, agents enter ACW state and are temporarily unavailable for new calls.
          The timer counts down automatically, then returns the agent to <strong>available</strong>.
          Agents can also exit ACW manually.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Enable ACW timer</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When off, agents return to available immediately after calls
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <>
            {/* Duration slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  ACW duration
                </Label>
                <span className="text-sm font-mono font-semibold text-brand-primary">
                  {fmtSec(duration)}
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={600}
                step={15}
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full accent-brand-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>15s</span>
                <span>1 min</span>
                <span>2 min</span>
                <span>5 min</span>
                <span>10 min</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={15}
                  max={600}
                  step={5}
                  value={duration}
                  onChange={e => setDuration(Math.max(15, Math.min(600, Number(e.target.value))))}
                  className="w-24 h-8 text-sm text-center"
                />
                <span className="text-xs text-muted-foreground">seconds (15 – 600)</span>
              </div>
            </div>

            {/* Lock agent toggle */}
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Lock agent during ACW</p>
                <p className="text-xs text-muted-foreground">
                  Prevent agent from manually changing state until timer expires
                </p>
              </div>
              <Switch checked={lockAgent} onCheckedChange={setLockAgent} />
            </div>

            {/* Preset suggestions */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-muted-foreground mb-2">Quick presets</p>
              <div className="flex gap-2 flex-wrap">
                {[30, 60, 90, 120, 180, 300].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDuration(s)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      duration === s
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {fmtSec(s)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          disabled={isPending}
          onClick={() => save()}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {isPending ? 'Saving…' : 'Save ACW settings'}
        </Button>
      </div>
    </div>
  );
}
