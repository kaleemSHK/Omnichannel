/**
 * BlinkOne outbound webhook management — Sprint 3 N1.
 * All calls route through the gateway to the integration service.
 */

import { bnFetch } from './client';

const SVC = 'integrations';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  eventsSubscribed: string[];
  enabled: boolean;
  extraHeaders: Record<string, string>;
  createdAt: string;
}

/** Returned once on creation — secret is only revealed here. */
export interface WebhookCreateResult {
  endpoint: WebhookEndpoint;
  secret: string;
}

export type DeliveryStatus = 'pending' | 'succeeded' | 'failed' | 'dead';

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  tenantId: string;
  eventId: string;
  eventType: string;
  attempt: number;
  status: DeliveryStatus;
  responseStatus: number | null;
  responseBodyTruncated: string | null;
  attemptedAt: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}

// ─── Event catalog ─────────────────────────────────────────────────────────────

export const WEBHOOK_EVENTS = [
  { key: '*',                              label: 'All events (wildcard)',        group: 'Meta'          },
  { key: 'conversation.created',           label: 'Conversation created',         group: 'Conversations' },
  { key: 'conversation.status_changed',    label: 'Conversation status changed',  group: 'Conversations' },
  { key: 'conversation.resolved',          label: 'Conversation resolved',        group: 'Conversations' },
  { key: 'conversation.updated',           label: 'Conversation updated',         group: 'Conversations' },
  { key: 'message.created',               label: 'Message created',              group: 'Conversations' },
  { key: 'sla.breached',                   label: 'SLA breached',                 group: 'SLA'           },
  { key: 'integration.test',               label: 'Test / ping',                  group: 'System'        },
] as const;

export type WebhookEventKey = typeof WEBHOOK_EVENTS[number]['key'];

// ─── API functions ─────────────────────────────────────────────────────────────

export async function listWebhookEndpoints(): Promise<WebhookEndpoint[]> {
  return bnFetch<WebhookEndpoint[]>(SVC, '/v1/webhooks');
}

export async function createWebhookEndpoint(data: {
  name: string;
  url: string;
  eventsSubscribed: string[];
  extraHeaders?: Record<string, string>;
}): Promise<WebhookCreateResult> {
  return bnFetch<WebhookCreateResult>(SVC, '/v1/webhooks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateWebhookEndpoint(
  id: string,
  data: Partial<Pick<WebhookEndpoint, 'name' | 'url' | 'eventsSubscribed' | 'enabled' | 'extraHeaders'>>,
): Promise<WebhookEndpoint> {
  return bnFetch<WebhookEndpoint>(SVC, `/v1/webhooks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  await bnFetch<unknown>(SVC, `/v1/webhooks/${id}`, { method: 'DELETE' });
}

export async function testWebhookEndpoint(id: string): Promise<{ sent: boolean; eventId: string }> {
  return bnFetch(SVC, `/v1/webhooks/${id}/test`, { method: 'POST', body: '{}' });
}

export async function listDeliveries(limit = 100): Promise<WebhookDelivery[]> {
  return bnFetch<WebhookDelivery[]>(SVC, `/v1/webhooks/deliveries?limit=${limit}`);
}

export async function listEndpointDeliveries(endpointId: string, limit = 50): Promise<WebhookDelivery[]> {
  return bnFetch<WebhookDelivery[]>(SVC, `/v1/webhooks/${endpointId}/deliveries?limit=${limit}`);
}

export async function retryDelivery(deliveryId: string): Promise<{ status: string }> {
  return bnFetch(SVC, `/v1/webhooks/deliveries/${deliveryId}/retry`, { method: 'POST', body: '{}' });
}
