'use client';

import { useState } from 'react';
import { SettingsNav } from '@/components/settings/SettingsNav';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { TeamSection } from '@/components/settings/TeamSection';
import { InboxSection } from '@/components/settings/InboxSection';
import { WebhooksSection } from '@/components/settings/WebhooksSection';
import { BusinessHoursSection } from '@/components/settings/BusinessHoursSection';

type SettingsView = 'profile' | 'notifications' | 'team' | 'inboxes' | 'webhooks' | 'business-hours';

export default function SettingsPage() {
  const [view, setView] = useState<SettingsView>('profile');

  const content: Record<SettingsView, React.ReactNode> = {
    profile: <ProfileSection />,
    notifications: <NotificationsSection />,
    team: <TeamSection />,
    inboxes: <InboxSection />,
    webhooks: <WebhooksSection />,
    'business-hours': <BusinessHoursSection />,
  };

  return (
    <div className="flex h-full overflow-hidden">
      <SettingsNav active={view} onChange={setView} />
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">{content[view]}</div>
    </div>
  );
}
