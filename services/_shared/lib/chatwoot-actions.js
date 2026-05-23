const CHATWOOT_URL = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const CHATWOOT_TOKEN = (process.env.CHATWOOT_BOT_TOKEN || process.env.CHATWOOT_API_TOKEN || '').trim();

async function cwRequest(method, path, body) {
  if (!CHATWOOT_TOKEN) throw new Error('CHATWOOT_BOT_TOKEN not configured');
  const res = await fetch(`${CHATWOOT_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: CHATWOOT_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
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
  );
}

export async function assignConversationToTeam(accountId, conversationId, teamId) {
  return cwRequest(
    'POST',
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/assignments`,
    { team_id: teamId },
  );
}

export async function updateConversation(accountId, conversationId, patch) {
  return cwRequest('PATCH', `/api/v1/accounts/${accountId}/conversations/${conversationId}`, patch);
}

export async function addLabels(accountId, conversationId, labels) {
  return cwRequest('POST', `/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`, { labels });
}

export async function postInternalNote(accountId, conversationId, content) {
  return cwRequest('POST', `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, {
    content,
    message_type: 'outgoing',
    private: true,
  });
}
