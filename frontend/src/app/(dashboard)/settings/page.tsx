'use client';

import { useState } from 'react';
import { SettingsNav, type SettingsView } from '@/components/settings/SettingsNav';
import { AccountSection } from '@/components/settings/AccountSection';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { AgentsSection } from '@/components/settings/AgentsSection';
import { RolesSection } from '@/components/settings/RolesSection';
import { UsersSection } from '@/components/settings/UsersSection';
import { TeamsSection } from '@/components/settings/TeamsSection';
import { InboxSection } from '@/components/settings/InboxSection';
import { LabelsSection } from '@/components/settings/LabelsSection';
import { CustomAttrsSection } from '@/components/settings/CustomAttrsSection';
import { AutomationSection } from '@/components/settings/AutomationSection';
import { BotsSection } from '@/components/settings/BotsSection';
import { MacrosSection } from '@/components/settings/MacrosSection';
import { CannedSection } from '@/components/settings/CannedSection';
import { AgentScriptsSection } from '@/components/settings/AgentScriptsSection';
import { IntegrationsSection } from '@/components/settings/IntegrationsSection';
import { WebhooksSection } from '@/components/settings/WebhooksSection';
import { BusinessHoursSection } from '@/components/settings/BusinessHoursSection';
import { TicketFieldsSettings } from '@/components/settings/TicketFieldsSettings';
import { BrandingSection } from '@/components/settings/BrandingSection';
import { SkillsManagerSection } from '@/components/settings/SkillsManagerSection';
import { BotRoutingRules } from '@/components/ai/BotRoutingRules';
import { MfaSetupPanel } from '@/components/settings/MfaSetupPanel';
import { MfaTotpSection } from '@/components/settings/MfaTotpSection';
import { CampaignPanel } from '@/components/settings/CampaignPanel';
import { CRMConnectorsPanel } from '@/components/settings/CRMConnectorsPanel';
import { IntegrationMarketplace } from '@/components/settings/IntegrationMarketplace';
import { ApiKeysSection } from '@/components/settings/ApiKeysSection';
import { SurveyWorkspace } from '@/components/surveys/SurveyWorkspace';
import { VipCallerPanel } from '@/components/routing/VipCallerPanel';
import { QueuesSection } from '@/components/settings/QueuesSection';
import { SLAPoliciesSection } from '@/components/settings/SLAPoliciesSection';
import { RecordingSection } from '@/components/settings/RecordingSection';
import { ACWSection } from '@/components/settings/ACWSection';
import { VoiceSection } from '@/components/settings/VoiceSection';
import { TelephonySection } from '@/components/settings/TelephonySection';

export default function SettingsPage() {
  const [view, setView] = useState<SettingsView>('profile');

  const content: Record<SettingsView, React.ReactNode> = {
    account: <AccountSection />,
    profile: <ProfileSection />,
    notifications: <NotificationsSection />,
    agents: <AgentsSection />,
    roles: <RolesSection />,
    users: <UsersSection />,
    teams: <TeamsSection />,
    inboxes: <InboxSection />,
    labels: <LabelsSection />,
    'custom-attrs': <CustomAttrsSection />,
    'ticket-fields': <TicketFieldsSettings />,
    automation: <AutomationSection />,
    bots: <BotsSection />,
    'bot-routing': <BotRoutingRules />,
    macros: <MacrosSection />,
    canned: <CannedSection />,
    'agent-scripts': <AgentScriptsSection />,
    mfa: <MfaSetupPanel />,
    totp: <MfaTotpSection />,
    campaigns: <CampaignPanel />,
    surveys: <SurveyWorkspace />,
    'vip-callers': <VipCallerPanel />,
    marketplace: <IntegrationMarketplace />,
    branding: <BrandingSection />,
    'skills-manager': <SkillsManagerSection />,
    integrations: <IntegrationsSection />,
    'crm-connectors': <CRMConnectorsPanel />,
    webhooks: <WebhooksSection />,
    'api-keys': <ApiKeysSection />,
    'business-hours': <BusinessHoursSection />,
    queues: <QueuesSection />,
    'sla-policies': <SLAPoliciesSection />,
    recording: <RecordingSection />,
    acw: <ACWSection />,
    voice: <VoiceSection />,
    telephony: <TelephonySection />,
  };

  return (
    <div className="flex h-full overflow-hidden">
      <SettingsNav active={view} onChange={setView} />
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl">{content[view]}</div>
    </div>
  );
}
