import type { CallSession } from '@/types';

/** Demo rows when calls API is unavailable (matches blinkone_calling_inbox.html). */
export const DEMO_CALLS: CallSession[] = [
  {
    id: 'demo-ring-1',
    tenantId: '1',
    roomId: 'demo-ring-1',
    channel: 'voice',
    agentLabel: '',
    customerPhone: '+968 9211 4401',
    status: 'ringing',
    transport: 'whatsapp',
    direction: 'inbound',
    startedAt: new Date().toISOString(),
  },
  {
    id: 'demo-live-1',
    tenantId: '1',
    roomId: 'demo-live-1',
    channel: 'voice',
    agentLabel: 'Sarah Al-Hinai',
    customerPhone: '+968 9244 5512',
    status: 'connected',
    transport: 'whatsapp',
    direction: 'inbound',
    startedAt: new Date(Date.now() - 240_000).toISOString(),
    connectedAt: new Date(Date.now() - 227_000).toISOString(),
  },
  {
    id: 'demo-missed-1',
    tenantId: '1',
    roomId: 'demo-missed-1',
    channel: 'voice',
    agentLabel: '',
    customerPhone: '+968 9211 xxxx',
    status: 'missed',
    transport: 'pstn',
    direction: 'inbound',
    startedAt: new Date(Date.now() - 600_000).toISOString(),
    endedAt: new Date(Date.now() - 480_000).toISOString(),
  },
  {
    id: 'demo-ended-1',
    tenantId: '1',
    roomId: 'demo-ended-1',
    channel: 'voice',
    agentLabel: '',
    customerPhone: '+968 9900 2211',
    status: 'ended',
    transport: 'pstn',
    direction: 'inbound',
    startedAt: new Date(Date.now() - 1_200_000).toISOString(),
    endedAt: new Date(Date.now() - 720_000).toISOString(),
    durationMs: 151_000,
  },
];

export function demoCallerName(call: CallSession): string {
  const names: Record<string, string> = {
    'demo-ring-1': 'Mohammed Al-Rashidi',
    'demo-live-1': 'Fatima Al-Zahraa',
    'demo-missed-1': 'Samir Al-Oman',
    'demo-ended-1': 'Khalid Hassan',
  };
  return names[call.id] ?? call.customerPhone;
}
