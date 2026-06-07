import { getPool } from './db.js';
import { createLogger } from './logger.js';
import { processEvent } from './engine.js';

const log = createLogger('escalation-conversation-watch');

const UNASSIGNED_MIN = parseInt(process.env.ESCALATION_UNASSIGNED_MINUTES || '15', 10);
const NO_RESPONSE_MIN = parseInt(process.env.ESCALATION_NO_RESPONSE_MINUTES || '8', 10);
const TICK_MS = parseInt(process.env.ESCALATION_CONVERSATION_TICK_MS || '60000', 10);

const WATCH_EVENTS = new Set([
  'conversation.created',
  'conversation_created',
  'message.created',
  'message_created',
  'conversation.updated',
  'conversation_updated',
  'conversation.status_changed',
  'conversation_status_changed',
  'conversation.resolved',
  'conversation_resolved',
  'conversation.reopened',
  'conversation_reopened',
]);

function mapInboxType(conv) {
  const ch = conv.meta?.channel || conv.channel || conv.inbox?.channel_type || '';
  const s = String(ch).toLowerCase();
  if (/whatsapp/.test(s)) return 'whatsapp';
  if (/email/.test(s)) return 'email';
  if (/sms/.test(s)) return 'sms';
  if (/web|website|widget/.test(s)) return 'web';
  if (/api/.test(s)) return 'api';
  if (/telegram/.test(s)) return 'telegram';
  if (/line/.test(s)) return 'line';
  return s.replace(/^channel::/, '') || 'unknown';
}

function getAssignedAgent(conv) {
  const a = conv.meta?.assignee || conv.assignee;
  if (!a && !conv.assignee_id) return '';
  if (a?.name) return a.name;
  if (a?.id || conv.assignee_id) return String(a?.id ?? conv.assignee_id);
  return '';
}

function isCustomerMessage(msg) {
  const msgType = msg.message_type ?? msg.messageType;
  const senderType = msg.sender_type ?? msg.senderType;
  if (senderType === 'Contact') return true;
  if (senderType === 'User') return false;
  return msgType === 0 || msgType === 'incoming';
}

function isAgentMessage(msg) {
  const msgType = msg.message_type ?? msg.messageType;
  if (msgType === 2 || msgType === 'activity') return false;
  const senderType = msg.sender_type ?? msg.senderType;
  if (senderType === 'User') return true;
  return msgType === 1 || msgType === 'outgoing';
}

export async function syncConversationFromWebhook(tenantId, type, body) {
  if (!WATCH_EVENTS.has(type)) return { synced: false };
  const conv = body.conversation ?? {};
  const conversationId = Number(conv.id ?? body.conversation_id);
  if (!conversationId) return { synced: false };

  const status = String(conv.status ?? body.status ?? 'open').toLowerCase();
  const pool = getPool();
  if (!pool) return { synced: false };

  if (status === 'resolved') {
    await pool.query(
      `UPDATE escalation_conversation_watch
       SET status = 'resolved', updated_at = now()
       WHERE tenant_id = $1 AND conversation_id = $2`,
      [tenantId, conversationId],
    );
    return { synced: true, status: 'resolved' };
  }

  const assignee = getAssignedAgent(conv);
  const inboxType = mapInboxType(conv);
  const priority = conv.priority ?? null;
  const msg = body.message ?? {};
  const isNew = type === 'conversation.created' || type === 'conversation_created';
  const isReopened = type === 'conversation.reopened' || type === 'conversation_reopened';
  const customerMsg = (type.includes('message')) && isCustomerMessage(msg);
  const agentMsg = (type.includes('message')) && isAgentMessage(msg);

  await pool.query(
    `INSERT INTO escalation_conversation_watch (
       tenant_id, conversation_id, status, inbox_type, assigned_agent, priority,
       opened_at, unassigned_since, last_customer_at, last_agent_at,
       unassigned_notified_at, no_response_notified_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       now(), CASE WHEN $5 = '' THEN now() ELSE NULL END,
       CASE WHEN $7 THEN now() ELSE NULL END,
       CASE WHEN $8 THEN now() ELSE NULL END,
       NULL, NULL, now()
     )
     ON CONFLICT (tenant_id, conversation_id) DO UPDATE SET
       status = EXCLUDED.status,
       inbox_type = COALESCE(EXCLUDED.inbox_type, escalation_conversation_watch.inbox_type),
       assigned_agent = EXCLUDED.assigned_agent,
       priority = COALESCE(EXCLUDED.priority, escalation_conversation_watch.priority),
       unassigned_since = CASE
         WHEN EXCLUDED.assigned_agent = '' AND escalation_conversation_watch.assigned_agent != '' THEN now()
         WHEN EXCLUDED.assigned_agent != '' THEN NULL
         WHEN escalation_conversation_watch.unassigned_since IS NULL AND EXCLUDED.assigned_agent = '' THEN now()
         ELSE escalation_conversation_watch.unassigned_since
       END,
       unassigned_notified_at = CASE
         WHEN EXCLUDED.assigned_agent != '' THEN NULL
         ELSE escalation_conversation_watch.unassigned_notified_at
       END,
       last_customer_at = CASE
         WHEN $7 THEN now()
         ELSE escalation_conversation_watch.last_customer_at
       END,
       last_agent_at = CASE
         WHEN $8 THEN now()
         ELSE escalation_conversation_watch.last_agent_at
       END,
       no_response_notified_at = CASE
         WHEN $8 THEN NULL
         WHEN $7 THEN NULL
         ELSE escalation_conversation_watch.no_response_notified_at
       END,
       opened_at = CASE
         WHEN $9 OR $10 THEN now()
         ELSE escalation_conversation_watch.opened_at
       END,
       updated_at = now()`,
    [
      tenantId,
      conversationId,
      status === 'resolved' ? 'resolved' : 'open',
      inboxType,
      assignee,
      priority,
      customerMsg,
      agentMsg,
      isNew,
      isReopened,
    ],
  );

  return { synced: true, conversationId };
}

