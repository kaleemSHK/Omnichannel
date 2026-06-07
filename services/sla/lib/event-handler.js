import { createLogger } from './logger.js';
import * as repo from './sla-repo.js';
import { getCalendar, resolvePolicyForConversation } from './sla-repo.js';

const log = createLogger('sla-events');

export async function handleChatwootEvent(tenantId, payload) {
  const event = payload.event || payload.event_type;
  const conversationId = Number(payload.conversationId ?? payload.conversation_id);
  if (!event || !Number.isFinite(conversationId)) return { handled: false };

  const conversation = {
    priority: payload.priority ?? payload.conversation?.priority ?? 'medium',
    channel: payload.channel ?? payload.conversation?.channel ?? 'web',
    inboxId: payload.inboxId ?? payload.inbox_id ?? payload.conversation?.inbox_id,
    status: payload.status ?? payload.conversation?.status ?? 'open',
  };

  if (event === 'conversation_created' || event === 'conversation.created') {
    return createInstancesForConversation(tenantId, conversationId, conversation);
  }

  const instances = await repo.listInstancesForConversation(tenantId, conversationId);
  if (!instances.length) return { handled: false };

  const now = new Date().toISOString();

  if (event === 'message_created' || event === 'message.created') {
    const sender = String(payload.sender_type ?? payload.senderType ?? '').toLowerCase();
    const msgType = payload.message_type ?? payload.messageType;
    const fromAgent =
      msgType === 'outgoing' ||
      msgType === 1 ||
      sender === 'user' ||
      sender === 'agent';
    for (const inst of instances) {
      if (inst.status !== 'active' && inst.status !== 'warning_sent') continue;
      if (fromAgent && inst.targetType === 'first_response' && !inst.metAt) {
        await repo.updateInstanceStatus(tenantId, inst.id, { status: 'met', metAt: now });
        await repo.appendEvent(tenantId, inst.id, 'met', { reason: 'agent_reply' });
      }
      if (!fromAgent && inst.targetType === 'next_response') {
        const policy = await resolvePolicyForConversation(tenantId, conversation);
        const cal = policy?.businessHoursCalendarId
          ? await getCalendar(tenantId, policy.businessHoursCalendarId)
          : null;
        const target = policy?.targets?.find((t) => t.id === inst.targetId);
        if (target) {
          const { addBusinessMinutes } = await import('./working-time.js');
          const dueAt = addBusinessMinutes(now, target.thresholdMinutes, cal ?? {});
          await repo.updateInstanceStatus(tenantId, inst.id, { status: 'active', dueAt });
          await repo.appendEvent(tenantId, inst.id, 'resumed', { dueAt });
        }
      }
    }
    return { handled: true };
  }

  if (event === 'conversation_status_changed' || event === 'conversation.status_changed') {
    const status = (payload.status || conversation.status || '').toLowerCase();
    if (status === 'resolved') {
      return closeResolutionTargets(tenantId, instances, now);
    }
    for (const inst of instances) {
      if (['pending', 'snoozed'].includes(status)) {
        await repo.updateInstanceStatus(tenantId, inst.id, { status: 'paused', pausedSince: now });
        await repo.appendEvent(tenantId, inst.id, 'paused', { status });
      } else if (status === 'open' && inst.status === 'paused') {
        const pausedSince = inst.pausedSince ? new Date(inst.pausedSince).getTime() : Date.now();
        const pauseMs = Date.now() - pausedSince;
        const newDue = new Date(new Date(inst.dueAt).getTime() + pauseMs).toISOString();
        await repo.updateInstanceStatus(tenantId, inst.id, {
          status: 'active',
          pausedSince: null,
          pausedAtTotalMs: (inst.pausedAtTotalMs || 0) + pauseMs,
          dueAt: newDue,
        });
        await repo.appendEvent(tenantId, inst.id, 'resumed', { status, pauseMs, dueAt: newDue });
      }
    }
    return { handled: true };
  }

  if (event === 'conversation_reopened' || event === 'conversation.reopened') {
    for (const inst of instances) {
      if (inst.targetType === 'resolution' && ['met', 'breached'].includes(inst.status)) {
        const policy = await resolvePolicyForConversation(tenantId, conversation);
        const cal = policy?.businessHoursCalendarId
          ? await getCalendar(tenantId, policy.businessHoursCalendarId)
          : null;
        const target = policy?.targets?.find((t) => t.id === inst.targetId);
        if (target) {
          const { addBusinessMinutes } = await import('./working-time.js');
          const dueAt = addBusinessMinutes(now, target.thresholdMinutes, cal ?? {});
          await repo.updateInstanceStatus(tenantId, inst.id, {
            status: 'active',
            dueAt,
            metAt: null,
            breachedAt: null,
            pausedSince: null,
          });
          await repo.appendEvent(tenantId, inst.id, 'reopened', { dueAt });
        }
      }
    }
    return { handled: true };
  }

  if (event === 'conversation_updated' || event === 'conversation.updated') {
    const priority = payload.priority ?? payload.conversation?.priority;
    if (priority) {
      conversation.priority = priority;
      const policy = await resolvePolicyForConversation(tenantId, conversation);
      if (policy) {
        for (const target of policy.targets) {
          if (!repo.targetMatches(target.appliesWhen, conversation)) continue;
          const has = instances.some((i) => i.targetId === target.id);
          if (!has && ['first_response', 'resolution', 'next_response'].includes(target.targetType)) {
            const cal = policy.businessHoursCalendarId
              ? await getCalendar(tenantId, policy.businessHoursCalendarId)
              : null;
            await repo.createInstance(tenantId, {
              conversationId,
              policy,
              target,
              calendar: cal,
              startedAt: now,
            });
          }
        }
      }
    }
    return { handled: true };
  }

  if (event === 'conversation_resolved' || event === 'conversation.resolved') {
    return closeResolutionTargets(tenantId, instances, now);
  }

  log.debug({ event, conversationId }, 'event ignored');
  return { handled: false };
}

async function closeResolutionTargets(tenantId, instances, now) {
  for (const inst of instances) {
    if (inst.targetType === 'resolution' && inst.status !== 'met' && inst.status !== 'breached') {
      await repo.updateInstanceStatus(tenantId, inst.id, { status: 'met', metAt: now });
      await repo.appendEvent(tenantId, inst.id, 'met', { reason: 'resolved' });
    }
  }
  return { handled: true };
}

async function createInstancesForConversation(tenantId, conversationId, conversation) {
  const policy = await resolvePolicyForConversation(tenantId, conversation);
  if (!policy) return { handled: false, reason: 'no_policy' };

  const calendar = policy.businessHoursCalendarId
    ? await getCalendar(tenantId, policy.businessHoursCalendarId)
    : null;

  const startedAt = new Date().toISOString();
  const created = [];
  for (const target of policy.targets) {
    if (!repo.targetMatches(target.appliesWhen, conversation)) continue;
    const inst = await repo.createInstance(tenantId, {
      conversationId,
      policy,
      target,
      calendar,
      startedAt,
    });
    created.push(inst);
  }
  return { handled: true, created: created.length };
}
