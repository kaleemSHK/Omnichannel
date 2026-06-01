/**
 * Rich demo data for the wallboard — more realistic than the calling fixture.
 * Includes: per-agent call durations, state durations, handled counts, skills,
 * queue SLA %, utilization, and recent call history per queue for sparklines.
 */

import type { RoutingAgent } from '@/types';
import type { QueueStatEntry, RealtimeDashboard } from '@/lib/hooks/useRealtimeWallboard';

const now = Date.now();
const ago = (ms: number) => new Date(now - ms).toISOString();

export interface ExtendedAgent extends RoutingAgent {
  handledToday: number;
  missedToday: number;
  avgHandleTimeSec: number;
  extension?: string;
}

export interface ExtendedQueue extends QueueStatEntry {
  slaPercent: number;
  maxDepth: number;
  avgHandleTimeSec: number;
  answeredToday: number;
  abandonedToday: number;
  algorithm: string;
  waitTrend: number[]; // last 8 ticks
}

export const DEMO_WALLBOARD_AGENTS: ExtendedAgent[] = [
  {
    id: 'a1', tenantId: '1', agentId: '2',
    name: 'Sarah Al-Hinai',
    state: 'busy',
    skills: ['support', 'arabic', 'whatsapp'],
    currentCallId: 'call-001',
    lastStateChange: ago(4 * 60_000 + 12_000), // busy for 4m12s
    handledToday: 18, missedToday: 1, avgHandleTimeSec: 285, extension: '201',
    queueKeys: ['support'],
  },
  {
    id: 'a2', tenantId: '1', agentId: '3',
    name: 'Omar Al-Kindi',
    state: 'available',
    skills: ['sales', 'english'],
    currentCallId: undefined,
    lastStateChange: ago(8 * 60_000),
    handledToday: 12, missedToday: 0, avgHandleTimeSec: 210, extension: '202',
    queueKeys: ['sales'],
  },
  {
    id: 'a3', tenantId: '1', agentId: '4',
    name: 'Fatima Al-Zahraa',
    state: 'break',
    skills: ['billing', 'arabic'],
    currentCallId: undefined,
    lastStateChange: ago(7 * 60_000 + 30_000),
    handledToday: 9, missedToday: 2, avgHandleTimeSec: 340, extension: '203',
    queueKeys: ['billing'],
  },
  {
    id: 'a4', tenantId: '1', agentId: '5',
    name: 'Ahmed Al-Rashidi',
    state: 'busy',
    skills: ['support', 'technical'],
    currentCallId: 'call-002',
    lastStateChange: ago(1 * 60_000 + 44_000),
    handledToday: 14, missedToday: 0, avgHandleTimeSec: 195, extension: '204',
    queueKeys: ['support', 'technical'],
  },
  {
    id: 'a5', tenantId: '1', agentId: '6',
    name: 'Mohammed Al-Balushi',
    state: 'acw',
    skills: ['support'],
    currentCallId: undefined,
    lastStateChange: ago(55_000),
    handledToday: 11, missedToday: 1, avgHandleTimeSec: 260, extension: '205',
    queueKeys: ['support'],
  },
  {
    id: 'a6', tenantId: '1', agentId: '7',
    name: 'Layla Hassan',
    state: 'available',
    skills: ['sales', 'arabic', 'whatsapp'],
    currentCallId: undefined,
    lastStateChange: ago(3 * 60_000),
    handledToday: 16, missedToday: 0, avgHandleTimeSec: 178, extension: '206',
    queueKeys: ['sales'],
  },
  {
    id: 'a7', tenantId: '1', agentId: '8',
    name: 'Khalid Ibrahim',
    state: 'offline',
    skills: ['billing', 'english'],
    currentCallId: undefined,
    lastStateChange: ago(45 * 60_000),
    handledToday: 6, missedToday: 0, avgHandleTimeSec: 220, extension: '207',
    queueKeys: ['billing'],
  },
  {
    id: 'a8', tenantId: '1', agentId: '9',
    name: 'Noura Al-Said',
    state: 'busy',
    skills: ['support', 'arabic'],
    currentCallId: 'call-003',
    lastStateChange: ago(2 * 60_000 + 5_000),
    handledToday: 20, missedToday: 0, avgHandleTimeSec: 230, extension: '208',
    queueKeys: ['support'],
  },
];

export const DEMO_WALLBOARD_QUEUES: ExtendedQueue[] = [
  {
    id: 'q1', queueKey: 'support', name: 'Support',
    waiting: 4, active: 3, longestWait: 98,
    slaPercent: 87, maxDepth: 50, avgHandleTimeSec: 265,
    answeredToday: 72, abandonedToday: 3, algorithm: 'round_robin',
    waitTrend: [2, 3, 5, 4, 6, 4, 3, 4],
  },
  {
    id: 'q2', queueKey: 'sales', name: 'Sales',
    waiting: 1, active: 2, longestWait: 32,
    slaPercent: 96, maxDepth: 30, avgHandleTimeSec: 195,
    answeredToday: 34, abandonedToday: 0, algorithm: 'longest_idle',
    waitTrend: [1, 0, 1, 2, 1, 1, 0, 1],
  },
  {
    id: 'q3', queueKey: 'billing', name: 'Billing',
    waiting: 2, active: 1, longestWait: 55,
    slaPercent: 78, maxDepth: 40, avgHandleTimeSec: 310,
    answeredToday: 18, abandonedToday: 2, algorithm: 'best_match',
    waitTrend: [1, 2, 3, 2, 2, 3, 2, 2],
  },
  {
    id: 'q4', queueKey: 'technical', name: 'Technical',
    waiting: 0, active: 1, longestWait: 0,
    slaPercent: 94, maxDepth: 20, avgHandleTimeSec: 420,
    answeredToday: 8, abandonedToday: 0, algorithm: 'round_robin',
    waitTrend: [0, 1, 0, 0, 1, 0, 0, 0],
  },
];

export function getDemoWallboard(): RealtimeDashboard {
  const agents = DEMO_WALLBOARD_AGENTS as RoutingAgent[];
  const queues = DEMO_WALLBOARD_QUEUES;
  const handledToday = agents.reduce((s, a) => s + (a as ExtendedAgent).handledToday, 0);
  const missedToday = agents.reduce((s, a) => s + (a as ExtendedAgent).missedToday, 0);
  return {
    agents,
    queues,
    handledToday,
    missedToday,
    totalToday: handledToday + missedToday,
    updatedAt: new Date().toISOString(),
  };
}
