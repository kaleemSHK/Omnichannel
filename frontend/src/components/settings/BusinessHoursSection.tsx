'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-radix';
import { toast } from 'sonner';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
type Day = (typeof DAYS)[number];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0');
  return [`${h}:00`, `${h}:30`];
}).flat();

interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
}

const DEFAULT_SCHEDULE: Record<Day, DaySchedule> = {
  Monday: { enabled: true, open: '09:00', close: '18:00' },
  Tuesday: { enabled: true, open: '09:00', close: '18:00' },
  Wednesday: { enabled: true, open: '09:00', close: '18:00' },
  Thursday: { enabled: true, open: '09:00', close: '18:00' },
  Friday: { enabled: true, open: '09:00', close: '17:00' },
  Saturday: { enabled: false, open: '09:00', close: '13:00' },
  Sunday: { enabled: false, open: '09:00', close: '13:00' },
};

export function BusinessHoursSection() {
  const [schedule, setSchedule] = useState<Record<Day, DaySchedule>>(DEFAULT_SCHEDULE);
  const [timezone, setTimezone] = useState('Asia/Muscat');
  const [saving, setSaving] = useState(false);

  function updateDay(day: Day, patch: Partial<DaySchedule>) {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    toast.success('Business hours saved');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Business hours</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define when your team is available. SLA timers respect these windows when &quot;Business
          hours only&quot; is enabled on a policy.
        </p>
      </div>

      <div className="space-y-1.5 max-w-xs">
        <label className="text-sm font-medium">Timezone</label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              'Asia/Muscat',
              'Asia/Dubai',
              'Asia/Riyadh',
              'Asia/Kuwait',
              'UTC',
              'Europe/London',
              'America/New_York',
            ].map(tz => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[120px_60px_1fr_16px_1fr] gap-3 bg-muted/40 border-b px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
          <span>Day</span>
          <span>Open</span>
          <span>Opens at</span>
          <span />
          <span>Closes at</span>
        </div>

        {DAYS.map(day => {
          const d = schedule[day];
          return (
            <div
              key={day}
              className="grid grid-cols-[120px_60px_1fr_16px_1fr] gap-3 items-center px-4 py-3 border-b last:border-0 hover:bg-muted/10 transition-colors"
            >
              <span className="text-sm font-medium">{day}</span>
              <Switch checked={d.enabled} onCheckedChange={v => updateDay(day, { enabled: v })} />
              <Select
                value={d.open}
                onValueChange={v => updateDay(day, { open: v })}
                disabled={!d.enabled}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {HOURS.map(h => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground text-center">→</span>
              <Select
                value={d.close}
                onValueChange={v => updateDay(day, { close: v })}
                disabled={!d.enabled}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {HOURS.map(h => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-brand-primary hover:bg-brand-primary/90"
      >
        {saving ? 'Saving…' : 'Save business hours'}
      </Button>
    </div>
  );
}
