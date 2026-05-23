import { simulateRule } from './json-logic-safe.js';
import { rulesForTrigger, recordRun } from './escalation-repo.js';
import { createLogger } from './logger.js';
import {
  assignConversation,
  assignConversationToTeam,
  updateConversation,
  addLabels,
  postInternalNote,
} from '../_shared/lib/chatwoot-actions.js';

const log = createLogger('escalation-engine');

export async function executeActions(actions, event) {
  const accountId = Number(event.account_id ?? event.tenant_id ?? event.tenantId);
  const conversationId = Number(event.conversation_id ?? event.conversationId);
  const outcomes = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'change_priority':
          if (accountId && conversationId) {
            await updateConversation(accountId, conversationId, { priority: action.priority });
            outcomes.push({ type: action.type, status: 'ok', priority: action.priority });
          } else {
            outcomes.push({ type: action.type, status: 'skipped', reason: 'missing_ids' });
          }
          break;
        case 'add_label':
        case 'add_labels':
          if (accountId && conversationId) {
            const labels = action.labels ?? (action.label ? [action.label] : []);
            await addLabels(accountId, conversationId, labels);
            outcomes.push({ type: action.type, status: 'ok', labels });
          } else {
            outcomes.push({ type: action.type, status: 'skipped' });
          }
          break;
        case 'reassign_to_agent':
          if (accountId && conversationId && action.agent_id) {
            await assignConversation(accountId, conversationId, Number(action.agent_id));
            outcomes.push({ type: action.type, status: 'ok', agentId: action.agent_id });
          } else {
            outcomes.push({ type: action.type, status: 'skipped' });
          }
          break;
        case 'reassign_to_team':
          if (accountId && conversationId && action.team_id) {
            await assignConversationToTeam(accountId, conversationId, Number(action.team_id));
            outcomes.push({ type: action.type, status: 'ok', teamId: action.team_id });
          } else {
            outcomes.push({ type: action.type, status: 'skipped' });
          }
          break;
        case 'bump_queue_priority': {
          const order = ['low', 'medium', 'high', 'urgent'];
          const cur = (event.priority || 'medium').toLowerCase();
          const idx = Math.min(order.length - 1, order.indexOf(cur) + (action.delta ?? 1));
          const next = order[Math.max(0, idx)];
          if (accountId && conversationId) {
            await updateConversation(accountId, conversationId, { priority: next });
            outcomes.push({ type: action.type, status: 'ok', priority: next });
          } else {
            outcomes.push({ type: action.type, status: 'skipped' });
          }
          break;
        }
        case 'send_webhook':
          if (action.url) {
            const res = await fetch(action.url, {
              method: action.method || 'POST',
              headers: { 'Content-Type': 'application/json', ...(action.headers ?? {}) },
              body: JSON.stringify({ event, accountId, conversationId, ...event }),
            });
            outcomes.push({ type: action.type, status: res.ok ? 'ok' : 'error', httpStatus: res.status });
          } else {
            outcomes.push({ type: action.type, status: 'skipped', reason: 'missing_url' });
          }
          break;
        case 'notify_slack':
          if (action.webhook_url) {
            const text = action.text || `BlinkOne escalation: ${event.event_type || event.triggerType} on conversation ${conversationId}`;
            const res = await fetch(action.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text }),
            });
            outcomes.push({ type: action.type, status: res.ok ? 'ok' : 'error', httpStatus: res.status });
          } else {
            outcomes.push({ type: action.type, status: 'skipped', reason: 'missing_webhook_url' });
          }
          break;
        case 'post_internal_note':
          if (accountId && conversationId) {
            const content = action.content ?? action.template ?? 'BlinkOne escalation note';
            await postInternalNote(accountId, conversationId, content);
            outcomes.push({ type: action.type, status: 'ok' });
          } else {
            outcomes.push({ type: action.type, status: 'skipped' });
          }
          break;
        default:
          outcomes.push({ type: action.type, status: 'unsupported' });
      }
    } catch (e) {
      outcomes.push({ type: action.type, status: 'error', message: e.message });
      log.warn({ err: e.message, action: action.type }, 'escalation action failed');
    }
  }
  return outcomes;
}

export async function processEvent(tenantId, event) {
  const trigger = event.event_type || event.triggerType;
  const enriched = {
    ...event,
    tenant_id: tenantId,
    account_id: event.account_id ?? tenantId,
  };
  const rules = await rulesForTrigger(tenantId, trigger);
  const results = [];

  for (const rule of rules) {
    const sim = simulateRule(rule, enriched);
    let outcomes = [];
    let error = null;
    if (sim.conditionsPassed) {
      try {
        outcomes = await executeActions(sim.actions, enriched);
      } catch (e) {
        error = e.message;
      }
    }
    await recordRun(rule.id, {
      inputEvent: enriched,
      conditionsPassed: sim.conditionsPassed,
      actionsAttempted: sim.actions,
      outcomes,
      error,
    });
    results.push({ ruleId: rule.id, ...sim, outcomes });
  }
  return results;
}
