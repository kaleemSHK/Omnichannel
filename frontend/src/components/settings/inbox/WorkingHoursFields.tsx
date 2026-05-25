'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import type { WorkingHoursDay } from '@/lib/api/inboxes';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  hours: WorkingHoursDay[];
  onChange: (hours: WorkingHoursDay[]) => void;
}

export function WorkingHoursFields({ hours, onChange }: Props) {
  function patch(dayIndex: number, patchData: Partial<WorkingHoursDay>) {
    onChange(hours.map((h, i) => (i === dayIndex ? { ...h, ...patchData } : h)));
  }

  function fmt(h: number, m: number) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function parseFmt(v: string): { h: number; m: number } {
    const [hh, mm] = v.split(':').map(Number);
    return { h: hh ?? 0, m: mm ?? 0 };
  }

  return (
    <div className="space-y-2">
      {hours.map((day, i) => (
        <div
          key={day.day_of_week}
          className={cn('flex items-center gap-3 py-1.5', day.closed_all_day && 'opacity-60')}
        >
          <Switch
            id={`day-${day.day_of_week}`}
            checked={!day.closed_all_day}
            onCheckedChange={open => patch(i, { closed_all_day: !open })}
            aria-label={DAY_NAMES[day.day_of_week]}
          />
          <Label htmlFor={`day-${day.day_of_week}`} className="w-24 text-sm shrink-0">
            {DAY_NAMES[day.day_of_week]}
          </Label>
          {!day.closed_all_day ? (
            <>
              <input
                type="time"
                className="border rounded px-2 py-1 text-sm w-28"
                value={fmt(day.open_hour, day.open_minutes)}
                onChange={e => {
                  const { h, m } = parseFmt(e.target.value);
                  patch(i, { open_hour: h, open_minutes: m });
                }}
                aria-label={`${DAY_NAMES[day.day_of_week]} open time`}
              />
              <span className="text-muted-foreground text-sm">–</span>
              <input
                type="time"
                className="border rounded px-2 py-1 text-sm w-28"
                value={fmt(day.close_hour, day.close_minutes)}
                onChange={e => {
                  const { h, m } = parseFmt(e.target.value);
                  patch(i, { close_hour: h, close_minutes: m });
                }}
                aria-label={`${DAY_NAMES[day.day_of_week]} close time`}
              />
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Closed</span>
          )}
        </div>
      ))}
    </div>
  );
}
