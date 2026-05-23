'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const NOTIFICATION_PREFS = [
  { id: 'new_conversation', label: 'New conversation assigned to me', group: 'In-app' },
  { id: 'mention', label: 'Someone mentions me in a note', group: 'In-app' },
  { id: 'sla_breach', label: 'SLA breach alert', group: 'In-app' },
  { id: 'incoming_call', label: 'Incoming call notification', group: 'In-app' },
  { id: 'email_new_conv', label: 'New conversation (email digest)', group: 'Email' },
  { id: 'email_sla', label: 'SLA breached (email alert)', group: 'Email' },
  { id: 'email_ticket', label: 'Ticket assigned to me (email)', group: 'Email' },
  { id: 'sms_call_missed', label: 'Missed call alert (SMS)', group: 'SMS' },
];

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    new_conversation: true,
    mention: true,
    sla_breach: true,
    incoming_call: true,
    email_new_conv: false,
    email_sla: true,
    email_ticket: false,
    sms_call_missed: false,
  });

  const groups = [...new Set(NOTIFICATION_PREFS.map(p => p.group))];

  function toggle(id: string) {
    setPrefs(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which events trigger alerts for your account.
        </p>
      </div>

      {groups.map(group => (
        <div key={group} className="space-y-3">
          <h2 className="text-sm font-semibold border-b pb-1">{group}</h2>
          {NOTIFICATION_PREFS.filter(p => p.group === group).map(({ id, label }) => (
            <div key={id} className="flex items-center justify-between py-1">
              <Label htmlFor={id} className="text-sm cursor-pointer">
                {label}
              </Label>
              <Switch id={id} checked={prefs[id] ?? false} onCheckedChange={() => toggle(id)} />
            </div>
          ))}
        </div>
      ))}

      <Button
        type="button"
        onClick={() => toast.success('Notification preferences saved')}
        className="bg-brand-primary hover:bg-brand-primary/90"
      >
        Save preferences
      </Button>
    </div>
  );
}
