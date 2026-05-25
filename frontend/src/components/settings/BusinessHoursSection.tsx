'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getBusinessHours, updateBusinessHours, type BusinessHourEntry } from '@/lib/api/settings';
import { DEMO_BUSINESS_HOURS, settingsDemoDelay } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

function fmt(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parse(v: string): { h: number; m: number } {
  const [hh, mm] = v.split(':').map(Number);
  return { h: hh ?? 0, m: mm ?? 0 };
}

export function BusinessHoursSection() {
  const qc = useQueryClient();
  const [hours, setHours] = useState<BusinessHourEntry[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['business-hours'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_BUSINESS_HOURS;
      try {
        const list = await getBusinessHours();
        return list.length ? list : DEMO_BUSINESS_HOURS;
      } catch {
        return DEMO_BUSINESS_HOURS;
      }
    },
  });

  useEffect(() => {
    if (data?.length) {
      setHours([...data].sort((a, b) => a.day_of_week - b.day_of_week));
    }
  }, [data]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay(500);
        return;
      }
      await updateBusinessHours(hours);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-hours'] });
      toast.success('Business hours saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function patch(dayOfWeek: number, changes: Partial<BusinessHourEntry>) {
    setHours(prev => prev.map(h => (h.day_of_week === dayOfWeek ? { ...h, ...changes } : h)));
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <Skeleton key={i} className="h-10 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Business Hours</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define your account-wide operating hours. Inboxes can override these per-inbox.
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {hours.map((day, idx) => (
          <div
            key={day.day_of_week}
            className={cn(
              'flex items-center gap-4 px-4 py-3',
              idx < hours.length - 1 && 'border-b',
              day.closed_all_day && 'opacity-60',
            )}
          >
            <Switch
              checked={!day.closed_all_day}
              onCheckedChange={open => patch(day.day_of_week, { closed_all_day: !open })}
              aria-label={DAY_NAMES[day.day_of_week]}
            />

            <span className="w-28 text-sm shrink-0">
              {DAY_NAMES[day.day_of_week] ?? day.name}
            </span>

            {!day.closed_all_day ? (
              <div className="flex items-center gap-2 flex-1">
                <select
                  className="border rounded px-2 py-1.5 text-sm bg-background w-24"
                  value={fmt(day.open_hour, day.open_minutes)}
                  onChange={e => {
                    const { h, m } = parse(e.target.value);
                    patch(day.day_of_week, { open_hour: h, open_minutes: m });
                  }}
                  aria-label={`${DAY_NAMES[day.day_of_week]} open time`}
                >
                  {TIME_OPTIONS.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground text-sm">–</span>
                <select
                  className="border rounded px-2 py-1.5 text-sm bg-background w-24"
                  value={fmt(day.close_hour, day.close_minutes)}
                  onChange={e => {
                    const { h, m } = parse(e.target.value);
                    patch(day.day_of_week, { close_hour: h, close_minutes: m });
                  }}
                  aria-label={`${DAY_NAMES[day.day_of_week]} close time`}
                >
                  {TIME_OPTIONS.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground flex-1">Closed all day</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          disabled={isPending}
          onClick={() => save()}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {isPending ? 'Saving…' : 'Save hours'}
        </Button>
      </div>
    </div>
  );
}
