import type { CallSession, CDRRecord, IVRFlow, Queue, QueueStats, RoutingAgent } from '@/types';

export const DEMO_CALLS: CallSession[] = [
  {
    id: 'demo-1',
    tenantId: '1',
    roomId: 'demo-1',
    channel: 'voice',
    agentLabel: 'Ahmed Al-Rashidi',
    customerPhone: '+96891234567',
    status: 'connected',
    direction: 'inbound',
    startedAt: new Date(Date.now() - 120_000).toISOString(),
    connectedAt: new Date(Date.now() - 115_000).toISOString(),
    transport: 'pstn',
  },
  {
    id: 'demo-2',
    tenantId: '1',
    roomId: 'demo-2',
    channel: 'voice',
    agentLabel: 'Mohammed Al-Balushi',
    customerPhone: '+96899876543',
    status: 'ringing',
    direction: 'inbound',
    startedAt: new Date(Date.now() - 15_000).toISOString(),
    transport: 'pstn',
  },
  {
    id: 'demo-ring-1',
    tenantId: '1',
    roomId: 'demo-ring-1',
    channel: 'voice',
    agentLabel: '',
    customerPhone: '+968 9211 4401',
    status: 'ringing',
    direction: 'inbound',
    startedAt: new Date().toISOString(),
    transport: 'whatsapp',
  },
  {
    id: 'demo-live-1',
    tenantId: '1',
    roomId: 'demo-live-1',
    channel: 'voice',
    agentLabel: 'Sarah Al-Hinai',
    customerPhone: '+968 9244 5512',
    status: 'connected',
    direction: 'inbound',
    startedAt: new Date(Date.now() - 240_000).toISOString(),
    connectedAt: new Date(Date.now() - 227_000).toISOString(),
    transport: 'whatsapp',
  },
  {
    id: 'demo-ended-1',
    tenantId: '1',
    roomId: 'demo-ended-1',
    channel: 'voice',
    agentLabel: '',
    customerPhone: '+968 9900 2211',
    status: 'ended',
    direction: 'inbound',
    startedAt: new Date(Date.now() - 1_200_000).toISOString(),
    endedAt: new Date(Date.now() - 720_000).toISOString(),
    durationMs: 151_000,
    transport: 'pstn',
  },
  {
    id: 'demo-missed-1',
    tenantId: '1',
    roomId: 'demo-missed-1',
    channel: 'voice',
    agentLabel: '',
    customerPhone: '+968 9211 xxxx',
    status: 'missed',
    direction: 'inbound',
    startedAt: new Date(Date.now() - 600_000).toISOString(),
    endedAt: new Date(Date.now() - 480_000).toISOString(),
    transport: 'pstn',
  },
];

const CALLER_NAMES: Record<string, string> = {
  'demo-1': 'Ahmed Al-Rashidi',
  'demo-2': 'Mohammed Al-Balushi',
  'demo-ring-1': 'Mohammed Al-Rashidi',
  'demo-live-1': 'Fatima Al-Zahraa',
  'demo-missed-1': 'Samir Al-Oman',
  'demo-ended-1': 'Khalid Hassan',
};

/** Display name for a CallSession in demo / UI. */
export function demoCallerName(session: Partial<CallSession>): string {
  if (session.id && CALLER_NAMES[session.id]) return CALLER_NAMES[session.id];
  return session.agentLabel || session.customerPhone || 'Unknown';
}

export const DEMO_AGENTS: RoutingAgent[] = [
  {
    id: 'a1',
    tenantId: '1',
    agentId: '2',
    name: 'Sarah Al-Hinai',
    state: 'busy',
    skills: ['support', 'whatsapp'],
    currentCallId: 'demo-live-1',
    lastStateChange: new Date().toISOString(),
  },
  {
    id: 'a2',
    tenantId: '1',
    agentId: '3',
    name: 'Omar Al-Kindi',
    state: 'available',
    skills: ['sales'],
    lastStateChange: new Date().toISOString(),
  },
  {
    id: 'a3',
    tenantId: '1',
    agentId: '4',
    name: 'Fatima Al-Zahraa',
    state: 'break',
    skills: ['billing'],
    lastStateChange: new Date().toISOString(),
  },
];

