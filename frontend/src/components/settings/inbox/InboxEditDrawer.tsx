'use client';

import { useState, useEffect } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { ChannelConfigFields } from './ChannelConfigFields';
import { WorkingHoursFields } from './WorkingHoursFields';
import { InboxAgentsPanel } from './InboxAgentsPanel';
import { CHANNEL_META } from './InboxCard';
import {
  useInboxDetail,
  useUpdateInbox,
  useInboxWorkingHours,
  useUpdateWorkingHours,
} from '@/hooks/useInboxAdmin';
import type { CWInbox } from '@/types';
import type { ChannelType, WorkingHoursDay } from '@/lib/api/inboxes';

type TabId = 'settings' | 'agents' | 'hours';

interface Props {
  inbox: CWInbox | null;
  onClose: () => void;
}

export function InboxEditDrawer({ inbox, onClose }: Props) {
  const { data: detail, isLoading } = useInboxDetail(inbox?.id ?? null);
  const { data: storedHours } = useInboxWorkingHours(inbox?.id ?? null);
  const { mutate: updateInbox, isPending: saving } = useUpdateInbox();
  const { mutate: saveHours, isPending: savingHours } = useUpdateWorkingHours();

  const [tab, setTab] = useState<TabId>('settings');
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('');
  const [away, setAway] = useState('');
  const [autoAssign, setAutoAssign] = useState(false);
  const [csatEnabled, setCsatEnabled] = useState(false);
  const [workingHoursOn, setWorkingHoursOn] = useState(false);
  const [channelValues, setChannelValues] = useState<Record<string, string>>({});
  const [hours, setHours] = useState<WorkingHoursDay[]>([]);

  useEffect(() => {
    if (!inbox) setTab('settings');
  }, [inbox]);

  useEffect(() => {
    if (!detail) return;
    setName(detail.name);
    setGreeting(detail.greeting_message ?? '');
    setAway(detail.away_message ?? '');
    setAutoAssign(detail.auto_assignment ?? false);
    setCsatEnabled(detail.csat_survey_enabled ?? false);
    setWorkingHoursOn(detail.working_hours_enabled);
    setChannelValues({
      email: detail.email ?? '',
      phone_number: detail.phone_number ?? '',
      whatsapp_api_key: detail.whatsapp_api_key ?? '',
      widget_color: detail.widget_color ?? '#3B82F6',
      welcome_title: detail.welcome_title ?? '',
      welcome_tagline: detail.welcome_tagline ?? '',
      sip_extension: detail.sip_extension ?? '',
    });
  }, [detail]);

  useEffect(() => {
    if (storedHours?.length) setHours(storedHours);
  }, [storedHours]);

  if (!inbox) return null;

  const meta = CHANNEL_META[inbox.channel_type] ?? { label: inbox.channel_type };
  const channelType = (detail?.channel_type ?? inbox.channel_type) as ChannelType;

  function handleSaveSettings() {
    updateInbox(
      {
        id: inbox!.id,
        data: {
          name,
          greeting_message: greeting,
          away_message: away,
          auto_assignment: autoAssign,
          csat_survey_enabled: csatEnabled,
          working_hours_enabled: workingHoursOn,
          ...channelValues,
        },
      },
      { onSuccess: onClose },
    );
  }

  function handleSaveHours() {
    saveHours({ inboxId: inbox!.id, hours });
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'settings', label: 'Settings' },
    { id: 'agents', label: 'Agents' },
    { id: 'hours', label: 'Working hours' },
  ];

  return (
    <Sheet
      open={!!inbox}
      onClose={onClose}
      title={`${meta.label} — ${inbox.name}`}
    >
      <p className="text-xs text-muted-foreground -mt-2 mb-4">
        Inbox ID #{inbox.id} · {inbox.channel_type}
      </p>

      <div className="flex gap-1 border rounded-lg p-0.5 mb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 px-2 py-1.5 text-xs rounded-md transition-colors',
              tab === t.id ? 'bg-brand-primary text-white' : 'text-muted-foreground hover:bg-muted',
            )}
            aria-pressed={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="inbox-name" className="text-xs">
                  Inbox name
                </Label>
                <Input id="inbox-name" value={name} onChange={e => setName(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="greeting" className="text-xs">
                  Greeting message
                </Label>
                <Textarea
                  id="greeting"
                  rows={2}
                  placeholder="Sent automatically when a conversation starts"
                  value={greeting}
                  onChange={e => setGreeting(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="away" className="text-xs">
                  Away message
                </Label>
                <Textarea
                  id="away"
                  rows={2}
                  placeholder="Sent when no agents are available"
                  value={away}
                  onChange={e => setAway(e.target.value)}
                />
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Channel configuration
                </p>
                <ChannelConfigFields
                  channelType={channelType}
                  values={channelValues}
                  onChange={(k, v) => setChannelValues(prev => ({ ...prev, [k]: v }))}
                />
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Behaviour
                </p>
                <Toggle
                  id="auto-assign"
                  label="Auto-assignment"
                  description="Automatically assign new conversations to available agents"
                  checked={autoAssign}
                  onChange={setAutoAssign}
                />
                <Toggle
                  id="csat"
                  label="CSAT survey"
                  description="Send a satisfaction survey after conversations are resolved"
                  checked={csatEnabled}
                  onChange={setCsatEnabled}
                />
                <Toggle
                  id="working-hours-toggle"
                  label="Business hours"
                  description="Restrict this inbox to your configured working hours"
                  checked={workingHoursOn}
                  onChange={setWorkingHoursOn}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSettings}
                  disabled={saving || !name.trim()}
                  className="bg-brand-primary hover:bg-brand-primary/90"
                >
                  {saving ? 'Saving…' : 'Save settings'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'agents' && <InboxAgentsPanel inboxId={inbox.id} />}

      {tab === 'hours' && (
        <div className="space-y-4">
          {hours.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : (
            <>
              <WorkingHoursFields hours={hours} onChange={setHours} />
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveHours}
                  disabled={savingHours}
                  className="bg-brand-primary hover:bg-brand-primary/90"
                >
                  {savingHours ? 'Saving…' : 'Save hours'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
