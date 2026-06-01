'use client';

import { useEffect, useRef, useState } from 'react';
import { getRealtimeDashboard } from '@/lib/api/routing';
import { normalizeRoutingAgent } from '@/lib/api/routing-agents';
import { useAuthStore } from '@/lib/store/auth';
import { isLiveGatewayEnabled } from '@/lib/live-data/policy';
import type { QueueStatEntry, RealtimeDashboard, RoutingAgent } from '@/types';

export type { QueueStatEntry, RealtimeDashboard };

const INITIAL: RealtimeDashboard = {
  agents: [],
  queues: [],
  handledToday: 0,
  missedToday: 0,
  totalToday: 0,
  updatedAt: new Date().toISOString(),
};

function mapAgent(raw: Record<string, unknown>): RoutingAgent {
  return normalizeRoutingAgent(raw);
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
  const [bootstrapped, setBootstrapped] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tenantId = useAuthStore(s => String(s.user?.chatwootAccountId ?? s.user?.tenantId ?? 'default'));

  // REST bootstrap — real DB/Redis snapshot before/alongside WebSocket ticks.
  useEffect(() => {
    if (!isLiveGatewayEnabled()) return;
    let cancelled = false;
    void (async () => {
      try {
        const snap = await getRealtimeDashboard();
        if (!cancelled) {
          setData(snap);
          setBootstrapped(true);
        }
      } catch {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const { tokens } = useAuthStore.getState();
      const token = tokens?.gatewayJwt ?? '';
      // Allow a dedicated WS host (e.g. a DNS-only/grey-clouded ws.blinksone.com)
      // so realtime sockets bypass the CDN proxy's connection recycling.
      const wsHost = process.env.NEXT_PUBLIC_WS_HOST || window.location.host;
      const url = `${protocol}//${wsHost}/ws/routing/v1/realtime?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`;
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

  return { data, connected, bootstrapped };
}
