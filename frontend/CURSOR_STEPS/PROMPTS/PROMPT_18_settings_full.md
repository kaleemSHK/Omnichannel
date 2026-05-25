# PROMPT 18 — Full Settings Suite (Chatwoot-style, Professional)

## What we are building

Replace the basic Settings area with a full professional settings system that mirrors real Chatwoot's `/settings/inboxes/new` UI quality. Every section gets its own dedicated page component, a full CRUD experience, demo fixtures, and RBAC guards.

**Sections to build** (all inside `src/components/settings/`):

| Section | Chatwoot equivalent |
|---------|---------------------|
| Account Settings | Account Settings |
| Agents | Agents |
| Teams | Teams |
| Inboxes | Inboxes (4-step wizard) |
| Labels | Labels |
| Custom Attributes | Custom Attributes |
| Automation | Automation |
| Bots (Agent Bots) | Bots |
| Macros | Macros |
| Canned Responses | Canned Responses |
| Integrations | Integrations |

---

## Golden rules — NEVER break

- NEVER use `localStorage` or `sessionStorage`
- NEVER call APIs with raw `fetch` — always `cwFetch()` from `src/lib/api/client.ts`
- NEVER call BlinkOne sidecar with raw `fetch` — always `bnFetch()`
- Do NOT modify `src/types/index.ts` or `src/lib/api/client.ts`
- All server state: **TanStack Query v5** — no raw `useEffect` for fetching
- All toasts: `toast` from `sonner`
- All class merging: `cn()` from `src/lib/utils/cn`
- RTL-safe: `ms-*`/`me-*`/`ps-*`/`pe-*` — zero `ml-*`/`mr-*`/`pl-*`/`pr-*`
- `text-start`/`text-end` — never `text-left`/`text-right`
- All icon-only buttons need `aria-label`
- `Escape` closes any open drawer/dialog (shadcn handles this automatically)
- TypeScript strict — no `any`, no untyped catch `(e: Error)` or `(e: unknown)`

---

## STEP 0 — Update SettingsNav and settings page

### Replace `src/components/settings/SettingsNav.tsx` (full rewrite)

```tsx
'use client';

import { cn } from '@/lib/utils/cn';
import {
  User, Bell, Users, Inbox, Tag, Sliders, Zap, Bot,
  BookOpen, MessageSquare, Puzzle, Building2, Webhook, Clock,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { can } from '@/lib/rbac';

const NAV_ITEMS = [
  // Account group
  { id: 'account',        label: 'Account Settings',   icon: Building2,    group: 'Account' },
  { id: 'profile',        label: 'Profile',            icon: User,         group: 'Account' },
  { id: 'notifications',  label: 'Notifications',      icon: Bell,         group: 'Account' },
  // Workspace group
  { id: 'agents',         label: 'Agents',             icon: Users,        group: 'Workspace' },
  { id: 'teams',          label: 'Teams',              icon: Users,        group: 'Workspace' },
  { id: 'inboxes',        label: 'Inboxes',            icon: Inbox,        group: 'Workspace' },
  { id: 'labels',         label: 'Labels',             icon: Tag,          group: 'Workspace' },
  { id: 'custom-attrs',   label: 'Custom Attributes',  icon: Sliders,      group: 'Workspace' },
  // Automation group
  { id: 'automation',     label: 'Automation',         icon: Zap,          group: 'Automation' },
  { id: 'bots',           label: 'Agent Bots',         icon: Bot,          group: 'Automation' },
  { id: 'macros',         label: 'Macros',             icon: BookOpen,     group: 'Automation' },
  { id: 'canned',         label: 'Canned Responses',   icon: MessageSquare,group: 'Automation' },
  // Integrations group
  { id: 'integrations',   label: 'Integrations',       icon: Puzzle,       group: 'Integrations' },
  { id: 'webhooks',       label: 'Webhooks',           icon: Webhook,      group: 'Integrations' },
  { id: 'business-hours', label: 'Business Hours',     icon: Clock,        group: 'Integrations' },
] as const;

export type SettingsView = (typeof NAV_ITEMS)[number]['id'];

interface Props {
  active: SettingsView;
  onChange: (v: SettingsView) => void;
}

export function SettingsNav({ active, onChange }: Props) {
  const role = useAuthStore(s => s.user?.role);

  const visible = NAV_ITEMS.filter(item => {
    if (item.id === 'account')      return can(role, 'manageTeam');
    if (item.id === 'agents')       return can(role, 'manageTeam');
    if (item.id === 'teams')        return can(role, 'manageTeam');
    if (item.id === 'inboxes')      return can(role, 'manageInboxes');
    if (item.id === 'labels')       return can(role, 'manageInboxes');
    if (item.id === 'custom-attrs') return can(role, 'manageInboxes');
    if (item.id === 'automation')   return can(role, 'manageInboxes');
    if (item.id === 'bots')         return can(role, 'manageInboxes');
    if (item.id === 'macros')       return true; // all roles
    if (item.id === 'canned')       return true; // all roles
    if (item.id === 'integrations') return can(role, 'manageInboxes');
    if (item.id === 'webhooks')     return can(role, 'manageWebhooks');
    return true;
  });

  const groups = [...new Set(visible.map(i => i.group))];

  return (
    <aside className="w-[220px] border-e h-full flex flex-col py-4 px-2 shrink-0 bg-muted/20 overflow-y-auto">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-3">
        Settings
      </h2>
      {groups.map(group => (
        <div key={group} className="mb-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
            {group}
          </p>
          {visible.filter(i => i.group === group).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-start',
                active === id
                  ? 'bg-blue-50 text-brand-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
```

