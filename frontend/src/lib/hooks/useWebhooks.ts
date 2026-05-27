'use client';

/**
 * React Query hooks for outbound webhook management — Sprint 3 N1.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listWebhookEndpoints,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  testWebhookEndpoint,
  listDeliveries,
  listEndpointDeliveries,
  retryDelivery,
} from '@/lib/api/webhooks';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';
import { DEMO_WEBHOOK_ENDPOINTS, DEMO_WEBHOOK_DELIVERIES } from '@/lib/demo/webhookFixture';
import type { WebhookEndpoint, WebhookCreateResult, WebhookDelivery } from '@/lib/api/webhooks';

const EPS_KEY  = ['webhook-endpoints'];
const DELS_KEY = ['webhook-deliveries'];

// ─── Endpoints ────────────────────────────────────────────────────────────────

export function useWebhookEndpoints() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery<WebhookEndpoint[]>({
    queryKey: EPS_KEY,
    queryFn: async () => {
      if (isDemoDataEnabled() || !gwEnabled) return DEMO_WEBHOOK_ENDPOINTS;
      try { return await listWebhookEndpoints(); } catch { return DEMO_WEBHOOK_ENDPOINTS; }
    },
    staleTime: 30_000,
  });
}

export function useCreateWebhookEndpoint(onCreated: (result: WebhookCreateResult) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Parameters<typeof createWebhookEndpoint>[0]) => {
      if (isDemoDataEnabled()) {
        const ep: WebhookEndpoint = {
          id: `ep-${Date.now()}`,
          tenantId: '1',
          name: data.name,
          url: data.url,
          eventsSubscribed: data.eventsSubscribed,
          enabled: true,
          extraHeaders: data.extraHeaders ?? {},
          createdAt: new Date().toISOString(),
        };
        return { endpoint: ep, secret: 'demo-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' } satisfies WebhookCreateResult;
      }
      return createWebhookEndpoint(data);
    },
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: EPS_KEY });
      toast.success('Webhook endpoint created');
      onCreated(result);
    },
    onError: () => toast.error('Could not create webhook endpoint'),
  });
}

export function useUpdateWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Parameters<typeof updateWebhookEndpoint>[1] }) => {
      if (isDemoDataEnabled()) return { id, ...data } as WebhookEndpoint;
      return updateWebhookEndpoint(id, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EPS_KEY }),
    onError:   () => toast.error('Could not update webhook endpoint'),
  });
}

export function useDeleteWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isDemoDataEnabled()) await deleteWebhookEndpoint(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EPS_KEY });
      toast.success('Webhook endpoint deleted');
    },
    onError: () => toast.error('Could not delete webhook endpoint'),
  });
}

export function useTestWebhookEndpoint() {
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemoDataEnabled()) return { sent: true, eventId: `demo-${Date.now()}` };
      return testWebhookEndpoint(id);
    },
    onSuccess: () => toast.success('Test event sent'),
    onError:   () => toast.error('Test event failed'),
  });
}

// ─── Deliveries ───────────────────────────────────────────────────────────────

export function useDeliveries(limit = 100) {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery<WebhookDelivery[]>({
    queryKey: [...DELS_KEY, limit],
    queryFn: async () => {
      if (isDemoDataEnabled() || !gwEnabled) return DEMO_WEBHOOK_DELIVERIES;
      try { return await listDeliveries(limit); } catch { return DEMO_WEBHOOK_DELIVERIES; }
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useEndpointDeliveries(endpointId: string | null) {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery<WebhookDelivery[]>({
    queryKey: [...DELS_KEY, 'endpoint', endpointId],
    queryFn: async () => {
      if (!endpointId) return [];
      if (isDemoDataEnabled() || !gwEnabled) {
        return DEMO_WEBHOOK_DELIVERIES.filter(d => d.endpointId === endpointId);
      }
      try { return await listEndpointDeliveries(endpointId); } catch { return []; }
    },
    enabled: !!endpointId,
    staleTime: 15_000,
  });
}

export function useRetryDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deliveryId: string) => {
      if (isDemoDataEnabled()) return { status: 'pending' };
      return retryDelivery(deliveryId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DELS_KEY });
      toast.success('Delivery re-queued');
    },
    onError: () => toast.error('Could not retry delivery'),
  });
}
