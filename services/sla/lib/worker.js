import { createLogger } from './logger.js';
import { listActiveInstances, updateInstanceStatus, appendEvent } from './sla-repo.js';
import { warningAt } from './working-time.js';
import { fetchTenantFeatures, isFeatureEnabled } from '../_shared/lib/features.js';

const log = createLogger('sla-worker');
const ESC_URL = (process.env.ESCALATION_URL || 'http://escalation:8797').replace(/\/$/, '');
const ESC_TOKEN = (process.env.ESCALATION_TOKEN || '').trim();

async function notifyEscalation(tenantId, trigger, payload) {
  const features = await fetchTenantFeatures(tenantId);
  if (!isFeatureEnabled(features, 'escalation')) return;
  try {
    await fetch(`${ESC_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ESC_TOKEN ? { Authorization: `Bearer ${ESC_TOKEN}` } : {}),
        'X-Blinkone-Tenant-Id': tenantId,
      },
      body: JSON.stringify({ event_type: trigger, tenant_id: tenantId, account_id: tenantId, ...payload }),
    });
  } catch (e) {
    log.warn({ err: e.message, trigger }, 'escalation notify failed');
  }
}

export function startSlaWorker(intervalMs = 30_000) {
  if (process.env.SLA_WORKER === '0') return;

  setInterval(async () => {
    try {
      const rows = await listActiveInstances(null);
      const now = new Date();
      for (const row of rows) {
        const tenantId = String(row.tenant_id);
        const calendar = { weekdayHours: row.weekday_hours, holidays: row.holidays };
        const inst = {
          id: row.id,
          status: row.status,
          startedAt: row.started_at,
          dueAt: row.due_at,
          conversationId: row.conversation_id,
          warningThresholdPct: row.warning_threshold_pct,
        };

        if (inst.status === 'active' || inst.status === 'warning_sent') {
          const warnAt = warningAt(inst.dueAt, inst.startedAt, inst.warningThresholdPct, calendar);
          if (inst.status === 'active' && now >= new Date(warnAt)) {
            await updateInstanceStatus(inst.id, { status: 'warning_sent' });
            await appendEvent(inst.id, 'warned', { warnAt });
            await notifyEscalation(tenantId, 'sla.warning', {
              conversation_id: inst.conversationId,
              instance_id: inst.id,
            });
          }
        }

        if (inst.status === 'paused') continue;

        if (['active', 'warning_sent'].includes(inst.status) && now >= new Date(inst.dueAt)) {
          await updateInstanceStatus(inst.id, { status: 'breached', breachedAt: now.toISOString() });
          await appendEvent(inst.id, 'breached', {});
          await notifyEscalation(tenantId, 'sla.breached', {
            conversation_id: inst.conversationId,
            instance_id: inst.id,
          });
        }
      }
    } catch (e) {
      log.warn({ err: e.message }, 'sla worker tick');
    }
  }, intervalMs);

  log.info({ intervalMs }, 'sla worker started (all tenants)');
}
