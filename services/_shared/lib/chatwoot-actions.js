import { getChatwootTokenForAccount, clearChatwootTokenCache } from './chatwoot-tenant-token.js';

const CHATWOOT_URL = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');

async function cwRequest(method, path, body, accountId, retried = false) {
  const token = await getChatwootTokenForAccount(accountId);
  const res = await fetch(`${CHATWOOT_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !retried) {
    clearChatwootTokenCache(accountId);
    return cwRequest(method, path, body, accountId, true);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Chatwoot ${method} ${path} → ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

export async function assignConversation(accountId, conversationId, assigneeId) {
  return cwRequest(
    'POST',
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/assignments`,
    { assignee_id: assigneeId },
    accountId,
  );
}

export async function assignConversationToTeam(accountId, conversationId, teamId) {
  return cwRequest(
    'POST',
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/assignments`,
    { team_id: teamId },
    accountId,
  );
}

export async function updateConversation(accountId, conversationId, patch) {
  return cwRequest(
    'PATCH',
    `/api/v1/accounts/${accountId}/conversations/${conversationId}`,
    patch,
    accountId,
  );
}

export async function addLabels(accountId, conversationId, labels) {
  return cwRequest(
    'POST',
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`,
    { labels },
    accountId,
  );
}

export async function postInternalNote(accountId, conversationId, content) {
  return cwRequest(
    'POST',
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
    {
      content,
      message_type: 'outgoing',
      private: true,
    },
    accountId,
  );
}
