import type { CWConversation } from '@/types';

const now = Math.floor(Date.now() / 1000);

export const DEMO_CONVERSATIONS: CWConversation[] = [
  {
    id: 42,
    status: 'open',
    inbox_id: 1,
    meta: { sender: { id: 101, name: 'Amina Al-Rashdi' } },
    last_activity_at: now - 300,
    created_at: now - 86400,
    unread_count: 2,
    labels: [],
    channel: 'Channel::Whatsapp',
  },
  {
    id: 55,
    status: 'pending',
    inbox_id: 2,
    meta: { sender: { id: 102, name: 'Mohammed Al-Saidi' }, assignee: { id: 1, name: 'Sara Al-Hinai' } },
    last_activity_at: now - 1200,
    created_at: now - 172800,
    unread_count: 0,
    labels: ['billing'],
    channel: 'Channel::Email',
  },
  {
    id: 61,
    status: 'open',
    inbox_id: 3,
    meta: { sender: { id: 103, name: 'Gulf Retail HQ' } },
    last_activity_at: now - 600,
    created_at: now - 3600,
    unread_count: 1,
    labels: [],
    channel: 'Channel::WebWidget',
  },
  {
    id: 88,
    status: 'resolved',
    inbox_id: 1,
    meta: { sender: { id: 107, name: 'Hamad Al-Kindi' } },
    last_activity_at: now - 90000,
    created_at: now - 500000,
    unread_count: 0,
    labels: ['vip'],
    channel: 'Channel::Whatsapp',
  },
];

export const DEMO_MESSAGES: Record<number, import('@/types').CWMessage[]> = {
  42: [
    {
      id: 1,
      content: 'السلام عليكم، أريد ترقية خط الألياف إلى 500 ميجا.',
      message_type: 0,
      content_type: 'text',
      created_at: now - 400,
      sender: { id: 101, name: 'Amina Al-Rashdi', type: 'contact' },
    },
    {
      id: 2,
      content: 'وعليكم السلام! يسعدنا مساعدتك. هل يمكنك إرسال رقم الحساب؟',
      message_type: 1,
      content_type: 'text',
      created_at: now - 350,
      sender: { id: 1, name: 'Sara', type: 'user' },
    },
  ],
  55: [
    {
      id: 3,
      content: 'I was charged twice on my March invoice.',
      message_type: 0,
      content_type: 'text',
      created_at: now - 1500,
      sender: { id: 102, name: 'Mohammed Al-Saidi', type: 'contact' },
    },
  ],
};

export function isFixtureConversationId(id: number): boolean {
  return DEMO_CONVERSATIONS.some(c => c.id === id);
}
