import { cwFetch } from './client';
import { useAuthStore } from '@/lib/store/auth';

/** Extended inbox — superset of CWInbox (add fields without touching types/index.ts) */
export interface InboxDetail {
  id: number;
  name: string;
  channel_type: ChannelType;
  avatar_url?: string;
  working_hours_enabled: boolean;
  greeting_message?: string;
  away_message?: string;
  auto_assignment?: boolean;
  csat_survey_enabled?: boolean;
  email?: string;
  phone_number?: string;
  widget_color?: string;
  welcome_title?: string;
  welcome_tagline?: string;
  sip_extension?: string;
  whatsapp_api_key?: string;
}

export type ChannelType =
  | 'Channel::Whatsapp'
  | 'Channel::Email'
  | 'Channel::WebWidget'
  | 'Channel::TwilioSms'
  | 'Channel::Voice'
  | 'Channel::Api';

export interface InboxMember {
  id: number;
  name: string;
  email: string;
  role: string;
  availability_status: 'online' | 'busy' | 'offline';
  avatar_url?: string;
}

export interface WorkingHoursDay {
  day_of_week: number;
  closed_all_day: boolean;
  open_hour: number;
  open_minutes: number;
  close_hour: number;
  close_minutes: number;
}

export interface CreateInboxPayload {
  name: string;
  channel: {
    type: ChannelType;
    [key: string]: unknown;
  };
  working_hours_enabled?: boolean;
  greeting_message?: string;
  away_message?: string;
  auto_assignment?: boolean;
  csat_survey_enabled?: boolean;
}

function aid(): number {
  return useAuthStore.getState().user?.chatwootAccountId ?? 0;
}

function mapInboxDetail(raw: Record<string, unknown>): InboxDetail {
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ''),
    channel_type: String(raw.channel_type ?? 'Channel::Api') as ChannelType,
    avatar_url: raw.avatar_url as string | undefined,
    working_hours_enabled: Boolean(raw.working_hours_enabled),
    greeting_message: raw.greeting_message as string | undefined,
    away_message: raw.away_message as string | undefined,
    auto_assignment: raw.auto_assignment as boolean | undefined,
    csat_survey_enabled: raw.csat_survey_enabled as boolean | undefined,
    email: raw.email as string | undefined,
    phone_number: raw.phone_number as string | undefined,
    widget_color: raw.widget_color as string | undefined,
    welcome_title: raw.welcome_title as string | undefined,
    welcome_tagline: raw.welcome_tagline as string | undefined,
    sip_extension: raw.sip_extension as string | undefined,
    whatsapp_api_key: raw.whatsapp_api_key as string | undefined,
  };
}

export async function getInbox(id: number): Promise<InboxDetail> {
  const res = await cwFetch<{ payload?: Record<string, unknown> } & Record<string, unknown>>(
    `/accounts/${aid()}/inboxes/${id}`,
  );
  const raw = (res.payload ?? res) as Record<string, unknown>;
  return mapInboxDetail(raw);
}

export async function createInbox(data: CreateInboxPayload): Promise<InboxDetail> {
  const res = await cwFetch<{ payload?: Record<string, unknown> } & Record<string, unknown>>(
    `/accounts/${aid()}/inboxes`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
  const raw = (res.payload ?? res) as Record<string, unknown>;
  return mapInboxDetail(raw);
}

export async function updateInbox(id: number, data: Partial<InboxDetail>): Promise<InboxDetail> {
  const res = await cwFetch<{ payload?: Record<string, unknown> } & Record<string, unknown>>(
    `/accounts/${aid()}/inboxes/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
  const raw = (res.payload ?? res) as Record<string, unknown>;
  return mapInboxDetail(raw);
}

export async function deleteInbox(id: number): Promise<void> {
  await cwFetch<void>(`/accounts/${aid()}/inboxes/${id}`, { method: 'DELETE' });
}

export async function getInboxMembers(inboxId: number): Promise<InboxMember[]> {
  const res = await cwFetch<{ payload?: InboxMember[] }>(
    `/accounts/${aid()}/inbox_members/${inboxId}`,
  );
  return res.payload ?? [];
}

export async function updateInboxMembers(inboxId: number, userIds: number[]): Promise<void> {
  await cwFetch<void>(`/accounts/${aid()}/inbox_members`, {
    method: 'POST',
    body: JSON.stringify({ inbox_id: inboxId, user_ids: userIds }),
  });
}

export async function getInboxWorkingHours(inboxId: number): Promise<WorkingHoursDay[]> {
  const res = await cwFetch<{ working_hours?: WorkingHoursDay[] }>(
    `/accounts/${aid()}/inboxes/${inboxId}/working_hours`,
  );
  return res.working_hours ?? [];
}

export async function updateInboxWorkingHours(
  inboxId: number,
  hours: WorkingHoursDay[],
): Promise<void> {
  await cwFetch<void>(`/accounts/${aid()}/inboxes/${inboxId}/working_hours`, {
    method: 'PATCH',
    body: JSON.stringify({ working_hours: hours }),
  });
}

export async function listAllAgents(): Promise<InboxMember[]> {
  const res = await cwFetch<InboxMember[] | { payload?: InboxMember[] }>(
    `/accounts/${aid()}/agents`,
  );
  if (Array.isArray(res)) return res;
  return res.payload ?? [];
}
