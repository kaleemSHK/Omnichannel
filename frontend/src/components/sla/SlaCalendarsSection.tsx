'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { listCalendars, updateCalendar } from '@/lib/api/sla';
import { isGatewayQueryEnabled } from '@/lib/demo/config';
import { useTenantAccountId } from '@/lib/hooks/useTenantAccountId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Window = { start: string; end: string };
type Calendar = Awaited<ReturnType<typeof listCalendars>>[number];

const DEFAULT_WEEK: Record<string, Window[]> = {
  sunday: [],
  monday: [{ start: '08:00', end: '17:00' }],
  tuesday: [{ start: '08:00', end: '17:00' }],
  wednesday: [{ start: '08:00', end: '17:00' }],
  thursday: [{ start: '08:00', end: '17:00' }],
  friday: [{ start: '08:00', end: '12:00' }],
  saturday: [],
};

export function SlaCalendarsSection() {
  const qc = useQueryClient();
  const tenantId = String(useTenantAccountId() || '');
  const { data: calendars = [], isLoading, isError } = useQuery({
    queryKey: ['sla-calendars', tenantId],
    queryFn: listCalendars,
    enabled: isGatewayQueryEnabled() && Boolean(tenantId),
  });

  const calendar = calendars[0];
  const [timezone, setTimezone] = useState('Asia/Muscat');
  const [weekdayHours, setWeekdayHours] = useState<Record<string, Window[]>>(DEFAULT_WEEK);

  useEffect(() => {
    if (!calendar) return;
    setTimezone(calendar.timezone || 'Asia/Muscat');
    setWeekdayHours({ ...DEFAULT_WEEK, ...(calendar.weekdayHours ?? {}) });
  }, [calendar]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!calendar) throw new Error('No SLA calendar configured');
      await updateCalendar(calendar.id, { timezone, weekdayHours });
    },
    onSuccess: () => {
      toast.success('Business hours saved');
      void qc.invalidateQueries({ queryKey: ['sla-calendars'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (isError || !calendar) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No SLA business-hours calendar found. Run the SLA demo seed or create a calendar via API.
      </div>
    );
  }

  function patchDay(day: string, windows: Window[]) {
    setWeekdayHours(prev => ({ ...prev, [day]: windows }));
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">Business hours</h2>
        <p className="text-xs text-muted-foreground mt-1">
          SLA due dates count only time inside these windows ({calendar.name}).
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Timezone</Label>
        <Input value={timezone} onChange={e => setTimezone(e.target.value)} />
      </div>

      <div className="space-y-2">
        {DAY_KEYS.map((day, idx) => {
          const windows = weekdayHours[day] ?? [];
          const open = windows.length > 0;
          return (
            <div key={day} className="flex items-center gap-3 border rounded-md px-3 py-2 bg-white">
              <span className="w-24 text-sm text-gray-700">{DAY_LABELS[idx]}</span>
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={open}
                  onChange={e =>
                    patchDay(day, e.target.checked ? [{ start: '08:00', end: '17:00' }] : [])
                  }
                />
                Open
              </label>
              {open && (
                <>
                  <Input
                    className="w-24 h-8 text-xs"
                    value={windows[0]?.start ?? '08:00'}
                    onChange={e =>
                      patchDay(day, [{ start: e.target.value, end: windows[0]?.end ?? '17:00' }])
                    }
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <Input
                    className="w-24 h-8 text-xs"
                    value={windows[0]?.end ?? '17:00'}
                    onChange={e =>
                      patchDay(day, [{ start: windows[0]?.start ?? '08:00', end: e.target.value }])
                    }
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
        {saveMut.isPending ? 'Saving…' : 'Save business hours'}
      </Button>
    </div>
  );
}
