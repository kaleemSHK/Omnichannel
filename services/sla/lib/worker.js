import { createLogger } from './logger.js';
import {
  listActiveTenantIds,
  listActiveInstances,
  updateInstanceStatus,
  appendEvent,
} from './sla-repo.js';
import { warningAt } from './working-time.js';
import {
  notifyEscalation,
  slaEscalationPayload,
} from '../_shared/lib/escalation-notify.js';

const log = createLogger('sla-worker');

export function startSlaWorker(intervalMs = 30_000) {
  if (process.env.SLA_WORKER === '0') return;

  setInterval(async () => {
    try {
      const tenantIds = await listActiveTenantIds();
      const now = new Date();

      for (const tenantId of tenantIds) {
        const rows = await listActiveInstances(tenantId);
        for (const row of rows) {
          const calendar = { weekdayHours: row.weekday_hours, holidays: row.holidays };
          const inst = {
            id: row.id,
            status: row.status,
            startedAt: row.started_at,
            dueAt: row.due_at,
            conversationId: row.conversation_id,
            warningThresholdPct: row.warning_threshold_pct,
          };

          if (!inst.dueAt) {
            log.warn({ instanceId: inst.id, tenantId }, 'sla instance missing dueAt — skipping');
            continue;
          }

          if (inst.status === 'active' || inst.status === 'warning_sent') {
            const warnAt = warningAt(inst.dueAt, inst.startedAt, inst.warningThresholdPct, calendar);
            if (inst.status === 'active' && now >= new Date(warnAt)) {
              await updateInstanceStatus(tenantId, inst.id, { status: 'warning_sent' });
              await appendEvent(tenantId, inst.id, 'warned', { warnAt });
              await notifyEscalation(tenantId, 'sla.warning', slaEscalationPayload(row, 'sla.warning'), log);
            }
          }

          if (inst.status === 'paused') continue;

          if (['active', 'warning_sent'].includes(inst.status) && now >= new Date(inst.dueAt)) {
            await updateInstanceStatus(tenantId, inst.id, { status: 'breached', breachedAt: now.toISOString() });
            await appendEvent(tenantId, inst.id, 'breached', {});
            await notifyEscalation(tenantId, 'sla.breached', slaEscalationPayload(row, 'sla.breached'), log);
          }
        }
      }
    } catch (e) {
      log.warn({ err: e.message }, 'sla worker tick');
    }
  }, intervalMs);

  log.info({ intervalMs }, 'sla worker started (per-tenant isolation)');
}