async function processConversationTimers() {
  const pool = getPool();
  if (!pool) return;

  const { rows } = await pool.query(
    `SELECT * FROM escalation_conversation_watch
     WHERE status = 'open'
     ORDER BY tenant_id, conversation_id
     LIMIT 500`,
  );

  const now = Date.now();
  let fired = 0;

  for (const row of rows) {
    const tenantId = row.tenant_id;
    const conversationId = row.conversation_id;

    if (!row.assigned_agent && row.unassigned_since && !row.unassigned_notified_at) {
      const mins = Math.floor((now - new Date(row.unassigned_since).getTime()) / 60000);
      if (mins >= UNASSIGNED_MIN) {
        await processEvent(tenantId, {
          event_type: 'conversation.unassigned_for_minutes',
          conversation_id: conversationId,
          conversation: {
            inbox_type: row.inbox_type || 'unknown',
            assigned_agent: '',
            unassigned_minutes: mins,
            priority: row.priority,
          },
        });
        await pool.query(
          `UPDATE escalation_conversation_watch
           SET unassigned_notified_at = now(), updated_at = now()
           WHERE tenant_id = $1 AND conversation_id = $2`,
          [tenantId, conversationId],
        );
        fired += 1;
      }
    }

    const lastCust = row.last_customer_at ? new Date(row.last_customer_at).getTime() : null;
    const lastAgent = row.last_agent_at ? new Date(row.last_agent_at).getTime() : null;
    const awaitingReply = lastCust && (!lastAgent || lastCust > lastAgent);

    if (awaitingReply && !row.no_response_notified_at) {
      const mins = Math.floor((now - lastCust) / 60000);
      if (mins >= NO_RESPONSE_MIN) {
        await processEvent(tenantId, {
          event_type: 'conversation.no_response_for_minutes',
          conversation_id: conversationId,
          conversation: {
            inbox_type: row.inbox_type || 'unknown',
            assigned_agent: row.assigned_agent || '',
            sla_status: row.sla_status || '',
            missed_count: 1,
            no_response_minutes: mins,
            priority: row.priority,
          },
        });
        await pool.query(
          `UPDATE escalation_conversation_watch
           SET no_response_notified_at = now(), updated_at = now()
           WHERE tenant_id = $1 AND conversation_id = $2`,
          [tenantId, conversationId],
        );
        fired += 1;
      }
    }
  }

  if (fired) log.info({ fired }, 'conversation timer events emitted');
}

/** @type {ReturnType<typeof setInterval> | null} */
let timer = null;

export function startConversationTimerWorker() {
  if (timer || process.env.ESCALATION_CONVERSATION_TIMER === '0') return;
  timer = setInterval(() => {
    processConversationTimers().catch(e => log.warn({ err: e.message }, 'conversation timer tick failed'));
  }, TICK_MS);
  processConversationTimers().catch(() => {});
  log.info({ tickMs: TICK_MS, unassignedMin: UNASSIGNED_MIN, noResponseMin: NO_RESPONSE_MIN }, 'conversation timer worker started');
}

export function stopConversationTimerWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
