import { fetchTenantFeatures, isFeatureEnabled } from '../_shared/lib/features.js';

const SLA_URL = (process.env.SLA_URL || 'http://sla:8796').replace(/\/$/, '');
const SLA_TOKEN = (process.env.SLA_TOKEN || '').trim();
const ESC_URL = (process.env.ESCALATION_URL || 'http://escalation:8797').replace(/\/$/, '');
const ESC_TOKEN = (process.env.ESCALATION_TOKEN || '').trim();

const SLA_EVENTS = new Set([
  'conversation.created',
  'conversation_created',
  'message.created',
  'message_created',
  'conversation.status_changed',
  'conversation_status_changed',
  'conversation.resolved',
  'conversation_resolved',
  'conversation.updated',
  'conversation_updated',
  'conversation.reopened',
  'conversation_reopened',
]);

function mapEvent(type, body) {
  const conv = body.conversation ?? {};
  const msg = body.message ?? {};
  const map = {
    'conversation.created': 'conversation_created',
    'message.created': 'message_created',
    'conversation.status_changed': 'conversation_status_changed',
    'conversation.resolved': 'conversation_resolved',
    'conversation.updated': 'conversation_updated',
    'conversation.reopened': 'conversation_reopened',
  };
  const event = map[type] || type;
  return {
    event,
    conversation_id: conv.id ?? body.conversation_id,
    conversationId: conv.id ?? body.conversation_id,
    priority: conv.priority ?? body.priority,
    status: conv.status ?? body.status,
    inbox_id: conv.inbox_id ?? body.inbox_id,
    message_type: msg.message_type ?? body.message_type,
    sender_type: msg.sender_type ?? body.sender_type,
    channel: conv.channel ?? body.channel,
  };
}

export async function forwardChatwootToSla(tenantId, type, body) {
  if (!SLA_TOKEN || !SLA_EVENTS.has(type)) return;
  const features = await fetchTenantFeatures(tenantId);
  if (!isFeatureEnabled(features, 'sla')) return;
  const payload = mapEvent(type, body);
  if (!payload.conversation_id && !payload.conversationId) return;
  await fetch(`${SLA_URL}/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SLA_TOKEN}`,
      'X-Blinkone-Tenant-Id': String(tenantId),
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export async function forwardSlaToEscalation(tenantId, trigger, payload) {
  if (!ESC_TOKEN) return;
  await fetch(`${ESC_URL}/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ESC_TOKEN}`,
      'X-Blinkone-Tenant-Id': String(tenantId),
    },
    body: JSON.stringify({
      event_type: trigger,
      tenant_id: tenantId,
      account_id: tenantId,
      ...payload,
    }),
  }).catch(() => {});
}
