import { DEMO_CALLS } from '@/lib/demo/callsFixture';
import type { CDRRecord, IVRFlow, Queue, QueueStats, RoutingAgent } from '@/types';

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
    skills: ['support'],
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
    skills: ['sales'],
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

export const DEMO_CDR: CDRRecord[] = DEMO_CALLS.filter(c => c.status === 'ended' || c.status === 'missed').map(
  (c, i) => ({
    id: `cdr-${c.id}`,
    tenantId: c.tenantId,
    callSessionId: c.id,
    agentId: '2',
    direction: c.direction,
    transport: c.transport,
    duration: Math.round((c.durationMs ?? 120_000) / 1000),
    outcome: c.status === 'missed' ? 'missed' : 'completed',
    startedAt: c.startedAt,
  }),
);

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
      config: { queueKey: 'support' },
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
