import type { CWConversation, CWMessage } from '@/types';
import { isDemoDataEnabled } from '@/lib/demo/config';

const FIXTURE_IDS = new Set([1, 2, 3, 4, 5]);

/** Demo fixture IDs only apply when demo mode is on — never block live API for real conv #1–5. */
export function isFixtureConversationId(id: number): boolean {
  return isDemoDataEnabled() && FIXTURE_IDS.has(id);
}

const ts = () => Math.floor(Date.now() / 1000);

export const DEMO_CONVERSATIONS: CWConversation[] = [
  {
    id: 1,
    status: 'open',
    inbox_id: 1,
    meta: {
      sender: { id: 101, name: 'Ahmed Al-Rashidi' },
      assignee: { id: 1, name: 'Agent Demo' },
    },
    last_activity_at: ts() - 300,
    created_at: ts() - 86400,
    unread_count: 2,
    labels: ['enterprise'],
    channel: 'Channel::Whatsapp',
  },
  {
    id: 2,
    status: 'open',
    inbox_id: 2,
    meta: { sender: { id: 102, name: 'Fatima Hassan' } },
    last_activity_at: ts() - 1800,
    created_at: ts() - 172800,
    unread_count: 0,
    labels: ['professional'],
    channel: 'Channel::Email',
  },
  {
    id: 3,
    status: 'pending',
    inbox_id: 1,
    meta: { sender: { id: 103, name: 'Mohammed Al-Balushi' } },
    last_activity_at: ts() - 7200,
    created_at: ts() - 259200,
    unread_count: 1,
    labels: [],
    channel: 'Channel::Whatsapp',
  },
  {
    id: 4,
    status: 'resolved',
    inbox_id: 3,
    meta: {
      sender: { id: 104, name: 'Sara Al-Zadjali' },
      assignee: { id: 1, name: 'Agent Demo' },
    },
    last_activity_at: ts() - 86400,
    created_at: ts() - 432000,
    unread_count: 0,
    labels: ['starter'],
    channel: 'Channel::Api',
  },
  {
    id: 5,
    status: 'open',
    inbox_id: 2,
    meta: { sender: { id: 105, name: 'Khalid Nasser' } },
    last_activity_at: ts() - 60,
    created_at: ts() - 3600,
    unread_count: 3,
    labels: ['enterprise'],
    channel: 'Channel::Email',
  },
];

export const DEMO_MESSAGES: Record<number, CWMessage[]> = {
  1: [
    {
      id: 1001,
      content: 'Hello, I need help with my fiber plan.',
      message_type: 0,
      content_type: 'text',
      created_at: ts() - 600,
      sender: { id: 101, name: 'Ahmed Al-Rashidi', type: 'contact' },
    },
    {
      id: 1002,
      content: 'Of course! What plan are you currently on?',
      message_type: 1,
      content_type: 'text',
      created_at: ts() - 540,
      sender: { id: 1, name: 'Agent Demo', type: 'user' },
    },
    {
      id: 1003,
      content: 'I am on the 100Mbps plan, but I want to upgrade.',
      message_type: 0,
      content_type: 'text',
      created_at: ts() - 300,
      sender: { id: 101, name: 'Ahmed Al-Rashidi', type: 'contact' },
    },
  ],
  2: [
    {
      id: 2001,
      content: 'Can you check my invoice for last month?',
      message_type: 0,
      content_type: 'text',
      created_at: ts() - 3600,
      sender: { id: 102, name: 'Fatima Hassan', type: 'contact' },
    },
    {
      id: 2002,
      content: 'Checking your account now...',
      message_type: 1,
      content_type: 'text',
      created_at: ts() - 3500,
      sender: { id: 1, name: 'Agent Demo', type: 'user' },
    },
    {
      id: 2003,
      content: 'Customer note: escalate if billing issue persists',
      message_type: 1,
      content_type: 'private_note',
      created_at: ts() - 3400,
      sender: { id: 1, name: 'Agent Demo', type: 'user' },
    },
  ],
  3: [
    {
      id: 3001,
      content: 'مرحبا، أريد الاستفسار عن الخدمة',
      message_type: 0,
      content_type: 'text',
      created_at: ts() - 7200,
      sender: { id: 103, name: 'Mohammed Al-Balushi', type: 'contact' },
    },
    {
      id: 3002,
      content: 'أهلاً! كيف يمكنني مساعدتك؟',
      message_type: 1,
      content_type: 'text',
      created_at: ts() - 7100,
      sender: { id: 1, name: 'Agent Demo', type: 'user' },
    },
  ],
  4: [
    {
      id: 4001,
      content: 'Issue resolved, thank you!',
      message_type: 1,
      content_type: 'text',
      created_at: ts() - 86400,
      sender: { id: 1, name: 'Agent Demo', type: 'user' },
    },
  ],
  5: [
    {
      id: 5001,
      content: 'Urgent: service outage affecting our team',
      message_type: 0,
      content_type: 'text',
      created_at: ts() - 180,
      sender: { id: 105, name: 'Khalid Nasser', type: 'contact' },
    },
    {
      id: 5002,
      content: 'I am looking into this right now.',
      message_type: 1,
      content_type: 'text',
      created_at: ts() - 120,
      sender: { id: 1, name: 'Agent Demo', type: 'user' },
    },
    {
      id: 5003,
      content: 'Can you confirm which services are down?',
      message_type: 1,
      content_type: 'text',
      created_at: ts() - 60,
      sender: { id: 1, name: 'Agent Demo', type: 'user' },
    },
  ],
};
