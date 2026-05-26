'use client';

import { useState } from 'react';
import { SettingsNav, type SettingsView } from '@/components/settings/SettingsNav';
import { AccountSection } from '@/components/settings/AccountSection';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { AgentsSection } from '@/components/settings/AgentsSection';
import { TeamsSection } from '@/components/settings/TeamsSection';
import { InboxSection } from '@/components/settings/InboxSection';
import { LabelsSection } from '@/components/settings/LabelsSection';
import { CustomAttrsSection } from '@/components/settings/CustomAttrsSection';
import { AutomationSection } from '@/components/settings/AutomationSection';
import { BotsSection } from '@/components/settings/BotsSection';
import { MacrosSection } from '@/components/settings/MacrosSection';
import { CannedSection } from '@/components/settings/CannedSection';
import { IntegrationsSection } from '@/components/settings/IntegrationsSection';
import { WebhooksSection } from '@/components/settings/WebhooksSection';
import { BusinessHoursSection } from '@/components/settings/BusinessHoursSection';
import { TicketFieldsSettings } from '@/components/settings/TicketFieldsSettings';
import { BrandingSection } from '@/components/settings/BrandingSection';

export default function SettingsPage() {
  const [view, setView] = useState<SettingsView>('profile');

  const content: Record<SettingsView, React.ReactNode> = {
    account: <AccountSection />,
    profile: <ProfileSection />,
    notifications: <NotificationsSection />,
    agents: <AgentsSection />,
    teams: <TeamsSection />,
    inboxes: <InboxSection />,
    labels: <LabelsSection />,
    'custom-attrs': <CustomAttrsSection />,
    'ticket-fields': <TicketFieldsSettings />,
    automation: <AutomationSection />,
    bots: <BotsSection />,
    macros: <MacrosSection />,
    canned: <CannedSection />,
    branding: <BrandingSection />,
    integrations: <IntegrationsSection />,
    webhooks: <WebhooksSection />,
    'business-hours': <BusinessHoursSection />,
  };

  return (
    <div className="flex h-full overflow-hidden">
      <SettingsNav active={view} onChange={setView} />
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl">{content[view]}</div>
    </div>
  );
}
