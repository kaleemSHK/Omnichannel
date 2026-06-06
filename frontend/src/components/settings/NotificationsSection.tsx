'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/api/settings';
import { DEMO_NOTIFICATION_PREFS, settingsDemoDelay } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { withDemoOnly } from '@/lib/demo/tenantSettingsQuery';
import { useTenantAccountId } from '@/lib/hooks/useTenantAccountId';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Bell } from 'lucide-react';

const NOTIFICATION_TYPES = [
  {
    key: 'conversation_creation',
    label: 'New conversation',
    description: 'When a new conversation is created',
  },
  {
    key: 'conversation_assignment',
    label: 'Conversation assigned',
    description: 'When a conversation is assigned to you',
  },
  {
    key: 'conversation_mention',
    label: 'Mentioned',
    description: 'When someone mentions you in a note',
  },
  {
    key: 'assigned_conversation_new_message',
    label: 'New message',
    description: 'When your assigned conversation gets a new message',
  },
  {
    key: 'participating_conversation_new_message',
    label: 'Participant message',
    description: 'New message in a conversation you participate in',
  },
] as const;

interface PrefsState {
  email: Record<string, boolean>;
  push: Record<string, boolean>;
}

export function NotificationsSection() {
  const accountId = useTenantAccountId();
  const { data: prefs, isLoading, isError, error } = useQuery({
    queryKey: ['notification-prefs', accountId],
    enabled: accountId > 0,
    queryFn: () => withDemoOnly(DEMO_NOTIFICATION_PREFS, () => getNotificationPreferences()),
  });

  const [state, setState] = useState<PrefsState>({ email: {}, push: {} });

  useEffect(() => {
    if (!prefs) return;
    const email: Record<string, boolean> = {};
    const push: Record<string, boolean> = {};
    NOTIFICATION_TYPES.forEach(({ key }) => {
      email[key] = prefs.selected_email_flags.includes(key);
      push[key] = prefs.selected_push_flags.includes(key);
    });
    setState({ email, push });
  }, [prefs]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay(500);
        return;
      }
      await updateNotificationPreferences({
        notifications: NOTIFICATION_TYPES.map(({ key }) => ({
          notification_type: key,
          email: state.email[key] ?? false,
          push: state.push[key] ?? false,
        })),
      });
    },
    onSuccess: () => toast.success('Notification preferences saved'),
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(channel: 'email' | 'push', key: string) {
    setState(prev => ({
      ...prev,
      [channel]: { ...prev[channel], [key]: !prev[channel][key] },
    }));
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how you receive notifications for different events.
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Event</th>
              <th className="px-4 py-2.5 text-center w-24">
                <div className="flex items-center justify-center gap-1">
                  <Mail size={13} /> Email
                </div>
              </th>
              <th className="px-4 py-2.5 text-center w-24">
                <div className="flex items-center justify-center gap-1">
                  <Bell size={13} /> Push
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_TYPES.map(({ key, label, description }) => (
              <tr key={key} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <Switch
                    checked={state.email[key] ?? false}
                    onCheckedChange={() => toggle('email', key)}
                    aria-label={`Email for ${label}`}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <Switch
                    checked={state.push[key] ?? false}
                    onCheckedChange={() => toggle('push', key)}
                    aria-label={`Push for ${label}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={isPending}
          onClick={() => save()}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {isPending ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>
    </div>
  );
}
