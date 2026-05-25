import type {
  AccountSettings,
  Agent,
  Team,
  Label,
  CustomAttribute,
  AutomationRule,
  AgentBot,
  Macro,
  CannedResponse,
  CWWebhook,
  CWProfile,
  BusinessHourEntry,
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
  {
    id: 1,
    name: 'Ahmed Al-Rashidi',
    email: 'ahmed@labbik.om',
    role: 'administrator',
    availability_status: 'online',
    confirmed: true,
  },
  {
    id: 2,
    name: 'Sara Al-Balushi',
    email: 'sara@labbik.om',
    role: 'agent',
    availability_status: 'busy',
    confirmed: true,
  },
  {
    id: 3,
    name: 'Mohammed Al-Farsi',
    email: 'mohammed@labbik.om',
    role: 'agent',
    availability_status: 'offline',
    confirmed: true,
  },
  {
    id: 4,
    name: 'Fatima Al-Zaabi',
    email: 'fatima@labbik.om',
    role: 'agent',
    availability_status: 'online',
    confirmed: false,
  },
  {
    id: 5,
    name: 'Khalid Al-Nabhani',
    email: 'khalid@labbik.om',
    role: 'administrator',
    availability_status: 'online',
    confirmed: true,
  },
];

export const DEMO_TEAMS: Team[] = [
  { id: 1, name: 'Support', description: 'General customer support', agents_count: 3 },
  { id: 2, name: 'Sales', description: 'Sales and new accounts', agents_count: 2 },
  { id: 3, name: 'Billing', description: 'Billing and payments queries', agents_count: 2 },
];

export const DEMO_TEAM_MEMBERS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [1, 4],
  3: [2, 5],
};

export const DEMO_LABELS: Label[] = [
  { id: 1, title: 'billing', description: 'Billing related', color: '#F59E0B', show_on_sidebar: true },
  { id: 2, title: 'vip', description: 'VIP customer', color: '#8B5CF6', show_on_sidebar: true },
  { id: 3, title: 'technical', description: 'Technical issues', color: '#0B5FFF', show_on_sidebar: true },
  { id: 4, title: 'sales', description: 'Sales opportunity', color: '#10B981', show_on_sidebar: false },
  { id: 5, title: 'urgent', description: 'Needs urgent action', color: '#EF4444', show_on_sidebar: true },
];

export const DEMO_CUSTOM_ATTRS: CustomAttribute[] = [
  {
    id: 1,
    attribute_display_name: 'Account Number',
    attribute_key: 'account_number',
    attribute_display_type: 'text',
    attribute_model: 'contact_attribute',
  },
  {
    id: 2,
    attribute_display_name: 'Plan Type',
    attribute_key: 'plan_type',
    attribute_display_type: 'list',
    attribute_model: 'contact_attribute',
    attribute_values: ['Basic', 'Pro', 'Enterprise'],
  },
  {
    id: 3,
    attribute_display_name: 'CSAT Score',
    attribute_key: 'csat_score',
    attribute_display_type: 'number',
    attribute_model: 'conversation_attribute',
  },
  {
    id: 4,
    attribute_display_name: 'Issue Category',
    attribute_key: 'issue_category',
    attribute_display_type: 'list',
    attribute_model: 'conversation_attribute',
    attribute_values: ['Billing', 'Technical', 'Other'],
  },
];

export const DEMO_AUTOMATIONS: AutomationRule[] = [
  {
    id: 1,
    name: 'Auto-assign VIP conversations',
    description: 'Assign conversations from VIP contacts to the senior support team',
    event_name: 'conversation_created',
    active: true,
    conditions: [
      { attribute_key: 'label', filter_operator: 'contains', values: ['vip'], query_operator: null },
    ],
    actions: [{ action_name: 'assign_team', action_params: [1] }],
  },
  {
    id: 2,
    name: 'Auto-resolve idle conversations',
    description: 'Resolve conversations that have been idle for 24 hours',
    event_name: 'conversation_updated',
    active: true,
    conditions: [
      { attribute_key: 'status', filter_operator: 'equal_to', values: ['open'], query_operator: null },
    ],
    actions: [{ action_name: 'resolve_conversation', action_params: [] }],
  },
  {
    id: 3,
    name: 'WhatsApp language routing',
    description: 'Route Arabic WhatsApp messages to Arabic-speaking agents',
    event_name: 'conversation_created',
    active: false,
    conditions: [
      { attribute_key: 'inbox_id', filter_operator: 'equal_to', values: ['1'], query_operator: null },
    ],
    actions: [{ action_name: 'assign_team', action_params: [3] }],
  },
];

