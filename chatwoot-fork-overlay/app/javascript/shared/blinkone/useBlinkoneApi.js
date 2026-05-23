/**
 * Gateway API client for BlinkOne telephony sidecars (IVR, routing).
 * Tokens from window.chatwootConfig.blinkone (injected in vueapp layout).
 */
import { computed, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useFeature as useFeatureGate } from './useFeature';

function tokens() {
  return window.chatwootConfig?.blinkone ?? {};
}

export function useBlinkoneApi() {
  const route = useRoute();
  const accountId = computed(() => route.params.accountId);

  /** Chatwoot account id maps to IVR/routing tenant_id. */
  const tenantId = computed(() => String(accountId.value ?? 'default'));

  async function request(service, path, { method = 'GET', body, tokenKey, headers: extraHeaders = {} } = {}) {
    const token = tokens()[tokenKey] || tokens().platformToken || tokens().aiToken || '';
    const headers = {
      Accept: 'application/json',
      'X-Blinkone-Tenant-Id': tenantId.value,
      ...extraHeaders,
    };
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`/api/${service}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}`);
    }
    return json.data ?? json;
  }

  const ivr = {
    listFlows: () => request('ivr', `/v1/flows?tenant_id=${encodeURIComponent(tenantId.value)}`),
    getFlow: id => request('ivr', `/v1/flows/${id}?tenant_id=${encodeURIComponent(tenantId.value)}`),
    createFlow: body =>
      request('ivr', `/v1/flows?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'ivrToken',
      }),
    patchFlow: (id, body) =>
      request('ivr', `/v1/flows/${id}?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'PATCH',
        body,
        tokenKey: 'ivrToken',
      }),
    listVersions: id =>
      request('ivr', `/v1/flows/${id}/versions?tenant_id=${encodeURIComponent(tenantId.value)}`),
    publishVersion: (id, body) =>
      request('ivr', `/v1/flows/${id}/versions?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'ivrToken',
      }),
  };

  const routing = {
    listQueues: () =>
      request('routing', `/v1/queues?tenant_id=${encodeURIComponent(tenantId.value)}`),
    createQueue: body =>
      request('routing', `/v1/queues?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'routingToken',
      }),
    queueStats: id =>
      request('routing', `/v1/queues/${id}/stats?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        tokenKey: 'routingToken',
      }),
    listAgents: () =>
      request('routing', `/v1/agents?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        tokenKey: 'routingToken',
      }),
    registerAgent: body =>
      request('routing', `/v1/agents?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'routingToken',
      }),
    setAgentState: (agentId, body) =>
      request('routing', `/v1/agents/${agentId}/state?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'routingToken',
      }),
    realtime: () =>
      request('routing', `/v1/dashboards/realtime?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        tokenKey: 'routingToken',
      }),
    agentReports: (query = {}) => {
      const qs = new URLSearchParams({ tenant_id: tenantId.value, ...query });
      return request('routing', `/v1/reports/agents?${qs}`, { tokenKey: 'routingToken' });
    },
    superviseSessions: () =>
      request('routing', `/v1/supervise/sessions?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        tokenKey: 'routingToken',
      }),
    superviseMode: (callId, body) =>
      request('routing', `/v1/supervise/${callId}/mode?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'routingToken',
      }),
    webrtc: agentId =>
      request('routing', `/v1/agents/${encodeURIComponent(agentId)}/webrtc?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        tokenKey: 'routingToken',
      }),
    realtimeWsUrl: () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}/api/routing/v1/realtime?tenant_id=${encodeURIComponent(tenantId.value)}`;
    },
  };

  const calls = {
    list: (query = {}) => {
      const qs = new URLSearchParams({ tenant_id: tenantId.value, ...query });
      return request('calls', `/v1/calls?${qs}`, { tokenKey: 'callsToken' });
    },
    listIncoming: (scope = 'all') => {
      const qs = new URLSearchParams({ tenant_id: tenantId.value, scope });
      return request('calls', `/v1/calls/incoming?${qs}`, { tokenKey: 'callsToken' });
    },
    get: id =>
      request('calls', `/v1/calls/${id}?tenant_id=${encodeURIComponent(tenantId.value)}`, { tokenKey: 'callsToken' }),
    answer: (id, body) =>
      request('calls', `/v1/calls/${id}/answer?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'callsToken',
      }),
    decline: (id, body) =>
      request('calls', `/v1/calls/${id}/decline?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'callsToken',
      }),
    hangup: (id, body) =>
      request('calls', `/v1/calls/${id}/hangup?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'callsToken',
      }),
    transfer: (id, body) =>
      request('calls', `/v1/calls/${id}/transfer?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'callsToken',
      }),
  };

  const sla = {
    listPolicies: () =>
      request('sla', `/v1/policies?tenant_id=${encodeURIComponent(tenantId.value)}`, { tokenKey: 'slaToken' }),
    createPolicy: body =>
      request('sla', `/v1/policies?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'slaToken',
      }),
    listCalendars: () =>
      request('sla', `/v1/calendars?tenant_id=${encodeURIComponent(tenantId.value)}`, { tokenKey: 'slaToken' }),
    createCalendar: body =>
      request('sla', `/v1/calendars?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'slaToken',
      }),
    dashboard: () =>
      request('sla', `/v1/dashboard?tenant_id=${encodeURIComponent(tenantId.value)}`, { tokenKey: 'slaToken' }),
    conversationSla: conversationId =>
      request('sla', `/v1/conversations/${conversationId}/sla?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        tokenKey: 'slaToken',
      }),
  };

  const escalation = {
    listRulesets: () =>
      request('escalations', `/v1/rulesets?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        tokenKey: 'escalationToken',
      }),
    createRuleset: body =>
      request('escalations', `/v1/rulesets?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'escalationToken',
      }),
    listRules: rulesetId =>
      request('escalations', `/v1/rulesets/${rulesetId}/rules?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        tokenKey: 'escalationToken',
      }),
    createRule: (rulesetId, body) =>
      request('escalations', `/v1/rulesets/${rulesetId}/rules?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'escalationToken',
      }),
    simulate: body =>
      request('escalations', `/v1/rules/simulate?tenant_id=${encodeURIComponent(tenantId.value)}`, {
        method: 'POST',
        body,
        tokenKey: 'escalationToken',
      }),
  };

  const ai = {
    health: () => request('ai', '/v1/health', { tokenKey: 'aiToken' }),
    chatCompletions: body =>
      request('ai', '/v1/chat/completions', { method: 'POST', body, tokenKey: 'aiToken' }),
    classifyTicket: body =>
      request('ai', '/v1/classify/ticket', { method: 'POST', body, tokenKey: 'aiToken' }),
    sentiment: body =>
      request('ai', '/v1/sentiment', { method: 'POST', body, tokenKey: 'aiToken' }),
    summarizeConversation: body =>
      request('ai', '/v1/summarize/conversation', { method: 'POST', body, tokenKey: 'aiToken' }),
    suggestReply: body =>
      request('ai', '/v1/suggest/reply', { method: 'POST', body, tokenKey: 'aiToken' }),
    listCollections: () => request('ai', '/v1/rag/collections', { tokenKey: 'aiToken' }),
    createCollection: body =>
      request('ai', '/v1/rag/collections', { method: 'POST', body, tokenKey: 'aiToken' }),
    indexDocument: body =>
      request('ai', '/v1/rag/index', { method: 'POST', body, tokenKey: 'aiToken' }),
    queryRag: body => request('ai', '/v1/rag/query', { method: 'POST', body, tokenKey: 'aiToken' }),
    createSttJob: body =>
      request('ai', '/v1/stt/jobs', { method: 'POST', body, tokenKey: 'aiToken' }),
    tts: body => request('ai', '/v1/tts', { method: 'POST', body, tokenKey: 'aiToken' }),
  };

  const billing = {
    listPlans: () => request('billing', '/v1/plans', { tokenKey: 'billingToken' }),
    patchPlan: (planId, body) =>
      request('billing', `/v1/plans/${encodeURIComponent(planId)}`, {
        method: 'PATCH',
        body,
        tokenKey: 'billingToken',
        headers: { 'X-Blinkone-Platform-Role': 'platform_admin' },
      }),
    createPlan: body =>
      request('billing', '/v1/plans', {
        method: 'POST',
        body,
        tokenKey: 'billingToken',
        headers: { 'X-Blinkone-Platform-Role': 'platform_admin' },
      }),
    platformOverview: () =>
      request('billing', '/v1/platform/overview', {
        tokenKey: 'billingToken',
        headers: { 'X-Blinkone-Platform-Role': 'platform_billing' },
      }),
    getUsage: tid =>
      request('billing', `/v1/tenants/${encodeURIComponent(tid)}/usage`, { tokenKey: 'billingToken' }),
    getUsageLimits: tid =>
      request('billing', `/v1/tenants/${encodeURIComponent(tid)}/usage/limits`, { tokenKey: 'billingToken' }),
    listInvoices: tid =>
      request('billing', `/v1/tenants/${encodeURIComponent(tid)}/invoices`, { tokenKey: 'billingToken' }),
    generateInvoice: tid =>
      request('billing', '/v1/invoices/generate', {
        method: 'POST',
        body: { tenantId: tid },
        tokenKey: 'billingToken',
      }),
    assignSubscription: (tid, body) =>
      request('billing', `/v1/tenants/${encodeURIComponent(tid)}/subscription`, {
        method: 'POST',
        body,
        tokenKey: 'billingToken',
      }),
    addPaymentMethod: body =>
      request('billing', '/v1/payment-methods', {
        method: 'POST',
        body,
        tokenKey: 'billingToken',
      }),
  };

  const integration = {
    listWebhooks: () => request('integrations', '/v1/webhooks', { tokenKey: 'integrationToken' }),
    createWebhook: body =>
      request('integrations', '/v1/webhooks', { method: 'POST', body, tokenKey: 'integrationToken' }),
    testWebhook: id =>
      request('integrations', `/v1/webhooks/${id}/test`, { method: 'POST', tokenKey: 'integrationToken' }),
    listDeliveries: () => request('integrations', '/v1/webhooks/deliveries', { tokenKey: 'integrationToken' }),
    retryDelivery: id =>
      request('integrations', `/v1/webhooks/deliveries/${id}/retry`, {
        method: 'POST',
        tokenKey: 'integrationToken',
      }),
    signatureDocs: () => request('integrations', '/v1/webhooks/signature-docs', { tokenKey: 'integrationToken' }),
    getSsoConfig: () => request('integrations', '/v1/sso/config', { tokenKey: 'integrationToken' }),
    saveSsoConfig: body =>
      request('integrations', '/v1/sso/config', { method: 'PUT', body, tokenKey: 'integrationToken' }),
    ssoLoginUrl: slug =>
      request('integrations', `/v1/sso/login?tenant=${encodeURIComponent(slug)}`, { tokenKey: 'integrationToken' }),
    listConnectorTypes: () => request('integrations', '/v1/connectors/types', { tokenKey: 'integrationToken' }),
    listConnectors: () => request('integrations', '/v1/connectors', { tokenKey: 'integrationToken' }),
    upsertConnector: (type, body) =>
      request('integrations', `/v1/connectors/${type}`, { method: 'PUT', body, tokenKey: 'integrationToken' }),
    testConnector: type =>
      request('integrations', `/v1/connectors/${type}/test`, { method: 'POST', tokenKey: 'integrationToken' }),
    listAudit: (query = {}) => {
      const qs = new URLSearchParams(query);
      return request('integrations', `/v1/audit?${qs}`, { tokenKey: 'integrationToken' });
    },
  };

  const platform = {
    listTenants: () =>
      request('tenant', '/v1/tenants', { tokenKey: 'platformToken', headers: { 'X-Blinkone-Platform-Role': 'platform_admin' } }),
    createTenant: body =>
      request('tenant', '/v1/tenants', {
        method: 'POST',
        body,
        tokenKey: 'platformToken',
        headers: { 'X-Blinkone-Platform-Role': 'platform_admin' },
      }),
    getTenant: id => request('tenant', `/v1/tenants/${id}`, { tokenKey: 'platformToken' }),
    suspendTenant: id =>
      request('tenant', `/v1/tenants/${id}/suspend`, {
        method: 'POST',
        tokenKey: 'platformToken',
        headers: { 'X-Blinkone-Platform-Role': 'platform_admin' },
      }),
    impersonate: id =>
      request('tenant', `/v1/tenants/${id}/impersonate`, {
        method: 'POST',
        tokenKey: 'platformToken',
        headers: { 'X-Blinkone-Platform-Role': 'platform_admin' },
      }),
    getUsage: id => request('tenant', `/v1/tenants/${id}/usage`, { tokenKey: 'platformToken' }),
    listDomains: id => request('tenant', `/v1/tenants/${id}/domains`, { tokenKey: 'platformToken' }),
    addDomain: (id, body) =>
      request('tenant', `/v1/tenants/${id}/domains`, {
        method: 'POST',
        body,
        tokenKey: 'platformToken',
        headers: { 'X-Blinkone-Platform-Role': 'platform_admin' },
      }),
    getBranding: id => request('tenant', `/v1/tenants/${id}/branding`, { tokenKey: 'aiToken' }),
    patchBranding: (id, body) =>
      request('tenant', `/v1/tenants/${id}/branding`, {
        method: 'PATCH',
        body,
        tokenKey: 'aiToken',
      }),
    patchTenant: (id, body) =>
      request('tenant', `/v1/tenants/${id}`, {
        method: 'PATCH',
        body,
        tokenKey: 'platformToken',
        headers: { 'X-Blinkone-Platform-Role': 'platform_admin' },
      }),
  };

  const features = ref({});
  const featuresLoaded = ref(false);

  async function loadFeatures() {
    if (featuresLoaded.value) return features.value;
    try {
      const t = await request('tenant', `/v1/tenants/${encodeURIComponent(tenantId.value)}`, {
        tokenKey: 'platformToken',
      });
      features.value = t.features ?? {};
    } catch {
      features.value = {};
    }
    featuresLoaded.value = true;
    return features.value;
  }

  const { enabled: callingPstnEnabled } = useFeatureGate('calling.pstn');
  const { enabled: callingWhatsappEnabled } = useFeatureGate('calling.whatsapp');
  const { enabled: telephonyEnabled } = useFeatureGate('telephony');
  const callingInboxEnabled = computed(
    () =>
      callingPstnEnabled.value ||
      callingWhatsappEnabled.value ||
      telephonyEnabled.value,
  );

  const usageLimits = ref(null);
  async function loadUsageLimits() {
    try {
      usageLimits.value = await billing.getUsageLimits(tenantId.value);
    } catch {
      usageLimits.value = { blocked: false };
    }
    return usageLimits.value;
  }
  const limitsExceeded = computed(() => usageLimits.value?.blocked === true);

  onMounted(() => {
    loadFeatures();
    loadUsageLimits();
  });

  return {
    tenantId,
    accountId,
    ivr,
    routing,
    sla,
    escalation,
    ai,
    billing,
    integration,
    platform,
    calls,
    features,
    loadFeatures,
    callingPstnEnabled,
    callingWhatsappEnabled,
    callingInboxEnabled,
    telephonyEnabled,
    useFeature: useFeatureGate,
    usageLimits,
    loadUsageLimits,
    limitsExceeded,
  };
}
