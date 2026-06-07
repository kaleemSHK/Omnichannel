import { fetchTenantFeatures, isFeatureEnabled } from './features.js';

const ESC_URL = (process.env.ESCALATION_URL || 'http://escalation:8797').replace(/\/$/, '');
const ESC_TOKEN = (process.env.ESCALATION_TOKEN || '').trim();

export function slaTierFromPolicyName(name) {
  if (!name) return 'bronze';
  return String(name).trim().toLowerCase();
}

export function slaStatusForTrigger(trigger, instanceStatus) {
  if (trigger === 'sla.breached') return 'breached';
  if (trigger === 'sla.warning') return 'warning';
  if (instanceStatus === 'warning_sent') return 'warning';
  return 'active';
}

/** Build escalation event body for SLA worker (TR-24 enriched context). */
export function slaEscalationPayload(row, trigger) {
  const conversationId = Number(row.conversation_id);
  return {
    conversation_id: conversationId,
    instance_id: row.id,
    target_type: row.target_type,
    policy_name: row.policy_name,
    conversation: {
      id: conversationId,
      sla_tier: slaTierFromPolicyName(row.policy_name),
      sla_status: slaStatusForTrigger(trigger, row.status),
    },
    event: {
      target_type: row.target_type,
      policy_name: row.policy_name,
      instance_status: row.status,
    },
  };
}

/** Build escalation event body for routing / queue events. */
export function callEscalationPayload(meta, extras) {
  const conversationId = meta?.conversationId ?? meta?.conversation_id ?? null;
  const waitMinutes = extras.waitMinutes ?? 0;
  return {
    call_id: extras.callId,
    conversation_id: conversationId,
    queue_key: extras.queueKey ?? meta?.queueKey ?? null,
    conversation: {
      id: conversationId,
      call_status: extras.callStatus ?? 'active',
      missed_count: extras.missedCount ?? waitMinutes,
    },
    event: {
      wait_minutes: waitMinutes,
      queue_key: extras.queueKey ?? meta?.queueKey ?? null,
      call_id: extras.callId,
      reason: extras.reason ?? null,
    },
  };
}

export async function notifyEscalation(tenantId, trigger, payload, log) {
  if (!ESC_TOKEN) return { skipped: true, reason: 'no_token' };
  const features = await fetchTenantFeatures(tenantId);
  if (!isFeatureEnabled(features, 'escalation')) return { skipped: true, reason: 'feature_disabled' };
  try {
    const res = await fetch(`${ESC_URL}/v1/events`, {
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
    });
    if (!res.ok) {
      const text = await res.text();
      log?.warn?.({ trigger, status: res.status, detail: text.slice(0, 160) }, 'escalation notify failed');
      return { ok: false, status: res.status };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: true, data: json.data ?? json };
  } catch (e) {
    log?.warn?.({ err: e.message, trigger }, 'escalation notify error');
    return { ok: false, error: e.message };
  }
}
