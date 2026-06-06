'use client';

import { useQuery } from '@tanstack/react-query';
import { listInboxes } from '@/lib/api/conversations';
import { listAgents, listLabels, listTeams } from '@/lib/api/settings';
import {
  DEMO_AGENTS,
  DEMO_LABELS,
  DEMO_TEAMS,
} from '@/lib/demo/settingsFixture';
import { DEMO_INBOXES } from '@/lib/demo/inboxesFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { withDemoOnly } from '@/lib/demo/tenantSettingsQuery';
import { useTenantAccountId } from '@/lib/hooks/useTenantAccountId';
import type { CWInbox } from '@/types';

export const AUTOMATION_EVENTS = [
  { value: 'conversation_created', label: 'Conversation Created' },
  { value: 'conversation_updated', label: 'Conversation Updated' },
  { value: 'conversation_resolved', label: 'Conversation Resolved' },
  { value: 'message_created', label: 'Message Created' },
] as const;

/** Chatwoot-valid condition keys per event (see Chatwoot automation docs). */
export const CONVERSATION_CONDITION_ATTRIBUTES = [
  { value: 'status', label: 'Status' },
  { value: 'inbox_id', label: 'Inbox' },
  { value: 'team_id', label: 'Team' },
  { value: 'assignee_id', label: 'Assignee' },
  { value: 'labels', label: 'Label' },
  { value: 'priority', label: 'Priority' },
  { value: 'conversation_language', label: 'Language' },
] as const;

export const MESSAGE_CONDITION_ATTRIBUTES = [
  { value: 'content', label: 'Message content' },
  { value: 'message_type', label: 'Message type' },
] as const;

export function conditionAttributesForEvent(eventName: string) {
  if (eventName === 'message_created') return [...MESSAGE_CONDITION_ATTRIBUTES];
  return [...CONVERSATION_CONDITION_ATTRIBUTES];
}

export const MESSAGE_TYPE_VALUES = [
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
  { value: 'template', label: 'Template' },
];

/** @deprecated use conditionAttributesForEvent */
export const CONDITION_ATTRIBUTES = CONVERSATION_CONDITION_ATTRIBUTES;

export const CONDITION_OPERATORS = [
  { value: 'equal_to', label: 'Equal to' },
  { value: 'not_equal_to', label: 'Not equal to' },
  { value: 'contains', label: 'Contains' },
  { value: 'does_not_contain', label: 'Does not contain' },
] as const;

export const AUTOMATION_ACTIONS = [
  { value: 'assign_agent', label: 'Assign to agent', needsParam: true },
  { value: 'assign_team', label: 'Assign to team', needsParam: true },
  { value: 'add_label', label: 'Add label', needsParam: true },
  { value: 'remove_label', label: 'Remove label', needsParam: true },
  { value: 'send_message', label: 'Send message', needsParam: true, multiline: true },
  { value: 'send_email_to_team', label: 'Send email to team', needsParam: true },
  { value: 'change_priority', label: 'Change priority', needsParam: true },
  { value: 'resolve_conversation', label: 'Resolve conversation', needsParam: false },
  { value: 'snooze_conversation', label: 'Snooze conversation', needsParam: false },
  { value: 'mute_conversation', label: 'Mute conversation', needsParam: false },
] as const;

export const STATUS_VALUES = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'pending', label: 'Pending' },
  { value: 'snoozed', label: 'Snoozed' },
];

export const PRIORITY_VALUES = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const LANGUAGE_VALUES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
];

/** Map legacy/demo keys from API to Chatwoot keys used in the editor. */
export function normalizeConditionKey(key: string): string {
  if (key === 'inbox') return 'inbox_id';
  if (key === 'team') return 'team_id';
  if (key === 'assignee') return 'assignee_id';
  if (key === 'language') return 'conversation_language';
  if (key === 'label') return 'labels';
  return key;
}

export function defaultOperatorForAttribute(key: string): string {
  if (key === 'labels') return 'contains';
  if (key === 'content') return 'contains';
  return 'equal_to';
}

export function eventLabel(name: string): string {
  return AUTOMATION_EVENTS.find(e => e.value === name)?.label ?? name.replace(/_/g, ' ');
}

export function actionLabel(name: string): string {
  return AUTOMATION_ACTIONS.find(a => a.value === name)?.label ?? name.replace(/_/g, ' ');
}

export function useAutomationLookups() {
  const demo = isDemoDataEnabled();
  const accountId = useTenantAccountId();

  const agents = useQuery({
    queryKey: ['automation-agents', accountId, demo],
    enabled: accountId > 0 || demo,
    queryFn: () => withDemoOnly(DEMO_AGENTS, () => listAgents()),
    staleTime: 60_000,
  });

  const teams = useQuery({
    queryKey: ['automation-teams', accountId, demo],
    enabled: accountId > 0 || demo,
    queryFn: () => withDemoOnly(DEMO_TEAMS, () => listTeams()),
    staleTime: 60_000,
  });

  const labels = useQuery({
    queryKey: ['automation-labels', accountId, demo],
    enabled: accountId > 0 || demo,
    queryFn: () =>
      withDemoOnly(DEMO_LABELS, async () => {
        const res = await listLabels();
        return res.payload;
      }),
    staleTime: 60_000,
  });

  const inboxes = useQuery({
    queryKey: ['automation-inboxes', accountId, demo],
    enabled: accountId > 0 || demo,
    queryFn: () => withDemoOnly(DEMO_INBOXES as CWInbox[], () => listInboxes()),
    staleTime: 60_000,
  });

  return {
    agents: agents.data ?? [],
    teams: teams.data ?? [],
    labels: labels.data ?? [],
    inboxes: inboxes.data ?? [],
    isLoading: agents.isLoading || teams.isLoading || labels.isLoading || inboxes.isLoading,
  };
}