export const DEMO_QUEUES: Queue[] = [
  {
    id: 'q1',
    tenantId: '1',
    queueKey: 'support',
    name: 'Support',
    skills: [{ skill: 'support', required: true }],
    selectionAlgorithm: 'round_robin',
    maxWaitSec: 300,
    maxDepth: 50,
    stats: { waiting: 3, available: 2, busy: 1, avgWaitSec: 42, slaPercent: 94 },
  },
  {
    id: 'q2',
    tenantId: '1',
    queueKey: 'sales',
    name: 'Sales',
    skills: [{ skill: 'sales', required: true }],
    selectionAlgorithm: 'longest_idle',
    maxWaitSec: 180,
    maxDepth: 30,
    stats: { waiting: 1, available: 1, busy: 0, avgWaitSec: 18, slaPercent: 98 },
  },
];

export function demoQueueStats(): QueueStats {
  return DEMO_QUEUES.reduce(
    (acc, q) => ({
      waiting: acc.waiting + (q.stats?.waiting ?? 0),
      available: acc.available + (q.stats?.available ?? 0),
      busy: acc.busy + (q.stats?.busy ?? 0),
      avgWaitSec: Math.round((acc.avgWaitSec + (q.stats?.avgWaitSec ?? 0)) / 2),
      slaPercent: Math.round((acc.slaPercent + (q.stats?.slaPercent ?? 0)) / 2),
    }),
    { waiting: 0, available: 0, busy: 0, avgWaitSec: 0, slaPercent: 0 },
  );
}

export const DEMO_CDR: CDRRecord[] = [
  {
    id: 'cdr-1',
    tenantId: '1',
    callSessionId: 'demo-ended-1',
    agentId: '2',
    direction: 'inbound',
    transport: 'pstn',
    duration: 245,
    outcome: 'answered',
    startedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: 'cdr-2',
    tenantId: '1',
    callSessionId: 'demo-1',
    agentId: '2',
    direction: 'outbound',
    transport: 'pstn',
    duration: 132,
    outcome: 'completed',
    startedAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
  {
    id: 'cdr-3',
    tenantId: '1',
    callSessionId: 'demo-missed-1',
    agentId: '2',
    direction: 'inbound',
    transport: 'whatsapp',
    duration: 0,
    outcome: 'missed',
    startedAt: new Date(Date.now() - 10_800_000).toISOString(),
  },
];

export const DEMO_IVR_FLOW: IVRFlow = {
  id: 'flow-demo-1',
  tenantId: '1',
  name: 'Main IVR — LABBIK',
  description: 'Welcome + queue routing',
  version: 3,
  isActive: true,
  nodes: [
    {
      id: 'n1',
      type: 'play',
      label: 'Welcome',
      config: { text: 'Welcome to LABBIK Telecom' },
      position: { x: 80, y: 60 },
    },
    {
      id: 'n2',
      type: 'dtmf',
      label: 'Main menu',
      config: { prompt: 'Press 1 for support, 2 for sales' },
      position: { x: 280, y: 60 },
    },
    {
      id: 'n3',
      type: 'transfer',
      label: 'Route to Support',
      config: {
        queueKey: 'support',
        // IVR1: demo skill requirement — route only to agents with arabic skill
        skillRequirements: [{ skill: 'arabic', required: true }],
      },
      position: { x: 480, y: 40 },
    },
    {
      id: 'n4',
      type: 'hangup',
      label: 'Goodbye',
      config: {},
      position: { x: 480, y: 140 },
    },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3', label: '1' },
    { id: 'e3', source: 'n2', target: 'n4', label: '9' },
  ],
};