### Replace `src/app/(dashboard)/settings/page.tsx` (full rewrite)

```tsx
'use client';

import { useState } from 'react';
import { SettingsNav, type SettingsView } from '@/components/settings/SettingsNav';
import { AccountSection }      from '@/components/settings/AccountSection';
import { ProfileSection }      from '@/components/settings/ProfileSection';
import { NotificationsSection }from '@/components/settings/NotificationsSection';
import { AgentsSection }       from '@/components/settings/AgentsSection';
import { TeamsSection }        from '@/components/settings/TeamsSection';
import { InboxSection }        from '@/components/settings/InboxSection';
import { LabelsSection }       from '@/components/settings/LabelsSection';
import { CustomAttrsSection }  from '@/components/settings/CustomAttrsSection';
import { AutomationSection }   from '@/components/settings/AutomationSection';
import { BotsSection }         from '@/components/settings/BotsSection';
import { MacrosSection }       from '@/components/settings/MacrosSection';
import { CannedSection }       from '@/components/settings/CannedSection';
import { IntegrationsSection } from '@/components/settings/IntegrationsSection';
import { WebhooksSection }     from '@/components/settings/WebhooksSection';
import { BusinessHoursSection }from '@/components/settings/BusinessHoursSection';

export default function SettingsPage() {
  const [view, setView] = useState<SettingsView>('account');

  const content: Record<SettingsView, React.ReactNode> = {
    account:       <AccountSection />,
    profile:       <ProfileSection />,
    notifications: <NotificationsSection />,
    agents:        <AgentsSection />,
    teams:         <TeamsSection />,
    inboxes:       <InboxSection />,
    labels:        <LabelsSection />,
    'custom-attrs':<CustomAttrsSection />,
    automation:    <AutomationSection />,
    bots:          <BotsSection />,
    macros:        <MacrosSection />,
    canned:        <CannedSection />,
    integrations:  <IntegrationsSection />,
    webhooks:      <WebhooksSection />,
    'business-hours': <BusinessHoursSection />,
  };

  return (
    <div className="flex h-full overflow-hidden">
      <SettingsNav active={view} onChange={setView} />
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl">{content[view]}</div>
    </div>
  );
}
```

---

## STEP 1 — Shared API layer (`src/lib/api/settings.ts`)

Create this new file for ALL settings API calls. Use ONLY `cwFetch`.

