/**
 * Chatwoot ↔ Ticket Sync — Sprint 2 T01
 *
 * Provides helpers to mirror ticket state into Chatwoot conversations:
 *   - Post activity notes when tickets are created / updated / resolved
 *   - Apply ticket label to the conversation for quick identification
 *   - Map inbound Chatwoot messages to ticket timeline entries
 *
 * All functions are best-effort: they log warnings on failure but
 * never throw so the calling ticket operation always succeeds.
 */

'use strict';

import { createLogger } from './logger.js';

const log = createLogger('tickets-chatwoot-sync');

const CHATWOOT_URL   = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const CHATWOOT_TOKEN = (process.env.CHATWOOT_BOT_TOKEN || process.env.CHATWOOT_API_ACCESS_TOKEN || '').trim();

// ─── Low-level Chatwoot API helpers ──────────────────────────────────────────

/**
 * POST an activity message into a Chatwoot conversation.
 * `message_type: 2` = activity (shown as a grey note in the timeline).
 */
async function postActivityNote(accountId, conversationId, content) {
  if (!CHATWOOT_TOKEN || !accountId || !conversationId) return;
  const url = `${CHATWOOT_URL}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': CHATWOOT_TOKEN,
      },
      body: JSON.stringify({
        content,
        message_type: 2,       // activity
        content_type: 'text',
        private: false,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      log.warn({ accountId, conversationId, status: res.status, body: text.slice(0, 200) }, 'post note failed');
    } else {
      log.debug({ accountId, conversationId }, 'note posted');
    }
  } catch (e) {
    log.warn({ err: e.message, accountId, conversationId }, 'post note network error');
  }
}

/**
 * Add a label to a Chatwoot conversation.
 * Labels must already exist in the account.
 * We add; we never remove (safe to call multiple times).
 */
async function addConversationLabel(accountId, conversationId, label) {
  if (!CHATWOOT_TOKEN || !accountId || !conversationId) return;
  const url = `${CHATWOOT_URL}/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`;
  try {
    // GET current labels first
    const getRes = await fetch(url, {
      headers: { 'api_access_token': CHATWOOT_TOKEN },
    });
    let existing = [];
    if (getRes.ok) {
      const body = await getRes.json().catch(() => ({}));
      existing = body.payload ?? body.labels ?? [];
    }
    if (existing.includes(label)) return; // already labeled
    const postRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': CHATWOOT_TOKEN,
      },
      body: JSON.stringify({ labels: [...existing, label] }),
    });
    if (!postRes.ok) {
      log.warn({ accountId, conversationId, label, status: postRes.status }, 'add label failed');
    }
  } catch (e) {
    log.warn({ err: e.message, accountId, conversationId, label }, 'add label error');
  }
}

// ─── Public sync actions ──────────────────────────────────────────────────────

/**
 * Called when a new ticket is linked to a conversation.
 * Posts an activity note and adds the ticket label.
 */
export async function onTicketCreated(ticket) {
  const { chatwootAccountId, chatwootConversationId, id, title, priority } = ticket;
  if (!chatwootConversationId) return;

  const displayId = `TKT-${String(id).slice(-6)}`;
  const note = [
    `🎫 **Ticket ${displayId} created**`,
    `Title: ${title}`,
    `Priority: ${priority}`,
    `View in BlinkOne: /tickets?id=${id}`,
  ].join('\n');

  await Promise.all([
    postActivityNote(chatwootAccountId, chatwootConversationId, note),
    addConversationLabel(chatwootAccountId, chatwootConversationId, `ticket-${displayId.toLowerCase()}`),
  ]);
}

/**
 * Called when a ticket's status changes.
 * Posts an activity note to the linked conversation.
 */
export async function onTicketStatusChanged(ticket, newStatus, actorName = 'agent') {
  const { chatwootAccountId, chatwootConversationId, id } = ticket;
  if (!chatwootConversationId) return;

  const displayId = `TKT-${String(id).slice(-6)}`;
  const emoji = { resolved: '✅', open: '🔓', 'in-progress': '🔄', pending: '⏸️' }[newStatus] ?? '📋';
  const note = `${emoji} Ticket ${displayId} status changed to **${newStatus}** by ${actorName}`;

  await postActivityNote(chatwootAccountId, chatwootConversationId, note);
}

/**
 * Called when a ticket reply/comment is added by an agent.
 * Mirrors it to the Chatwoot conversation as an outbound message.
 */
export async function onTicketReplied(ticket, messageContent, actorName = 'agent') {
  const { chatwootAccountId, chatwootConversationId } = ticket;
  if (!chatwootConversationId || !CHATWOOT_TOKEN) return;

  const url = `${CHATWOOT_URL}/api/v1/accounts/${chatwootAccountId}/conversations/${chatwootConversationId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': CHATWOOT_TOKEN,
      },
      body: JSON.stringify({
        content: `[${actorName}]: ${messageContent}`,
        message_type: 1,       // outbound
        content_type: 'text',
        private: true,          // internal note — not sent to customer
      }),
    });
    if (!res.ok) {
      log.warn({ chatwootAccountId, chatwootConversationId, status: res.status }, 'reply mirror failed');
    }
  } catch (e) {
    log.warn({ err: e.message }, 'reply mirror error');
  }
}

/**
 * Map an inbound Chatwoot message to a ticket timeline event type.
 * Used by the webhook handler to categorize messages.
 */
export function mapChatwootMessageType(msg) {
  if (msg.message_type === 0) return 'customer_message';   // incoming
  if (msg.message_type === 1) return 'agent_message';       // outgoing
  if (msg.message_type === 2) return 'activity';            // activity note
  return 'message';
}
