'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import type { AgentState, RoutingAgent } from '@/types';

export interface QueueStatEntry {
  id: string;
  queueKey?: string;
  name: string;
  waiting: number;
  active: number;
  longestWait: number;
}

export interface RealtimeDashboard {
  agents: RoutingAgent[];
  queues: QueueStatEntry[];
  handledToday: number;
  missedToday: number;
  totalToday: number;
  updatedAt: string;
}

const INITIAL: RealtimeDashboard = {
  agents: [],
  queues: [],
  handledToday: 0,
  missedToday: 0,
  totalToday: 0,
  updatedAt: new Date().toISOString(),
};

function mapAgent(raw: Record<string, unknown>): RoutingAgent {
  const stateRaw = String(raw.state ?? raw.status ?? 'offline');
  const state: AgentState =
    stateRaw === 'away'
      ? 'break'
      : stateRaw === 'available' || stateRaw === 'busy' || stateRaw === 'break'
        ? stateRaw
        : 'offline';

  return {
    id: String(raw.id ?? raw.agentId ?? ''),
    tenantId: String(raw.tenantId ?? 'default'),
    agentId: String(raw.agentId ?? raw.id ?? ''),
    name: String(raw.name ?? raw.displayName ?? 'Agent'),
    state,
    skills: Array.isArray(raw.skills) ? (raw.skills as string[]) : [],
    queueKeys: Array.isArray(raw.queueKeys) ? (raw.queueKeys as string[]) : undefined,
    currentCallId: raw.currentCallId != null ? String(raw.currentCallId) : undefined,
    lastStateChange: String(raw.updatedAt ?? raw.liveUpdatedAt ?? new Date().toISOString()),
  };
}

function mapQueue(raw: Record<string, unknown>): QueueStatEntry {
  return {
    id: String(raw.id ?? raw.queueId ?? ''),
    queueKey: raw.queueKey != null ? String(raw.queueKey) : undefined,
    name: String(raw.name ?? 'Queue'),
    waiting: Number(raw.waiting ?? 0),
    active: Number(raw.active ?? raw.calls ?? 0),
    longestWait: Number(raw.longestWait ?? 0),
  };
}

function normalizePayload(data: Record<string, unknown>): RealtimeDashboard {
  const agentsRaw = Array.isArray(data.agents)
    ? data.agents
    : Array.isArray((data.agents as { list?: unknown[] })?.list)
      ? (data.agents as { list: unknown[] }).list
      : [];

  const queuesRaw = Array.isArray(data.queues) ? data.queues : [];

  const handledToday = Number(data.handledToday ?? 0);
  const missedToday = Number(data.missedToday ?? 0);

  return {
    agents: agentsRaw.map((a) => mapAgent(a as Record<string, unknown>)),
    queues: queuesRaw.map((q) => mapQueue(q as Record<string, unknown>)),
    handledToday,
    missedToday,
    totalToday: Number(data.totalToday ?? handledToday + missedToday),
    updatedAt: String(data.updatedAt ?? data.at ?? new Date().toISOString()),
  };
}

export function useRealtimeWallboard() {
  const [data, setData] = useState<RealtimeDashboard>(INITIAL);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tenantId = useAuthStore(s => String(s.user?.chatwootAccountId ?? s.user?.tenantId ?? 'default'));

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws/routing/v1/realtime?tenant_id=${encodeURIComponent(tenantId)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!destroyed) setConnected(true);
      };

      ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data as string) as { type?: string; data?: Record<string, unknown> };
          if (msg.type === 'realtime' && msg.data) {
            setData(normalizePayload(msg.data));
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (destroyed) return;
        setConnected(false);
        retryRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [tenantId]);

  return { data, connected };
}