export const DEMO_BOTS: AgentBot[] = [
  {
    id: 1,
    name: 'BlinkBot',
    description: 'AI-powered support bot',
    outgoing_url: 'https://ai.labbik.om/hook',
    bot_type: 'agent_ai',
  },
  {
    id: 2,
    name: 'FAQ Webhook',
    description: 'FAQ lookup via external API',
    outgoing_url: 'https://api.labbik.om/faq',
    bot_type: 'webhook',
  },
];

export const DEMO_MACROS: Macro[] = [
  {
    id: 1,
    name: 'Resolve and Thank',
    visibility: 'global',
    actions: [
      {
        action: 'send_message',
        action_params: ['Thank you for contacting LABBIK support. Your issue has been resolved!'],
      },
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
      { action: 'assign_team', action_params: [3] },
      { action: 'add_label', action_params: ['billing'] },
      {
        action: 'send_message',
        action_params: ['I am transferring you to our Billing team who will assist you shortly.'],
      },
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
  {
    id: 1,
    short_code: 'greet',
    content: 'Hello! Thank you for contacting LABBIK Telecom. How can I help you today?',
  },
  {
    id: 2,
    short_code: 'hold',
    content: 'Please hold while I look into this for you. I will be right back!',
  },
  {
    id: 3,
    short_code: 'thanks',
    content: 'Thank you for your patience. Is there anything else I can help you with?',
  },
  {
    id: 4,
    short_code: 'close',
    content: 'Glad we could resolve this for you. Have a wonderful day!',
  },
  {
    id: 5,
    short_code: 'billing',
    content: 'I will transfer you to our Billing team. They will assist you within minutes.',
  },
  {
    id: 6,
    short_code: 'sorry',
    content: 'I sincerely apologize for the inconvenience. Let me look into this right away.',
  },
];

export async function settingsDemoDelay(ms = 300): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export const DEMO_WEBHOOKS: CWWebhook[] = [
  {
    id: 1,
    url: 'https://n8n.labbik.om/webhook/blinkone',
    subscriptions: ['conversation_created', 'conversation_status_changed', 'message_created'],
  },
  {
    id: 2,
    url: 'https://hooks.zapier.com/hooks/catch/12345/abcde',
    subscriptions: ['conversation_resolved'],
  },
];

export const DEMO_PROFILE: CWProfile = {
  id: 1,
  name: 'Ahmed Al-Rashidi',
  email: 'ahmed@labbik.om',
  phone_number: '+96891234567',
  avatar_url: undefined,
  availability_status: 'online',
  display_name: 'Ahmed',
};

export const DEMO_NOTIFICATION_PREFS = {
  selected_email_flags: ['conversation_creation', 'conversation_assignment', 'conversation_mention'],
  selected_push_flags: ['conversation_creation', 'conversation_assignment'],
};

export const DEMO_BUSINESS_HOURS: BusinessHourEntry[] = [
  {
    day_of_week: 0,
    name: 'Sunday',
    closed_all_day: true,
    open_hour: 9,
    open_minutes: 0,
    close_hour: 18,
    close_minutes: 0,
  },
  {
    day_of_week: 1,
    name: 'Monday',
    closed_all_day: false,
    open_hour: 9,
    open_minutes: 0,
    close_hour: 18,
    close_minutes: 0,
  },
  {
    day_of_week: 2,
    name: 'Tuesday',
    closed_all_day: false,
    open_hour: 9,
    open_minutes: 0,
    close_hour: 18,
    close_minutes: 0,
  },
  {
    day_of_week: 3,
    name: 'Wednesday',
    closed_all_day: false,
    open_hour: 9,
    open_minutes: 0,
    close_hour: 18,
    close_minutes: 0,
  },
  {
    day_of_week: 4,
    name: 'Thursday',
    closed_all_day: false,
    open_hour: 9,
    open_minutes: 0,
    close_hour: 18,
    close_minutes: 0,
  },
  {
    day_of_week: 5,
    name: 'Friday',
    closed_all_day: false,
    open_hour: 9,
    open_minutes: 0,
    close_hour: 17,
    close_minutes: 0,
  },
  {
    day_of_week: 6,
    name: 'Saturday',
    closed_all_day: true,
    open_hour: 9,
    open_minutes: 0,
    close_hour: 13,
    close_minutes: 0,
  },
];
