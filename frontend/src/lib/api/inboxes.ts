import { cwFetch } from './client';
import { useAuthStore } from '@/lib/store/auth';
import { CHATWOOT_URL } from '@/lib/env';

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
  forward_to_email?: string;
  phone_number?: string;
  widget_color?: string;
  welcome_title?: string;
  welcome_tagline?: string;
  website_url?: string;
  website_token?: string;
  sip_extension?: string;
  whatsapp_api_key?: string;
  webhook_url?: string;
}

export type ChannelType =
  | 'Channel::Whatsapp'
  | 'Channel::Email'
  | 'Channel::WebWidget'
  | 'Channel::TwilioSms'
  | 'Channel::Voice'
  | 'Channel::Api'
  | 'Channel::Telegram'
  | 'Channel::Line'
  | 'Channel::FacebookPage'
  | 'Channel::Instagram';

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

/** Chatwoot REST expects snake_case channel types (e.g. web_widget), not Channel::WebWidget. */
const CHANNEL_TYPE_TO_CHATWOOT: Record<ChannelType, string> = {
  'Channel::WebWidget': 'web_widget',
  'Channel::Email': 'email',
  'Channel::Api': 'api',
  'Channel::Whatsapp': 'whatsapp',
  'Channel::TwilioSms': 'twilio_sms',
  'Channel::Telegram': 'telegram',
  'Channel::Line': 'line',
  'Channel::Voice': 'api',
  'Channel::FacebookPage': 'facebook',
  'Channel::Instagram': 'instagram',
};

const CHATWOOT_TO_CHANNEL_TYPE: Record<string, ChannelType> = {
  web_widget: 'Channel::WebWidget',
  email: 'Channel::Email',
  api: 'Channel::Api',
  whatsapp: 'Channel::Whatsapp',
  twilio_sms: 'Channel::TwilioSms',
  sms: 'Channel::TwilioSms',
  telegram: 'Channel::Telegram',
  line: 'Channel::Line',
  facebook: 'Channel::FacebookPage',
  'Channel::FacebookPage': 'Channel::FacebookPage',
  instagram: 'Channel::Instagram',
  'Channel::Instagram': 'Channel::Instagram',
  'Channel::WebWidget': 'Channel::WebWidget',
  'Channel::Email': 'Channel::Email',
  'Channel::Api': 'Channel::Api',
  'Channel::Whatsapp': 'Channel::Whatsapp',
  'Channel::TwilioSms': 'Channel::TwilioSms',
  'Channel::Telegram': 'Channel::Telegram',
  'Channel::Line': 'Channel::Line',
  'Channel::Voice': 'Channel::Voice',
};

function defaultWebsiteUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://app.blinksone.com';
}

/** Map BlinkOne wizard payload → Chatwoot POST /inboxes body. */
export function buildChatwootCreateInboxBody(data: CreateInboxPayload): Record<string, unknown> {
  const { type, ...fields } = data.channel;
  const cwType = CHANNEL_TYPE_TO_CHATWOOT[type];
  if (!cwType) {
    throw new Error(`Unsupported channel type: ${type}`);
  }

  const channel: Record<string, unknown> = { type: cwType };

  switch (type) {
    case 'Channel::WebWidget':
      channel.website_url = String(fields.website_url ?? defaultWebsiteUrl()).trim();
      if (fields.welcome_title) channel.welcome_title = fields.welcome_title;
      if (fields.welcome_tagline) channel.welcome_tagline = fields.welcome_tagline;
      channel.widget_color = fields.widget_color ?? '#3B82F6';
      break;
    case 'Channel::Email':
      channel.email = fields.email;
      if (fields.forward_to_email) channel.forward_to_email = fields.forward_to_email;
      if (fields.imap_enabled === 'true' || fields.imap_enabled === true) {
        channel.imap_enabled = true;
        channel.imap_address = fields.imap_address;
        channel.imap_port = Number(fields.imap_port || 993);
        channel.imap_email = fields.imap_email ?? fields.email;
        channel.imap_password = fields.imap_password;
      }
      if (fields.smtp_enabled === 'true' || fields.smtp_enabled === true) {
        channel.smtp_enabled = true;
        channel.smtp_address = fields.smtp_address;
        channel.smtp_port = Number(fields.smtp_port || 587);
        channel.smtp_email = fields.smtp_email ?? fields.email;
        channel.smtp_password = fields.smtp_password;
      }
      break;
    case 'Channel::Api':
      if (fields.webhook_url) channel.webhook_url = fields.webhook_url;
      break;
    case 'Channel::Voice':
      if (fields.webhook_url) channel.webhook_url = fields.webhook_url;
      break;
    case 'Channel::TwilioSms':
      channel.medium = 'sms';
      channel.phone_number = fields.phone_number;
      channel.account_sid = fields.account_sid;
      channel.auth_token = fields.auth_token;
      if (fields.messaging_service_sid) {
        channel.messaging_service_sid = fields.messaging_service_sid;
      }
      break;
    case 'Channel::Whatsapp':
      if (fields.phone_number) channel.phone_number = fields.phone_number;
      channel.provider = fields.provider || 'whatsapp_cloud';
      if (fields.whatsapp_api_key) {
        channel.provider_config = { api_key: fields.whatsapp_api_key };
      }
      break;
    case 'Channel::Telegram':
      channel.bot_token = fields.bot_token;
      break;
    case 'Channel::Line':
      channel.line_channel_id = fields.line_channel_id;
      channel.line_channel_secret = fields.line_channel_secret;
      channel.line_channel_token = fields.line_channel_token;
      break;
    default:
      break;
  }

  return {
    name: data.name,
    channel,
    ...(data.working_hours_enabled !== undefined && {
      working_hours_enabled: data.working_hours_enabled,
    }),
    ...(data.greeting_message && { greeting_message: data.greeting_message }),
    ...(data.away_message && { out_of_office_message: data.away_message }),
    ...(data.auto_assignment !== undefined && {
      enable_auto_assignment: data.auto_assignment,
    }),
    ...(data.csat_survey_enabled !== undefined && {
      csat_survey_enabled: data.csat_survey_enabled,
    }),
  };
}

