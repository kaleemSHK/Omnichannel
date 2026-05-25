import type { CWInbox } from '@/types';

export const DEMO_INBOXES: CWInbox[] = [
  {
    id: 1,
    name: 'WhatsApp Support',
    channel_type: 'Channel::Whatsapp',
    working_hours_enabled: true,
  },
  {
    id: 2,
    name: 'Email Billing',
    channel_type: 'Channel::Email',
    working_hours_enabled: true,
  },
  {
    id: 3,
    name: 'Web Chat',
    channel_type: 'Channel::WebWidget',
    working_hours_enabled: false,
  },
  {
    id: 4,
    name: 'SMS Alerts',
    channel_type: 'Channel::TwilioSms',
    working_hours_enabled: true,
  },
  {
    id: 5,
    name: 'Voice / SIP',
    channel_type: 'Channel::Voice',
    working_hours_enabled: true,
  },
];