```ts
/**
 * Chatwoot Settings API — all /api/v1/accounts/:id/... settings endpoints
 */
import { cwFetch } from './client';
import { useAuthStore } from '@/lib/store/auth';

function aid() {
  return useAuthStore.getState().user?.chatwootAccountId ?? 0;
}

// ─── Account ─────────────────────────────────────────────────────────────────
export interface AccountSettings {
  id: number;
  name: string;
  domain?: string;
  timezone: string;
  locale: string;
  support_email?: string;
  features: Record<string, boolean>;
}

export async function getAccount(): Promise<AccountSettings> {
  return cwFetch(`/accounts/${aid()}`);
}

export async function updateAccount(data: Partial<AccountSettings>): Promise<AccountSettings> {
  return cwFetch(`/accounts/${aid()}`, { method: 'PATCH', body: JSON.stringify(data) });
}

// ─── Agents ──────────────────────────────────────────────────────────────────
export interface Agent {
  id: number;
  name: string;
  email: string;
  role: 'agent' | 'administrator';
  availability_status: 'online' | 'busy' | 'offline';
  avatar_url?: string;
  confirmed: boolean;
}

export async function listAgents(): Promise<Agent[]> {
  return cwFetch(`/accounts/${aid()}/agents`);
}

export async function createAgent(data: { name: string; email: string; role: string }): Promise<Agent> {
  return cwFetch(`/accounts/${aid()}/agents`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAgent(id: number, data: Partial<Agent>): Promise<Agent> {
  return cwFetch(`/accounts/${aid()}/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteAgent(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/agents/${id}`, { method: 'DELETE' });
}

// ─── Teams ───────────────────────────────────────────────────────────────────
export interface Team {
  id: number;
  name: string;
  description?: string;
  agents_count?: number;
}

export async function listTeams(): Promise<Team[]> {
  return cwFetch(`/accounts/${aid()}/teams`);
}

export async function createTeam(data: { name: string; description?: string }): Promise<Team> {
  return cwFetch(`/accounts/${aid()}/teams`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTeam(id: number, data: Partial<Team>): Promise<Team> {
  return cwFetch(`/accounts/${aid()}/teams/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteTeam(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/teams/${id}`, { method: 'DELETE' });
}

export async function getTeamAgents(teamId: number): Promise<Agent[]> {
  return cwFetch(`/accounts/${aid()}/teams/${teamId}/team_members`);
}

export async function updateTeamAgents(teamId: number, userIds: number[]): Promise<void> {
  return cwFetch(`/accounts/${aid()}/teams/${teamId}/team_members`, {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds }),
  });
}

// ─── Labels ──────────────────────────────────────────────────────────────────
export interface Label {
  id: number;
  title: string;
  description?: string;
  color: string;
  show_on_sidebar: boolean;
}

export async function listLabels(): Promise<{ payload: Label[] }> {
  return cwFetch(`/accounts/${aid()}/labels`);
}

export async function createLabel(data: Omit<Label, 'id'>): Promise<{ payload: Label }> {
  return cwFetch(`/accounts/${aid()}/labels`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLabel(id: number, data: Partial<Label>): Promise<{ payload: Label }> {
  return cwFetch(`/accounts/${aid()}/labels/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteLabel(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/labels/${id}`, { method: 'DELETE' });
}

// ─── Custom Attributes ───────────────────────────────────────────────────────
export type AttrType = 'text' | 'number' | 'boolean' | 'date' | 'list' | 'link';
export type AttrEntity = 'conversation_attribute' | 'contact_attribute';

export interface CustomAttribute {
  id: number;
  attribute_display_name: string;
  attribute_key: string;
  attribute_display_type: AttrType;
  attribute_model: AttrEntity;
  default_value?: string;
  attribute_values?: string[];  // for list type
}

export async function listCustomAttributes(model: AttrEntity): Promise<CustomAttribute[]> {
  return cwFetch(`/accounts/${aid()}/custom_attribute_definitions?attribute_model=${model}`);
}

export async function createCustomAttribute(data: {
  attribute_display_name: string;
  attribute_display_type: AttrType;
  attribute_model: AttrEntity;
  attribute_values?: string[];
}): Promise<CustomAttribute> {
  return cwFetch(`/accounts/${aid()}/custom_attribute_definitions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteCustomAttribute(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/custom_attribute_definitions/${id}`, { method: 'DELETE' });
}

// ─── Automation ──────────────────────────────────────────────────────────────
export interface AutomationRule {
  id: number;
  name: string;
  description?: string;
  event_name: string;
  active: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
}

export interface AutomationCondition {
  attribute_key: string;
  filter_operator: string;
  values: string[];
  query_operator: 'AND' | 'OR' | null;
}

export interface AutomationAction {
  action_name: string;
  action_params: unknown[];
}

export async function listAutomations(): Promise<{ payload: AutomationRule[] }> {
  return cwFetch(`/accounts/${aid()}/automation_rules`);
}

export async function createAutomation(data: Partial<AutomationRule>): Promise<{ payload: AutomationRule }> {
  return cwFetch(`/accounts/${aid()}/automation_rules`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAutomation(id: number, data: Partial<AutomationRule>): Promise<{ payload: AutomationRule }> {
  return cwFetch(`/accounts/${aid()}/automation_rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteAutomation(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/automation_rules/${id}`, { method: 'DELETE' });
}

// ─── Agent Bots ──────────────────────────────────────────────────────────────
export interface AgentBot {
  id: number;
  name: string;
  description?: string;
  outgoing_url: string;
  bot_type: 'webhook' | 'agent_ai';
}

export async function listBots(): Promise<AgentBot[]> {
  return cwFetch(`/accounts/${aid()}/agent_bots`);
}

export async function createBot(data: Omit<AgentBot, 'id'>): Promise<AgentBot> {
  return cwFetch(`/accounts/${aid()}/agent_bots`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBot(id: number, data: Partial<AgentBot>): Promise<AgentBot> {
  return cwFetch(`/accounts/${aid()}/agent_bots/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteBot(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/agent_bots/${id}`, { method: 'DELETE' });
}

// ─── Macros ──────────────────────────────────────────────────────────────────
export type MacroVisibility = 'global' | 'personal';

export interface Macro {
  id: number;
  name: string;
  visibility: MacroVisibility;
  actions: MacroAction[];
  created_at: string;
  updated_at: string;
}

export interface MacroAction {
  action: string;
  action_params: unknown[];
}

export async function listMacros(): Promise<{ payload: Macro[] }> {
  return cwFetch(`/accounts/${aid()}/macros`);
}

export async function getMacro(id: number): Promise<{ payload: Macro }> {
  return cwFetch(`/accounts/${aid()}/macros/${id}`);
}

export async function createMacro(data: Partial<Macro>): Promise<{ payload: Macro }> {
  return cwFetch(`/accounts/${aid()}/macros`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateMacro(id: number, data: Partial<Macro>): Promise<{ payload: Macro }> {
  return cwFetch(`/accounts/${aid()}/macros/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteMacro(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/macros/${id}`, { method: 'DELETE' });
}

// ─── Canned Responses ────────────────────────────────────────────────────────
export interface CannedResponse {
  id: number;
  short_code: string;
  content: string;
}

export async function listCannedResponses(search?: string): Promise<CannedResponse[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return cwFetch(`/accounts/${aid()}/canned_responses${q}`);
}

export async function createCannedResponse(data: Omit<CannedResponse, 'id'>): Promise<CannedResponse> {
  return cwFetch(`/accounts/${aid()}/canned_responses`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCannedResponse(id: number, data: Partial<CannedResponse>): Promise<CannedResponse> {
  return cwFetch(`/accounts/${aid()}/canned_responses/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteCannedResponse(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/canned_responses/${id}`, { method: 'DELETE' });
}

// ─── Integrations / App Connections ─────────────────────────────────────────
export interface IntegrationHook {
  id: string;
  app_id: string;
  settings: Record<string, string>;
}

export async function listHooks(appId: string): Promise<IntegrationHook[]> {
  return cwFetch(`/accounts/${aid()}/integrations/hooks?app_id=${appId}`);
}

export async function createHook(data: Omit<IntegrationHook, 'id'>): Promise<IntegrationHook> {
  return cwFetch(`/accounts/${aid()}/integrations/hooks`, { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteHook(id: string): Promise<void> {
  return cwFetch(`/accounts/${aid()}/integrations/hooks/${id}`, { method: 'DELETE' });
}
```

---

## STEP 2 — Demo fixtures (`src/lib/demo/settingsFixture.ts`)

```ts
import type {
  AccountSettings, Agent, Team, Label, CustomAttribute,
  AutomationRule, AgentBot, Macro, CannedResponse,
} from '@/lib/api/settings';

export const DEMO_ACCOUNT: AccountSettings = {
  id: 1,
  name: 'LABBIK Telecom',
  domain: 'labbik.om',
  timezone: 'Asia/Muscat',
  locale: 'en',
  support_email: 'support@labbik.om',
  features: { auto_resolve_enabled: true, csat_survey_enabled: true },
};

export const DEMO_AGENTS: Agent[] = [
  { id: 1, name: 'Ahmed Al-Rashidi',  email: 'ahmed@labbik.om',    role: 'administrator', availability_status: 'online',  confirmed: true  },
  { id: 2, name: 'Sara Al-Balushi',   email: 'sara@labbik.om',     role: 'agent',         availability_status: 'busy',    confirmed: true  },
  { id: 3, name: 'Mohammed Al-Farsi', email: 'mohammed@labbik.om', role: 'agent',         availability_status: 'offline', confirmed: true  },
  { id: 4, name: 'Fatima Al-Zaabi',   email: 'fatima@labbik.om',   role: 'agent',         availability_status: 'online',  confirmed: false },
  { id: 5, name: 'Khalid Al-Nabhani', email: 'khalid@labbik.om',   role: 'administrator', availability_status: 'online',  confirmed: true  },
];

export const DEMO_TEAMS: Team[] = [
  { id: 1, name: 'Support',  description: 'General customer support',     agents_count: 3 },
  { id: 2, name: 'Sales',    description: 'Sales and new accounts',       agents_count: 2 },
  { id: 3, name: 'Billing',  description: 'Billing and payments queries', agents_count: 2 },
];

export const DEMO_LABELS: Label[] = [
  { id: 1, title: 'billing',   description: 'Billing related',    color: '#F59E0B', show_on_sidebar: true  },
  { id: 2, title: 'vip',       description: 'VIP customer',       color: '#8B5CF6', show_on_sidebar: true  },
  { id: 3, title: 'technical', description: 'Technical issues',   color: '#0B5FFF', show_on_sidebar: true  },
  { id: 4, title: 'sales',     description: 'Sales opportunity',  color: '#10B981', show_on_sidebar: false },
  { id: 5, title: 'urgent',    description: 'Needs urgent action',color: '#EF4444', show_on_sidebar: true  },
];

export const DEMO_CUSTOM_ATTRS: CustomAttribute[] = [
  { id: 1, attribute_display_name: 'Account Number',  attribute_key: 'account_number',  attribute_display_type: 'text',    attribute_model: 'contact_attribute'      },
  { id: 2, attribute_display_name: 'Plan Type',       attribute_key: 'plan_type',       attribute_display_type: 'list',    attribute_model: 'contact_attribute',     attribute_values: ['Basic', 'Pro', 'Enterprise'] },
  { id: 3, attribute_display_name: 'CSAT Score',      attribute_key: 'csat_score',      attribute_display_type: 'number',  attribute_model: 'conversation_attribute' },
  { id: 4, attribute_display_name: 'Issue Category',  attribute_key: 'issue_category',  attribute_display_type: 'list',    attribute_model: 'conversation_attribute', attribute_values: ['Billing', 'Technical', 'Other'] },
];

export const DEMO_AUTOMATIONS: AutomationRule[] = [
  {
    id: 1,
    name: 'Auto-assign VIP conversations',
    description: 'Assign conversations from VIP contacts to the senior support team',
    event_name: 'conversation_created',
    active: true,
    conditions: [{ attribute_key: 'label', filter_operator: 'contains', values: ['vip'], query_operator: null }],
    actions: [{ action_name: 'assign_team', action_params: [1] }],
  },
  {
    id: 2,
    name: 'Auto-resolve idle conversations',
    description: 'Resolve conversations that have been idle for 24 hours',
    event_name: 'conversation_updated',
    active: true,
    conditions: [{ attribute_key: 'status', filter_operator: 'equal_to', values: ['open'], query_operator: null }],
    actions: [{ action_name: 'resolve_conversation', action_params: [] }],
  },
  {
    id: 3,
    name: 'WhatsApp language routing',
    description: 'Route Arabic WhatsApp messages to Arabic-speaking agents',
    event_name: 'conversation_created',
    active: false,
    conditions: [{ attribute_key: 'inbox_id', filter_operator: 'equal_to', values: ['1'], query_operator: null }],
    actions: [{ action_name: 'assign_team', action_params: [3] }],
  },
];

export const DEMO_BOTS: AgentBot[] = [
  { id: 1, name: 'BlinkBot',      description: 'AI-powered support bot',       outgoing_url: 'https://ai.labbik.om/hook', bot_type: 'agent_ai'  },
  { id: 2, name: 'FAQ Webhook',   description: 'FAQ lookup via external API',  outgoing_url: 'https://api.labbik.om/faq', bot_type: 'webhook'   },
];

export const DEMO_MACROS: Macro[] = [
  {
    id: 1,
    name: 'Resolve and Thank',
    visibility: 'global',
    actions: [
      { action: 'send_message',    action_params: ['Thank you for contacting LABBIK support. Your issue has been resolved!'] },
      { action: 'resolve_conversation', action_params: [] },
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Assign to Billing Team',
    visibility: 'global',
    actions: [
      { action: 'assign_team',     action_params: [3] },
      { action: 'add_label',       action_params: ['billing'] },
      { action: 'send_message',    action_params: ['I am transferring you to our Billing team who will assist you shortly.'] },
    ],
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
  {
    id: 3,
    name: 'Snooze 24h',
    visibility: 'personal',
    actions: [
      { action: 'snooze_conversation', action_params: [24] },
      { action: 'send_message', action_params: ['We will follow up with you tomorrow.'] },
    ],
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
  },
];

export const DEMO_CANNED: CannedResponse[] = [
  { id: 1, short_code: 'greet',   content: 'Hello! Thank you for contacting LABBIK Telecom. How can I help you today?'    },
  { id: 2, short_code: 'hold',    content: 'Please hold while I look into this for you. I will be right back!'            },
  { id: 3, short_code: 'thanks',  content: 'Thank you for your patience. Is there anything else I can help you with?'     },
  { id: 4, short_code: 'close',   content: 'Glad we could resolve this for you. Have a wonderful day!'                    },
  { id: 5, short_code: 'billing', content: 'I will transfer you to our Billing team. They will assist you within minutes.'  },
  { id: 6, short_code: 'sorry',   content: 'I sincerely apologize for the inconvenience. Let me look into this right away.' },
];
```

---

## STEP 3 — Shared helper component: `src/components/settings/shared/SectionHeader.tsx`

```tsx
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  canAction?: boolean;
}

export function SectionHeader({ title, description, actionLabel, onAction, canAction = true }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {actionLabel && onAction && canAction && (
        <Button className="bg-brand-primary hover:bg-brand-primary/90 shrink-0" size="sm" onClick={onAction}>
          <Plus size={14} className="me-1.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
```

### `src/components/settings/shared/EmptyState.tsx`

```tsx
import { Button } from '@/components/ui/button';
import { LucideIcon, Plus } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
        <Icon size={22} className="text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="bg-brand-primary hover:bg-brand-primary/90 mt-1">
          <Plus size={14} className="me-1.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
```

### `src/components/settings/shared/ConfirmDialog.tsx`

```tsx
'use client';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, description, confirmLabel = 'Delete',
  isPending, onConfirm, onCancel,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={o => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive hover:bg-destructive/90 text-white"
          >
            {isPending ? 'Deleting…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## STEP 4 — Account Settings (`src/components/settings/AccountSection.tsx`)

Full account settings form — name, domain, timezone, locale, support email, feature flags.

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getAccount, updateAccount } from '@/lib/api/settings';
import { DEMO_ACCOUNT } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { SectionHeader } from './shared/SectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select-radix';

const TIMEZONES = ['Asia/Muscat', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'UTC', 'Europe/London'];
const LOCALES   = [{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية (Arabic)' }];

export function AccountSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['account'],
    queryFn: () => isDemoDataEnabled() ? DEMO_ACCOUNT : getAccount(),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: updateAccount,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['account'] }); toast.success('Account settings saved'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [name, setName]           = useState('');
  const [domain, setDomain]       = useState('');
  const [timezone, setTimezone]   = useState('Asia/Muscat');
  const [locale, setLocale]       = useState('en');
  const [email, setEmail]         = useState('');
  const [autoResolve, setAutoResolve] = useState(false);
  const [csatOn, setCsatOn]       = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setDomain(data.domain ?? '');
    setTimezone(data.timezone);
    setLocale(data.locale);
    setEmail(data.support_email ?? '');
    setAutoResolve(data.features?.auto_resolve_enabled ?? false);
    setCsatOn(data.features?.csat_survey_enabled ?? false);
  }, [data]);

  if (isLoading) return <div className="space-y-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-9" />)}</div>;

  return (
    <div className="space-y-6">
      <SectionHeader title="Account Settings" description="General configuration for your BlinkOne account." />

      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold">General</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Account name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Company name" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Domain</Label>
            <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="company.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Support email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="support@company.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Default language</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCALES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold">Features</h2>
        {[
          { id: 'auto-resolve', label: 'Auto-resolve idle conversations', desc: 'Automatically resolve conversations with no activity', val: autoResolve, set: setAutoResolve },
          { id: 'csat',         label: 'CSAT survey',                     desc: 'Send satisfaction survey after conversations resolve',   val: csatOn,      set: setCsatOn     },
        ].map(f => (
          <div key={f.id} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
            <Switch id={f.id} checked={f.val} onCheckedChange={f.set} />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          disabled={isPending}
          onClick={() => mutate({ name, domain, timezone, locale, support_email: email, features: { auto_resolve_enabled: autoResolve, csat_survey_enabled: csatOn } })}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </div>
  );
}
```

---

## STEP 5 — Agents (`src/components/settings/AgentsSection.tsx`)

Full CRUD: invite new agent, change role, remove. Shows online status dot. Table layout matching Chatwoot.

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listAgents, createAgent, updateAgent, deleteAgent } from '@/lib/api/settings';
import { DEMO_AGENTS } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { SectionHeader } from './shared/SectionHeader';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { EmptyState } from './shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select-radix';
import { cn } from '@/lib/utils/cn';
import { Users, Pencil, Trash2, Mail } from 'lucide-react';
import type { Agent } from '@/lib/api/settings';

const STATUS_DOT: Record<string, string> = {
  online: 'bg-green-500', busy: 'bg-amber-500', offline: 'bg-gray-400',
};

export function AgentsSection() {
  const qc = useQueryClient();
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => isDemoDataEnabled() ? DEMO_AGENTS : listAgents(),
  });

  // Invite
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'agent' | 'administrator'>('agent');
  const { mutate: invite, isPending: inviting } = useMutation({
    mutationFn: () => createAgent({ name: inviteName, email: inviteEmail, role: inviteRole }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }); toast.success(`Invite sent to ${inviteEmail}`); setInviteOpen(false); setInviteName(''); setInviteEmail(''); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Edit role
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [editRole, setEditRole] = useState<'agent' | 'administrator'>('agent');
  const { mutate: saveRole, isPending: savingRole } = useMutation({
    mutationFn: () => updateAgent(editAgent!.id, { role: editRole }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }); toast.success('Role updated'); setEditAgent(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const { mutate: removeAgent, isPending: deleting } = useMutation({
    mutationFn: () => deleteAgent(deleteTarget!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }); toast.success('Agent removed'); setDeleteTarget(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Agents"
        description={`${agents.length} agent${agents.length !== 1 ? 's' : ''} in your account`}
        actionLabel="Invite agent"
        onAction={() => setInviteOpen(true)}
      />

      {/* Agent table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : agents.length === 0 ? (
        <EmptyState icon={Users} title="No agents yet" description="Invite your first agent to get started." actionLabel="Invite agent" onAction={() => setInviteOpen(true)} />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Agent</th>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Role</th>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                        {agent.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.email}</p>
                      </div>
                      {!agent.confirmed && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Pending</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize text-xs">{agent.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('w-2 h-2 rounded-full', STATUS_DOT[agent.availability_status] ?? 'bg-gray-400')} />
                      <span className="text-xs capitalize text-muted-foreground">{agent.availability_status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="w-8 h-8" aria-label="Edit role"
                        onClick={() => { setEditAgent(agent); setEditRole(agent.role as 'agent' | 'administrator'); }}>
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:bg-destructive/10" aria-label="Remove agent"
                        onClick={() => setDeleteTarget(agent)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite sheet */}
      <Sheet open={inviteOpen} onOpenChange={o => !o && setInviteOpen(false)}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader><SheetTitle>Invite agent</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1">
              <Label className="text-xs">Full name</Label>
              <Input placeholder="Sara Al-Balushi" value={inviteName} onChange={e => setInviteName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email address</Label>
              <Input type="email" placeholder="agent@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as 'agent' | 'administrator')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="administrator">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full bg-brand-primary hover:bg-brand-primary/90"
              disabled={!inviteName || !inviteEmail || inviting}
              onClick={() => invite()}
            >
              <Mail size={14} className="me-1.5" />
              {inviting ? 'Sending…' : 'Send invite'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit role sheet */}
      <Sheet open={!!editAgent} onOpenChange={o => !o && setEditAgent(null)}>
        <SheetContent side="right" className="sm:max-w-sm">
          <SheetHeader><SheetTitle>Change role — {editAgent?.name}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <Select value={editRole} onValueChange={v => setEditRole(v as 'agent' | 'administrator')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="administrator">Administrator</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full bg-brand-primary hover:bg-brand-primary/90" disabled={savingRole} onClick={() => saveRole()}>
              {savingRole ? 'Saving…' : 'Save role'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Remove ${deleteTarget?.name}?`}
        description="This agent will be removed from your account. Their conversations will remain."
        isPending={deleting}
        onConfirm={() => removeAgent()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
```

---

## STEP 6 — Teams (`src/components/settings/TeamsSection.tsx`)

Create/edit/delete teams + manage agent membership per team.

Build it with the same pattern as AgentsSection:
- Table listing teams with name, description, agent count
- "+ New team" → Sheet with name + description fields
- Each row: edit pencil (Sheet with name/description + InboxAgentsPanel-style agent picker) + trash (ConfirmDialog)
- Use `listTeams`, `createTeam`, `updateTeam`, `deleteTeam`, `getTeamAgents`, `updateTeamAgents` from `src/lib/api/settings.ts`
- Demo: `DEMO_TEAMS` from `src/lib/demo/settingsFixture.ts`
- RBAC: only admin/platform_admin can create/edit/delete

---

## STEP 7 — Labels (`src/components/settings/LabelsSection.tsx`)

Visual label management — the list shows each label as a colored pill.

**List display**: each label row shows:
- Colored circle `●` in `label.color`
- Label title (title-case)
- Description (if any)
- "Show on sidebar" toggle (inline, immediately fires PATCH on toggle)
- Edit pencil + delete trash icon buttons

**Create/Edit**: a Sheet with:
- Title field
- Description field
- Color picker — 12 preset swatches + a `<input type="color">` for custom
- "Show on sidebar" switch

**APIs**: `listLabels`, `createLabel`, `updateLabel`, `deleteLabel` from settings.ts
**Demo**: `DEMO_LABELS` (payload wrapper: `{ payload: labels }`)
**RBAC**: admin+ for create/edit/delete; agents see read-only list

---

## STEP 8 — Custom Attributes (`src/components/settings/CustomAttrsSection.tsx`)

Two tabs: **Conversation attributes** and **Contact attributes**.

Each tab shows:
- Table: Display name | Key (auto-kebab) | Type badge | Values (for list type, show as comma list) | Delete
- "+ New attribute" Sheet with:
  - Display name (auto-generates key from name, kebab-case, read-only preview)
  - Type selector: Text | Number | Boolean | Date | List | Link
  - Attribute values field (shows only when type = List, comma-separated input that splits to array)
- No edit — Chatwoot doesn't allow editing attributes, only delete + recreate

**APIs**: `listCustomAttributes(model)`, `createCustomAttribute`, `deleteCustomAttribute`
**Demo**: `DEMO_CUSTOM_ATTRS` filtered by model
**RBAC**: admin+ only

---

## STEP 9 — Automation (`src/components/settings/AutomationSection.tsx`)

Rules list + create/edit/toggle. This is the most complex section.

**List view**: Each automation rule card shows:
- Rule name + description
- Event badge (e.g. "Conversation Created")
- Active/Inactive toggle (fires PATCH immediately on toggle)
- Copy icon (duplicates rule) + Edit pencil + Delete trash

**Create/Edit**: Full-width Sheet with:
- Name + description
- Event dropdown: Conversation Created | Conversation Updated | Conversation Resolved | Message Created
- Conditions builder: "+ Add condition" adds rows of [attribute dropdown | operator dropdown | value input | query operator AND/OR | remove button]
  - Attributes: Status | Label | Assignee | Team | Inbox | Priority | Language
  - Operators: Equal to | Not equal to | Contains | Does not contain
- Actions builder: "+ Add action" adds rows of [action dropdown | params | remove button]
  - Actions: Assign Team | Assign Agent | Add Label | Remove Label | Resolve | Snooze | Send Message | Send Email
- Save button

**APIs**: `listAutomations`, `createAutomation`, `updateAutomation`, `deleteAutomation`
**Demo**: `DEMO_AUTOMATIONS`
**RBAC**: admin+ only

---

## STEP 10 — Agent Bots (`src/components/settings/BotsSection.tsx`)

Simple CRUD for agent bot webhooks.

**List**: Cards showing bot name, description, type badge (Webhook | Agent AI), webhook URL (truncated)
**Create/Edit Sheet**:
- Name
- Description
- Bot type: webhook | agent_ai
- Outgoing URL (webhook endpoint)
- Copy token button (shows generated token for verification)

**APIs**: `listBots`, `createBot`, `updateBot`, `deleteBot`
**Demo**: `DEMO_BOTS`
**RBAC**: admin+ only

---

## STEP 11 — Macros (`src/components/settings/MacrosSection.tsx`)

**List**: Table with macro name, action count, visibility badge (Global / Personal), created date, edit + delete
**Create/Edit Sheet**:
- Name
- Visibility: Global (all agents) | Personal (only me)
- Actions builder: "+ Add action" rows of [action selector | params | remove]
  - Actions: Send Message | Assign Team | Assign Agent | Add Label | Remove Label | Resolve | Snooze | Mute

**APIs**: `listMacros`, `createMacro`, `updateMacro`, `deleteMacro`
**Demo**: `DEMO_MACROS`
**RBAC**: all roles can create Personal; only admin can create Global

---

## STEP 12 — Canned Responses (`src/components/settings/CannedSection.tsx`)

**Design** (mirrors Chatwoot exactly):
- Search bar at top — filters by short_code or content live
- List: each row shows `/<short_code>` in monospace + content preview + edit pencil + delete trash
- "+ New canned response" opens Sheet with:
  - Short code field (auto-lowercase, no spaces — show `/` prefix)
  - Content textarea (multi-line)

**Create Sheet validation**:
- Short code: required, max 30 chars, only alphanumeric + hyphens
- Content: required, max 10,000 chars, shows character count

**APIs**: `listCannedResponses(search?)`, `createCannedResponse`, `updateCannedResponse`, `deleteCannedResponse`
**Demo**: `DEMO_CANNED`
**RBAC**: all roles can create; only admin can delete others' responses

---

## STEP 13 — Integrations (`src/components/settings/IntegrationsSection.tsx`)

Integration marketplace grid — **DO NOT** make these functional API calls; they are informational cards showing what's connected.

**Grid of integration cards** (3 columns on desktop):

| App | Icon color | Description |
|-----|-----------|-------------|
| Slack | Purple | Get notifications in your Slack workspace |
| Dialogflow | Blue | Connect Google Dialogflow for AI responses |
| OpenAI | Dark | Enable AI-powered reply suggestions |
| WhatsApp Business | Green | Official Meta WhatsApp Business API |
| Twilio SMS | Red | Send and receive SMS via Twilio |
| Stripe | Indigo | View customer payment info in conversations |
| Zapier | Orange | Connect 5000+ apps via Zapier |
| Shopify | Green | View order details from Shopify |

Each card:
- App icon (use Lucide icons as placeholder or inline SVG)
- App name
- Description
- Status badge: "Connected" (green) or "Not connected" (gray)
- "Configure" button → opens Sheet explaining it's a webhook integration with a pre-filled URL the user can copy
  - Show: Endpoint URL (copy button), a note to paste it in the respective platform's settings

For **Connected** apps, also show a "Disconnect" option in the Sheet.

**State**: use `useState` for which apps are "connected" (mock only — no real API call for this demo)

---

## STEP 14 — Checklist before finishing

- [ ] `src/lib/api/settings.ts` created — all functions use `cwFetch` only
- [ ] `src/lib/demo/settingsFixture.ts` created with all 7 fixture sets
- [ ] Shared components created: `SectionHeader`, `EmptyState`, `ConfirmDialog`
- [ ] SettingsNav updated with all 15 nav items in 4 groups (Account / Workspace / Automation / Integrations)
- [ ] `settings/page.tsx` imports and renders all 15 section components
- [ ] Each section: `isDemoDataEnabled()` guard in every query
- [ ] Each mutation: `toast.success` on success, `toast.error` on error
- [ ] Each destructive action: goes through `ConfirmDialog` first
- [ ] No section modifies `src/types/index.ts`
- [ ] RTL-safe: zero `ml-*`/`mr-*`/`pl-*`/`pr-*` — all `ms-*`/`me-*`/`ps-*`/`pe-*`
- [ ] All icon-only buttons have `aria-label`
- [ ] TypeScript strict — no `any`
- [ ] Existing sections (ProfileSection, NotificationsSection, WebhooksSection, BusinessHoursSection, InboxSection and all inbox/* components) are NOT modified

---

## Acceptance criteria

1. Settings nav shows all 15 items in 4 groups; active item highlighted in blue.
2. Account Settings: editable name, domain, timezone, locale, email, feature toggles; Save fires PATCH.
3. Agents: full table with status dots, invite Sheet, role-change Sheet, remove ConfirmDialog.
4. Teams: table with agent count, create/edit Sheet (includes agent picker), delete ConfirmDialog.
5. Labels: colored pill list, show_on_sidebar toggle fires instantly, create/edit Sheet with color swatches.
6. Custom Attributes: two tabs (Conversation / Contact), type badge, list values shown, add Sheet auto-generates key.
7. Automation: rule cards with active toggle, full conditions+actions editor Sheet, duplicate button.
8. Agent Bots: cards with type badge, create/edit Sheet with URL + token display.
9. Macros: table with visibility badge, action builder Sheet.
10. Canned Responses: live search, monospace short_code, create/edit Sheet with validation.
11. Integrations: grid cards with connected status, configure Sheet with copyable webhook URL.
12. All sections have proper empty states with CTA when list is empty.
13. All sections fall back to demo fixtures when `isDemoDataEnabled()` is true.
14. Admin/platform_admin sees all action buttons; agent sees read-only where RBAC requires.
15. All mutations show toast on success and error.
16. All drawers/Sheets close on Escape without data loss warnings.
17. Layout is RTL-safe throughout.