export function validateCreateInboxPayload(data: CreateInboxPayload): string | null {
  const { type, ...fields } = data.channel;
  if (!data.name.trim()) return 'Inbox name is required';
  switch (type) {
    case 'Channel::WebWidget':
      if (!String(fields.website_url ?? defaultWebsiteUrl()).trim()) {
        return 'Website URL is required for web widget inboxes';
      }
      return null;
    case 'Channel::Email':
      if (!fields.email) return 'Email address is required';
      return null;
    case 'Channel::Telegram':
      if (!fields.bot_token) return 'Telegram bot token is required';
      return null;
    case 'Channel::Line':
      if (!fields.line_channel_id || !fields.line_channel_secret || !fields.line_channel_token) {
        return 'Line channel ID, secret, and token are required';
      }
      return null;
    case 'Channel::TwilioSms':
      if (!fields.phone_number) return 'Twilio phone number is required (E.164, e.g. +96891234567)';
      if (!fields.account_sid) return 'Twilio Account SID is required';
      if (!fields.auth_token) return 'Twilio Auth Token is required';
      return null;
    default:
      return null;
  }
}

function mapInboxDetail(raw: Record<string, unknown>): InboxDetail {
  const channel = (raw.channel as Record<string, unknown> | undefined) ?? {};
  const cwType = String(raw.channel_type ?? channel.type ?? 'api');
  const channelType = CHATWOOT_TO_CHANNEL_TYPE[cwType] ?? 'Channel::Api';

  return {
    id: Number(raw.id),
    name: String(raw.name ?? ''),
    channel_type: channelType,
    avatar_url: (raw.avatar_url ?? channel.avatar_url) as string | undefined,
    working_hours_enabled: Boolean(raw.working_hours_enabled),
    greeting_message: raw.greeting_message as string | undefined,
    away_message: (raw.away_message ?? raw.out_of_office_message) as string | undefined,
    auto_assignment: (raw.auto_assignment ?? raw.enable_auto_assignment) as boolean | undefined,
    csat_survey_enabled: raw.csat_survey_enabled as boolean | undefined,
    email: (raw.email ?? channel.email) as string | undefined,
    forward_to_email: channel.forward_to_email as string | undefined,
    phone_number: (raw.phone_number ?? channel.phone_number) as string | undefined,
    widget_color: channel.widget_color as string | undefined,
    welcome_title: channel.welcome_title as string | undefined,
    welcome_tagline: channel.welcome_tagline as string | undefined,
    website_url: channel.website_url as string | undefined,
    website_token: channel.website_token as string | undefined,
    webhook_url: channel.webhook_url as string | undefined,
    sip_extension: raw.sip_extension as string | undefined,
    whatsapp_api_key: raw.whatsapp_api_key as string | undefined,
  };
}

/** Chatwoot web widget embed snippet (same as Chatwoot dashboard). */
export function buildWidgetEmbedScript(websiteToken: string, baseUrl?: string): string {
  const base = (baseUrl ?? CHATWOOT_URL).replace(/\/$/, '');
  return `<script>
  (function(d,t) {
    var BASE_URL="${base}";
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+"/packs/js/sdk.js";
    g.defer = true;
    g.async = true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      window.chatwootSDK.run({
        websiteToken: '${websiteToken}',
        baseUrl: BASE_URL
      })
    }
  })(document,"script");
</script>`;
}

export async function getInbox(id: number): Promise<InboxDetail> {
  const res = await cwFetch<{ payload?: Record<string, unknown> } & Record<string, unknown>>(
    `/accounts/${aid()}/inboxes/${id}`,
  );
  const raw = (res.payload ?? res) as Record<string, unknown>;
  return mapInboxDetail(raw);
}

export async function createInbox(data: CreateInboxPayload): Promise<InboxDetail> {
  const validationError = validateCreateInboxPayload(data);
  if (validationError) {
    throw new Error(validationError);
  }

  if (data.channel.type === 'Channel::TwilioSms') {
    return createTwilioSmsInbox(data);
  }

  const body = buildChatwootCreateInboxBody(data);
  const res = await cwFetch<{ payload?: Record<string, unknown> } & Record<string, unknown>>(
    `/accounts/${aid()}/inboxes`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  const raw = (res.payload ?? res) as Record<string, unknown>;
  return mapInboxDetail(raw);
}

/** Chatwoot v4.x — Twilio SMS still uses the dedicated channels endpoint, not POST /inboxes. */
async function createTwilioSmsInbox(data: CreateInboxPayload): Promise<InboxDetail> {
  const { ...fields } = data.channel;
  const body = {
    twilio_channel: {
      name: data.name,
      medium: 'sms',
      account_sid: fields.account_sid,
      auth_token: fields.auth_token,
      phone_number: fields.phone_number,
      ...(fields.messaging_service_sid
        ? { messaging_service_sid: fields.messaging_service_sid }
        : {}),
      ...(fields.api_key_sid ? { api_key_sid: fields.api_key_sid } : {}),
    },
  };

  const res = await cwFetch<{ payload?: Record<string, unknown> } & Record<string, unknown>>(
    `/accounts/${aid()}/channels/twilio_channel`,
    {
      method: 'POST',
      body: JSON.stringify(body),
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
