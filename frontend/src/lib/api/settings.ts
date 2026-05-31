/**
 * Chatwoot Settings API — all /api/v1/accounts/:id/... settings endpoints
 */
import { normalizeLabel, normalizeLabelList } from '@/lib/labels/normalize';
import { cwFetch, BlinkoneApiError } from './client';
import { useAuthStore } from '@/lib/store/auth';

function aid() {
  return useAuthStore.getState().user?.chatwootAccountId ?? 0;
}

function unwrapArray<T>(res: T[] | { payload?: T[] }): T[] {
  if (Array.isArray(res)) return res;
  return res.payload ?? [];
}

// Chatwoot dashboard posts flat JSON; Rails wrap_parameters adds :label server-side.
function labelBody(data: Partial<Label> | Omit<Label, 'id'>) {
  return JSON.stringify(data);
}

// ─── Account ─────────────────────────────────────────────────────────────────
export interface AccountSettings {
  id: number;
  name: string;
  domain?: string;
  timezone: string;
  locale: string;
  support_email?: string;
  features: Record<string, boolean>;
}

export async function getAccount(): Promise<AccountSettings> {
  return cwFetch(`/accounts/${aid()}`);
}

export async function updateAccount(data: Partial<AccountSettings>): Promise<AccountSettings> {
  return cwFetch(`/accounts/${aid()}`, { method: 'PATCH', body: JSON.stringify(data) });
}

// ─── Agents ──────────────────────────────────────────────────────────────────
export interface Agent {
  id: number;
  name: string;
  email: string;
  role: 'agent' | 'administrator';
  availability_status: 'online' | 'busy' | 'offline';
  avatar_url?: string;
  confirmed: boolean;
}

export async function listAgents(): Promise<Agent[]> {
  const res = await cwFetch<Agent[] | { payload?: Agent[] }>(`/accounts/${aid()}/agents`);
  return unwrapArray(res);
}

