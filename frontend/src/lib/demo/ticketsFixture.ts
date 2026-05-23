import type { TicketMessageView, TicketTeam, TicketView } from '@/lib/utils/tickets';

export const DEMO_TICKET_AGENTS = [
  { id: 'agent-1', name: 'Sara Al-Hinai' },
  { id: 'agent-2', name: 'Khalid Al-Balushi' },
  { id: 'agent-3', name: 'Fatima Al-Lawati' },
];

const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60000).toISOString();
const ahead = (mins: number) => new Date(now + mins * 60000).toISOString();
const past = (mins: number) => new Date(now - mins * 60000).toISOString();

export const DEMO_TICKETS: TicketView[] = [
  {
    id: 'tkt-1001',
    displayId: 'TKT-1001',
    subject: 'Fiber 500 upgrade request — Al Khoud',
    status: 'open',
    priority: 'high',
    contactId: 101,
    contactName: 'Amina Al-Rashdi',
    assigneeId: 'agent-1',
    assigneeName: 'Sara Al-Hinai',
    team: 'support',
    slaTier: 'Gold',
    slaDeadline: ahead(45),
    inboxType: 'WhatsApp',
    conversationId: 42,
    createdAt: ago(120),
    updatedAt: ago(8),
  },
  {
    id: 'tkt-1002',
    displayId: 'TKT-1002',
    subject: 'Invoice dispute — March billing cycle',
    status: 'pending',
    priority: 'high',
    contactId: 102,
    contactName: 'Mohammed Al-Saidi',
    assigneeId: 'agent-2',
    assigneeName: 'Khalid Al-Balushi',
    team: 'billing',
    slaTier: 'Silver',
    slaDeadline: past(30),
    inboxType: 'Email',
    conversationId: 55,
    createdAt: ago(300),
    updatedAt: ago(25),
  },
  {
    id: 'tkt-1003',
    displayId: 'TKT-1003',
    subject: 'Enterprise plan quote for new branch',
    status: 'open',
    priority: 'medium',
    contactId: 103,
    contactName: 'Gulf Retail HQ',
    assigneeId: 'agent-3',
    assigneeName: 'Fatima Al-Lawati',
    team: 'sales',
    slaTier: 'Gold',
    slaDeadline: ahead(180),
    inboxType: 'Web chat',
    conversationId: 61,
    createdAt: ago(90),
    updatedAt: ago(40),
  },
  {
    id: 'tkt-1004',
    displayId: 'TKT-1004',
    subject: 'Router keeps disconnecting after firmware update',
    status: 'open',
    priority: 'medium',
    contactId: 104,
    contactName: 'Yusuf Al-Habsi',
    assigneeId: 'agent-1',
    assigneeName: 'Sara Al-Hinai',
    team: 'support',
    slaTier: 'Bronze',
    slaDeadline: ahead(90),
    inboxType: 'Phone',
    createdAt: ago(200),
    updatedAt: ago(55),
  },
  {
    id: 'tkt-1005',
    displayId: 'TKT-1005',
    subject: 'Refund request — duplicate OMR charge',
    status: 'resolved',
    priority: 'low',
    contactId: 105,
    contactName: 'Layla Al-Mamari',
    assigneeId: 'agent-2',
    assigneeName: 'Khalid Al-Balushi',
    team: 'billing',
    slaTier: 'Silver',
    slaDeadline: past(500),
    inboxType: 'Email',
    createdAt: ago(2000),
    updatedAt: ago(300),
  },
  {
    id: 'tkt-1006',
    displayId: 'TKT-1006',
    subject: 'WhatsApp Business API onboarding',
    status: 'open',
    priority: 'low',
    contactId: 106,
    contactName: 'TechStart Oman',
    team: 'sales',
    slaTier: 'Bronze',
    slaDeadline: ahead(360),
    inboxType: 'WhatsApp',
    createdAt: ago(60),
    updatedAt: ago(15),
  },
  {
    id: 'tkt-1007',
    displayId: 'TKT-1007',
    subject: 'SLA breach follow-up — VIP customer',
    status: 'pending',
    priority: 'high',
    contactId: 107,
    contactName: 'Hamad Al-Kindi',
    assigneeId: 'agent-1',
    assigneeName: 'Sara Al-Hinai',
    team: 'support',
    slaTier: 'Platinum',
    slaDeadline: past(10),
    inboxType: 'WhatsApp',
    conversationId: 88,
    createdAt: ago(400),
    updatedAt: ago(5),
  },
  {
    id: 'tkt-1008',
    displayId: 'TKT-1008',
    subject: 'Change billing contact email',
    status: 'resolved',
    priority: 'medium',
    contactId: 108,
    contactName: 'Nawal Al-Busaidi',
    assigneeId: 'agent-3',
    assigneeName: 'Fatima Al-Lawati',
    team: 'billing',
    slaTier: 'Silver',
    slaDeadline: past(800),
    inboxType: 'Email',
    createdAt: ago(5000),
    updatedAt: ago(800),
  },
];

export const DEMO_TICKET_MESSAGES: Record<string, TicketMessageView[]> = {
  'tkt-1001': [
    {
      id: 'm1',
      authorName: 'Amina Al-Rashdi',
      direction: 'inbound',
      content: 'السلام عليكم، أريد ترقية خط الألياف إلى 500 ميجا في منطقة الخوض.',
      createdAt: ago(110),
    },
    {
      id: 'm2',
      authorName: 'Sara Al-Hinai',
      direction: 'outbound',
      content:
        'وعليكم السلام أختي أمينة، يسعدنا مساعدتك. هل يمكنك إرسال رقم الحساب أو رقم الهاتف المسجل؟',
      createdAt: ago(95),
    },
    {
      id: 'm3',
      authorName: 'Amina Al-Rashdi',
      direction: 'inbound',
      content: 'رقم الحساب 88421. العنوان شارع الخوض 12.',
      createdAt: ago(80),
    },
  ],
  'tkt-1002': [
    {
      id: 'm1',
      authorName: 'Mohammed Al-Saidi',
      direction: 'inbound',
      content: 'I was charged twice for March. Please investigate invoice #INV-4421.',
      createdAt: ago(280),
    },
    {
      id: 'm2',
      authorName: 'Khalid Al-Balushi',
      direction: 'outbound',
      content: 'Thank you Mohammed. We are reviewing the billing ledger and will update you within 4 hours.',
      createdAt: ago(260),
    },
  ],
  'tkt-1007': [
    {
      id: 'm1',
      authorName: 'Hamad Al-Kindi',
      direction: 'inbound',
      content: 'Still waiting for a supervisor callback. This is unacceptable for a platinum account.',
      createdAt: ago(20),
    },
  ],
};

export function demoMessagesFor(ticketId: string): TicketMessageView[] {
  return DEMO_TICKET_MESSAGES[ticketId] ?? [
    {
      id: 'm-default',
      authorName: 'System',
      direction: 'outbound',
      content: 'Ticket created. No messages yet.',
      createdAt: new Date().toISOString(),
    },
  ];
}

export function teamLabel(team: TicketTeam): string {
  const labels: Record<TicketTeam, string> = {
    sales: 'Sales',
    support: 'Support',
    billing: 'Billing',
  };
  return labels[team];
}
