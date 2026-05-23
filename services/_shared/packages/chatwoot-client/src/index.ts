export interface ChatwootClientOptions {
  baseUrl: string;
  apiAccessToken: string;
}

export class ChatwootClient {
  constructor(private readonly opts: ChatwootClientOptions) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    apiToken?: string,
  ): Promise<T> {
    const url = `${this.opts.baseUrl.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        api_access_token: apiToken ?? this.opts.apiAccessToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Chatwoot ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  getConversation(accountId: number, conversationId: number) {
    return this.request('GET', `/api/v1/accounts/${accountId}/conversations/${conversationId}`);
  }

  sendMessage(accountId: number, conversationId: number, content: string) {
    return this.request('POST', `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, {
      content,
    });
  }

  addAgent(accountId: number, conversationId: number, userId: number) {
    return this.request('POST', `/api/v1/accounts/${accountId}/conversations/${conversationId}/assignments`, {
      assignee_id: userId,
    });
  }

  listInboxes(accountId: number) {
    return this.request('GET', `/api/v1/accounts/${accountId}/inboxes`);
  }

  createConversation(accountId: number, payload: Record<string, unknown>) {
    return this.request('POST', `/api/v1/accounts/${accountId}/conversations`, payload);
  }

  createContact(accountId: number, payload: Record<string, unknown>) {
    return this.request('POST', `/api/v1/accounts/${accountId}/contacts`, payload);
  }

  attachFile(accountId: number, conversationId: number, formData: FormData) {
    const url = `${this.opts.baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
    return fetch(url, {
      method: 'POST',
      headers: { api_access_token: this.opts.apiAccessToken },
      body: formData,
    });
  }

  listAccounts() {
    return this.request('GET', '/platform/api/v1/accounts', undefined, this.opts.apiAccessToken);
  }

  createAccount(payload: Record<string, unknown>) {
    return this.request('POST', '/platform/api/v1/accounts', payload);
  }

  getAccountWebhooks(accountId: number) {
    return this.request('GET', `/platform/api/v1/accounts/${accountId}/webhooks`);
  }

  createWebhook(accountId: number, payload: Record<string, unknown>) {
    return this.request('POST', `/platform/api/v1/accounts/${accountId}/webhooks`, payload);
  }
}