export async function createAgent(data: { name: string; email: string; role: string }): Promise<Agent> {
  return cwFetch(`/accounts/${aid()}/agents`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAgent(id: number, data: Partial<Agent>): Promise<Agent> {
  return cwFetch(`/accounts/${aid()}/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteAgent(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/agents/${id}`, { method: 'DELETE' });
}

// ─── Teams ───────────────────────────────────────────────────────────────────
export interface Team {
  id: number;
  name: string;
  description?: string;
  agents_count?: number;
}

export async function listTeams(): Promise<Team[]> {
  const res = await cwFetch<Team[] | { payload?: Team[] }>(`/accounts/${aid()}/teams`);
  return unwrapArray(res);
}

export async function createTeam(data: { name: string; description?: string }): Promise<Team> {
  return cwFetch(`/accounts/${aid()}/teams`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTeam(id: number, data: Partial<Team>): Promise<Team> {
  return cwFetch(`/accounts/${aid()}/teams/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteTeam(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/teams/${id}`, { method: 'DELETE' });
}

export async function getTeamAgents(teamId: number): Promise<Agent[]> {
  const res = await cwFetch<Agent[] | { payload?: Agent[] }>(
    `/accounts/${aid()}/teams/${teamId}/team_members`,
  );
  return unwrapArray(res);
}

export async function updateTeamAgents(teamId: number, userIds: number[]): Promise<void> {
  return cwFetch(`/accounts/${aid()}/teams/${teamId}/team_members`, {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds }),
  });
}

// ─── Labels ──────────────────────────────────────────────────────────────────
export interface Label {
  id: number;
  title: string;
  description?: string;
  color: string;
  show_on_sidebar: boolean;
}

export async function listLabels(): Promise<{ payload: Label[] }> {
  const res = await cwFetch<{ payload: Label[] } | Label[]>(`/accounts/${aid()}/labels`);
  const raw = Array.isArray(res) ? res : (res.payload ?? []);
  return { payload: normalizeLabelList(raw) };
}

export async function createLabel(data: Omit<Label, 'id'>): Promise<{ payload: Label }> {
  const res = await cwFetch<unknown>(`/accounts/${aid()}/labels`, {
    method: 'POST',
    body: labelBody(data),
  });
  let label = normalizeLabel(res, data);
  if (!label?.id) {
    const listed = await listLabels();
    label =
      listed.payload.find(
        l => l.title === data.title.trim().toLowerCase(),
      ) ?? null;
  }
  if (!label?.id) {
    throw new BlinkoneApiError(
      'LABEL_CREATE_FAILED',
      'Label was created but the server response could not be read. Refresh the page.',
      0,
    );
  }
  return { payload: label };
}

export async function updateLabel(id: number, data: Partial<Label>): Promise<{ payload: Label }> {
  const res = await cwFetch<unknown>(
    `/accounts/${aid()}/labels/${id}`,
    { method: 'PATCH', body: labelBody(data) },
  );
  const label = normalizeLabel(res, { id, ...data });
  if (!label?.id) {
    throw new BlinkoneApiError(
      'LABEL_UPDATE_FAILED',
      'Label update failed or response was invalid.',
      0,
    );
  }
  return { payload: label };
}

export async function deleteLabel(id: number, title?: string): Promise<void> {
  const accountPath = `/accounts/${aid()}/labels`;

  async function destroy(labelId: number): Promise<void> {
    await cwFetch(`${accountPath}/${labelId}`, { method: 'DELETE' });
  }

  try {
    await destroy(id);
    return;
  } catch (e) {
    if (!(e instanceof BlinkoneApiError) || e.status !== 404) throw e;
  }

  // Stale UI id — resolve by title from a fresh list, then delete or treat as gone
  if (!title?.trim()) return;

  const { payload } = await listLabels();
  const match = payload.find(
    l => l.title.toLowerCase() === title.toLowerCase().trim(),
  );
  if (!match) return;

  if (match.id === id) return;

  try {
    await destroy(match.id);
  } catch (e) {
    if (e instanceof BlinkoneApiError && e.status === 404) return;
    throw e;
  }
}

// ─── Custom Attributes ───────────────────────────────────────────────────────
export type AttrType = 'text' | 'number' | 'boolean' | 'date' | 'list' | 'link';
export type AttrEntity = 'conversation_attribute' | 'contact_attribute';

export interface CustomAttribute {
  id: number;
  attribute_display_name: string;
  attribute_key: string;
  attribute_display_type: AttrType;
  attribute_model: AttrEntity;
  default_value?: string;
  attribute_values?: string[];
}

export async function listCustomAttributes(model: AttrEntity): Promise<CustomAttribute[]> {
  const res = await cwFetch<CustomAttribute[] | { payload?: CustomAttribute[] }>(
    `/accounts/${aid()}/custom_attribute_definitions?attribute_model=${model}`,
  );
  return unwrapArray(res);
}

export async function createCustomAttribute(data: {
  attribute_display_name: string;
  attribute_key: string;
  attribute_display_type: AttrType;
  attribute_model: AttrEntity;
  attribute_values?: string[];
}): Promise<CustomAttribute> {
  return cwFetch(`/accounts/${aid()}/custom_attribute_definitions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteCustomAttribute(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/custom_attribute_definitions/${id}`, { method: 'DELETE' });
}

// ─── Automation ──────────────────────────────────────────────────────────────
export interface AutomationRule {
  id: number;
  name: string;
  description?: string;
  event_name: string;
  active: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
}

export interface AutomationCondition {
  attribute_key: string;
  filter_operator: string;
  values: string[];
  query_operator: 'AND' | 'OR' | 'and' | 'or' | null;
}

export interface AutomationAction {
  action_name: string;
  action_params: unknown[];
}

/** Chatwoot expects inbox_id / team_id / labels keys and string action_params. */
function normalizeAutomationPayload(data: Partial<AutomationRule>): Partial<AutomationRule> {
  const conditions = data.conditions?.map((c, index) => {
    let key = c.attribute_key;
    if (key === 'inbox') key = 'inbox_id';
    if (key === 'team') key = 'team_id';
    if (key === 'assignee') key = 'assignee_id';
    if (key === 'language') key = 'conversation_language';
    if (key === 'label') key = 'labels';

    const row: AutomationCondition = {
      attribute_key: key,
      filter_operator: c.filter_operator,
      values: (c.values ?? []).map(v => String(v)),
      query_operator: c.query_operator ?? (index === 0 ? null : 'and'),
    };
    // Chatwoot rejects null query_operator on some versions — omit when unset
    if (row.query_operator == null) {
      return { ...row, query_operator: null };
    }
    return row;
  });

  const actions = data.actions?.map(a => ({
    action_name: a.action_name,
    action_params: (a.action_params ?? []).map(p => String(p)),
  }));

  return {
    ...data,
    ...(conditions ? { conditions } : {}),
    ...(actions ? { actions } : {}),
  };
}

export async function listAutomations(): Promise<{ payload: AutomationRule[] }> {
  const res = await cwFetch<{ payload: AutomationRule[] } | AutomationRule[]>(
    `/accounts/${aid()}/automation_rules`,
  );
  if (Array.isArray(res)) return { payload: res };
  return { payload: res.payload ?? [] };
}

export async function createAutomation(data: Partial<AutomationRule>): Promise<{ payload: AutomationRule }> {
  return cwFetch(`/accounts/${aid()}/automation_rules`, {
    method: 'POST',
    body: JSON.stringify(normalizeAutomationPayload(data)),
  });
}

export async function updateAutomation(
  id: number,
  data: Partial<AutomationRule>,
): Promise<{ payload: AutomationRule }> {
  return cwFetch(`/accounts/${aid()}/automation_rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(normalizeAutomationPayload(data)),
  });
}

export async function deleteAutomation(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/automation_rules/${id}`, { method: 'DELETE' });
}

// ─── Agent Bots ──────────────────────────────────────────────────────────────
export interface AgentBot {
  id: number;
  name: string;
  description?: string;
  outgoing_url: string;
  bot_type: 'webhook' | 'agent_ai';
}

export async function listBots(): Promise<AgentBot[]> {
  const res = await cwFetch<AgentBot[] | { payload?: AgentBot[] }>(`/accounts/${aid()}/agent_bots`);
  return unwrapArray(res);
}

export async function createBot(data: Omit<AgentBot, 'id'>): Promise<AgentBot> {
  return cwFetch(`/accounts/${aid()}/agent_bots`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBot(id: number, data: Partial<AgentBot>): Promise<AgentBot> {
  return cwFetch(`/accounts/${aid()}/agent_bots/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteBot(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/agent_bots/${id}`, { method: 'DELETE' });
}

// ─── Macros ──────────────────────────────────────────────────────────────────
export type MacroVisibility = 'global' | 'personal';

export interface Macro {
  id: number;
  name: string;
  visibility: MacroVisibility;
  actions: MacroAction[];
  created_at: string;
  updated_at: string;
}

export interface MacroAction {
  action: string;
  action_params: unknown[];
}

export async function listMacros(): Promise<{ payload: Macro[] }> {
  const res = await cwFetch<{ payload: Macro[] } | Macro[]>(`/accounts/${aid()}/macros`);
  if (Array.isArray(res)) return { payload: res };
  return { payload: res.payload ?? [] };
}

export async function getMacro(id: number): Promise<{ payload: Macro }> {
  return cwFetch(`/accounts/${aid()}/macros/${id}`);
}

export async function createMacro(data: Partial<Macro>): Promise<{ payload: Macro }> {
  return cwFetch(`/accounts/${aid()}/macros`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateMacro(id: number, data: Partial<Macro>): Promise<{ payload: Macro }> {
  return cwFetch(`/accounts/${aid()}/macros/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteMacro(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/macros/${id}`, { method: 'DELETE' });
}

// ─── Canned Responses ────────────────────────────────────────────────────────
export interface CannedResponse {
  id: number;
  short_code: string;
  content: string;
}

export async function listCannedResponses(search?: string): Promise<CannedResponse[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await cwFetch<CannedResponse[] | { payload?: CannedResponse[] }>(
    `/accounts/${aid()}/canned_responses${q}`,
  );
  return unwrapArray(res);
}

export async function createCannedResponse(data: Omit<CannedResponse, 'id'>): Promise<CannedResponse> {
  return cwFetch(`/accounts/${aid()}/canned_responses`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCannedResponse(
  id: number,
  data: Partial<CannedResponse>,
): Promise<CannedResponse> {
  return cwFetch(`/accounts/${aid()}/canned_responses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCannedResponse(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/canned_responses/${id}`, { method: 'DELETE' });
}

// ─── Integrations / App Connections ─────────────────────────────────────────
export interface IntegrationHook {
  id: string;
  app_id: string;
  settings: Record<string, string>;
}

export async function listHooks(appId: string): Promise<IntegrationHook[]> {
  const res = await cwFetch<IntegrationHook[] | { payload?: IntegrationHook[] }>(
    `/accounts/${aid()}/integrations/hooks?app_id=${appId}`,
  );
  return unwrapArray(res);
}

export async function createHook(data: Omit<IntegrationHook, 'id'>): Promise<IntegrationHook> {
  return cwFetch(`/accounts/${aid()}/integrations/hooks`, { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteHook(id: string): Promise<void> {
  return cwFetch(`/accounts/${aid()}/integrations/hooks/${id}`, { method: 'DELETE' });
}

// ─── Webhooks (Chatwoot) ─────────────────────────────────────────────────────
export interface CWWebhook {
  id: number;
  url: string;
  subscriptions: string[];
}

export async function listWebhooks(): Promise<CWWebhook[]> {
  const res = await cwFetch<CWWebhook[] | { payload?: CWWebhook[] }>(
    `/accounts/${aid()}/integrations/webhooks`,
  );
  return Array.isArray(res) ? res : (res.payload ?? []);
}

export async function createWebhook(data: {
  url: string;
  subscriptions: string[];
}): Promise<CWWebhook> {
  return cwFetch(`/accounts/${aid()}/integrations/webhooks`, {
    method: 'POST',
    body: JSON.stringify({ webhook: data }),
  });
}

export async function updateWebhook(
  id: number,
  data: { url?: string; subscriptions?: string[] },
): Promise<CWWebhook> {
  return cwFetch(`/accounts/${aid()}/integrations/webhooks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ webhook: data }),
  });
}

export async function deleteWebhook(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/integrations/webhooks/${id}`, { method: 'DELETE' });
}

// ─── Profile (Chatwoot) ──────────────────────────────────────────────────────
export interface CWProfile {
  id: number;
  name: string;
  email: string;
  phone_number?: string;
  avatar_url?: string;
  availability_status: 'online' | 'busy' | 'offline';
  display_name?: string;
}

export async function getProfile(): Promise<CWProfile> {
  return cwFetch('/profile');
}

export async function updateProfile(data: {
  name?: string;
  email?: string;
  phone_number?: string;
  display_name?: string;
  password?: string;
  password_confirmation?: string;
  current_password?: string;
}): Promise<CWProfile> {
  return cwFetch('/profile', { method: 'PUT', body: JSON.stringify(data) });
}

export async function updateAvailability(
  availability: 'online' | 'busy' | 'offline',
): Promise<CWProfile> {
  return cwFetch('/profile', {
    method: 'PUT',
    body: JSON.stringify({ availability }),
  });
}

// ─── Notifications (Chatwoot) ────────────────────────────────────────────────
export interface NotificationPreferences {
  notification_type: string;
  email: boolean;
  push: boolean;
}

export async function getNotificationPreferences(): Promise<{
  selected_email_flags: string[];
  selected_push_flags: string[];
}> {
  return cwFetch('/profile/notifications');
}

export async function updateNotificationPreferences(data: {
  notifications: { notification_type: string; email: boolean; push: boolean }[];
}): Promise<void> {
  return cwFetch('/profile/notifications', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── Business Hours (Chatwoot Account) ──────────────────────────────────────
export interface BusinessHourEntry {
  closed_all_day: boolean;
  day_of_week: number;
  name: string;
  open_hour: number;
  open_minutes: number;
  close_hour: number;
  close_minutes: number;
}

export async function getBusinessHours(): Promise<BusinessHourEntry[]> {
  const res = await cwFetch<BusinessHourEntry[] | { working_hours?: BusinessHourEntry[] }>(
    `/accounts/${aid()}/business_hours`,
  );
  return Array.isArray(res) ? res : (res.working_hours ?? []);
}

export async function updateBusinessHours(hours: BusinessHourEntry[]): Promise<void> {
  return cwFetch(`/accounts/${aid()}/business_hours`, {
    method: 'PUT',
    body: JSON.stringify({ working_hours: hours }),
  });
}

// ─── Integrations — Chatwoot App list ────────────────────────────────────────
export interface CWIntegrationApp {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
}

export async function listIntegrationApps(): Promise<{ payload: CWIntegrationApp[] }> {
  const res = await cwFetch<{ payload: CWIntegrationApp[] } | CWIntegrationApp[]>(
    `/accounts/${aid()}/integrations/apps`,
  );
  if (Array.isArray(res)) return { payload: res };
  return { payload: res.payload ?? [] };
}
