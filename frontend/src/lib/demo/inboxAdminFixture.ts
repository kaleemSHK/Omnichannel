import type { InboxDetail, InboxMember, WorkingHoursDay } from '@/lib/api/inboxes';

export const DEMO_INBOX_DETAILS: Record<number, InboxDetail> = {
  1: {
    id: 1,
    name: 'WhatsApp Support',
    channel_type: 'Channel::Whatsapp',
    working_hours_enabled: true,
    greeting_message: 'Welcome to BlinkOne support! How can we help you today?',
    away_message: 'We are currently away. Our business hours are 9AM–6PM Sun–Thu.',
    auto_assignment: true,
    csat_survey_enabled: true,
    whatsapp_api_key: '••••••••••••',
  },
  2: {
    id: 2,
    name: 'Email Billing',
    channel_type: 'Channel::Email',
    working_hours_enabled: true,
    greeting_message: 'Thanks for reaching out to Billing.',
    away_message: 'We have received your email and will respond within 1 business day.',
    auto_assignment: false,
    csat_survey_enabled: true,
    email: 'billing@labbik.om',
  },
  3: {
    id: 3,
    name: 'Web Chat',
    channel_type: 'Channel::WebWidget',
    working_hours_enabled: false,
    greeting_message: 'Hi there! Ask us anything.',
    auto_assignment: true,
    csat_survey_enabled: false,
    widget_color: '#3B82F6',
    welcome_title: 'BlinkOne Support',
    welcome_tagline: 'We typically reply within a few minutes.',
  },
  4: {
    id: 4,
    name: 'SMS Alerts',
    channel_type: 'Channel::TwilioSms',
    working_hours_enabled: true,
    auto_assignment: false,
    csat_survey_enabled: false,
    phone_number: '+96891234567',
  },
  5: {
    id: 5,
    name: 'Voice / SIP',
    channel_type: 'Channel::Voice',
    working_hours_enabled: true,
    auto_assignment: true,
    csat_survey_enabled: false,
    sip_extension: '100',
  },
};

export const DEMO_ALL_AGENTS: InboxMember[] = [
  { id: 1, name: 'Ahmed Al-Rashidi', email: 'ahmed@labbik.om', role: 'agent', availability_status: 'online' },
  { id: 2, name: 'Sara Al-Balushi', email: 'sara@labbik.om', role: 'supervisor', availability_status: 'busy' },
  { id: 3, name: 'Mohammed Al-Farsi', email: 'mohammed@labbik.om', role: 'agent', availability_status: 'offline' },
  { id: 4, name: 'Fatima Al-Zaabi', email: 'fatima@labbik.om', role: 'agent', availability_status: 'online' },
  { id: 5, name: 'Khalid Al-Nabhani', email: 'khalid@labbik.om', role: 'admin', availability_status: 'online' },
];

export const DEMO_INBOX_MEMBERS: Record<number, InboxMember[]> = {
  1: [DEMO_ALL_AGENTS[0], DEMO_ALL_AGENTS[1]],
  2: [DEMO_ALL_AGENTS[1], DEMO_ALL_AGENTS[4]],
  3: [DEMO_ALL_AGENTS[0], DEMO_ALL_AGENTS[2], DEMO_ALL_AGENTS[3]],
  4: [DEMO_ALL_AGENTS[4]],
  5: [DEMO_ALL_AGENTS[0], DEMO_ALL_AGENTS[1], DEMO_ALL_AGENTS[2]],
};

function defaultHours(): WorkingHoursDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map(d => ({
    day_of_week: d,
    closed_all_day: d === 5 || d === 6,
    open_hour: 9,
    open_minutes: 0,
    close_hour: 18,
    close_minutes: 0,
  }));
}

export const DEMO_WORKING_HOURS: Record<number, WorkingHoursDay[]> = {
  1: defaultHours(),
  2: defaultHours(),
  3: [0, 1, 2, 3, 4, 5, 6].map(d => ({
    day_of_week: d,
    closed_all_day: false,
    open_hour: 0,
    open_minutes: 0,
    close_hour: 23,
    close_minutes: 59,
  })),
  4: defaultHours(),
  5: defaultHours(),
};
