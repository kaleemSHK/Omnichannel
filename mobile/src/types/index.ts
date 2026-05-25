// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface BlinkoneUser {
  id: number;
  name: string;
  email: string;
  role: 'agent' | 'supervisor' | 'admin' | 'platform_admin';
  tenantId: string;
  chatwootAccountId: number;
  avatarUrl?: string;
}

export interface AuthTokens {
  accessToken: string;     // Chatwoot user_access_token
  gatewayJwt: string;      // BlinkOne gateway JWT (tenant_id + roles)
}

// ─── Chatwoot core types ───────────────────────────────────────────────────────
export interface CWConversation {
  id: number;
  status: 'open' | 'resolved' | 'pending' | 'snoozed';
  inbox_id: number;
  meta: {
    sender: { id: number; name: string; avatar?: string };
    assignee?: { id: number; name: string };
    team?: { id: number; name: string };
  };
  last_activity_at: number;
  created_at: number;
  unread_count: number;
  labels: string[];
  channel: string;
}

export interface CWContact {
  id: number;
  name: string;
  email?: string;
  phone_number?: string;
  avatar_url?: string;
  location?: string;
  company?: { id: number; name: string };
  labels: string[];
  created_at: string;
}

export interface CWMessage {
  id: number;
  content: string;
  message_type: 0 | 1 | 2 | 3; // incoming | outgoing | activity | template
  content_type: string;
  created_at: number;
  sender?: { id: number; name: string; avatar_url?: string; type: string };
  attachments?: CWAttachment[];
}

export interface CWAttachment {
  id: number;
  file_type: string;
  data_url: string;
  thumb_url?: string;
}

export interface CWAgent {
  id: number;
  name: string;
  email: string;
  role: string;
  availability_status: 'online' | 'busy' | 'offline';
  avatar_url?: string;
}

export interface CWInbox {
  id: number;
  name: string;
  channel_type: string;
  avatar_url?: string;
  working_hours_enabled: boolean;
}

// ─── Calls sidecar ─────────────────────────────────────────────────────────────
export type CallStatus = 'ringing' | 'connected' | 'on_hold' | 'ended' | 'missed' | 'failed';
export type CallTransport = 'pstn' | 'whatsapp';
export type CallDirection = 'inbound' | 'outbound';

export interface CallSession {
  id: string;
  tenantId: string;
  roomId: string;
  channel: string;
  agentLabel: string;
  customerPhone: string;
  queueKey?: string;
  status: CallStatus;
  transport: CallTransport;
  direction: CallDirection;
  startedAt: string;
  connectedAt?: string;
  endedAt?: string;
  durationMs?: number;
  outcome?: string;
  conversationId?: string;
  contactId?: string;
}

export interface CDRRecord {
  id: string;
  tenantId: string;
  callSessionId: string;
  agentId: string;
  customerId?: string;
  direction: CallDirection;
  transport: CallTransport;
  duration: number;
  outcome: string;
  recordingId?: string;
  startedAt: string;
}

export interface CDRFilters {
  page?: number;
  from?: string;
  to?: string;
  agentId?: string;
  limit?: number;
}

// ─── Routing sidecar ───────────────────────────────────────────────────────────
export type AgentState = 'available' | 'busy' | 'break' | 'offline';

export interface RoutingAgent {
  id: string;
  tenantId: string;
  agentId: string;
  name: string;
  state: AgentState;
  skills: string[];
  currentCallId?: string;
  lastStateChange: string;
}

export interface Queue {
  id: string;
  tenantId: string;
  queueKey: string;
  name: string;
  skills: string[];
  selectionAlgorithm: string;
  maxWaitSec: number;
  maxDepth: number;
  stats?: QueueStats;
}

export interface QueueStats {
  waiting: number;
  available: number;
  busy: number;
  avgWaitSec: number;
  slaPercent: number;
}

// ─── SLA sidecar ──────────────────────────────────────────────────────────────
export interface SLAPolicy {
  id: string;
  tenantId: string;
  name: string;
  tier: 'gold' | 'silver' | 'bronze' | 'custom';
  firstResponseMinutes: number;
  resolutionHours: number;
  escalationHours: number;
  calendarId?: string;
}

export interface SLAInstance {
  id: string;
  conversationId: string;
  policyId: string;
  status: 'active' | 'breached' | 'met' | 'paused';
  firstResponseDeadline: string;
  resolutionDeadline: string;
  breachedAt?: string;
  metAt?: string;
  contact?: { name: string; tier: string };
  subject?: string;
}

// ─── IVR sidecar ──────────────────────────────────────────────────────────────
export interface IVRFlow {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: number;
  nodes: IVRNode[];
  edges: IVREdge[];
  isActive: boolean;
}

export interface IVRNode {
  id: string;
  type: 'play' | 'voicebot' | 'dtmf' | 'transfer' | 'hangup' | 'condition';
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface IVREdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

// ─── AI sidecar ───────────────────────────────────────────────────────────────
export interface AIAssistResponse {
  suggestion: string;
  confidence: number;
  intent?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  language?: string;
  ragSources?: RAGSource[];
}

export interface RAGSource {
  id: string;
  title: string;
  excerpt: string;
  score: number;
  collectionId: string;
}

// ─── Billing sidecar ──────────────────────────────────────────────────────────
export interface BillingSubscription {
  tenantId: string;
  planId: string;
  planName: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trial';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  seats: number;
  includedSeats: number;
  monthlyAmount: number;
  currency: 'OMR';
}

export interface UsageMetric {
  key: string;
  label: string;
  used: number;
  included: number;
  unit: string;
  overageRate?: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  period: string;
  amount: number;
  currency: 'OMR';
  status: 'paid' | 'due' | 'overdue';
  issuedAt: string;
  dueAt: string;
  pdfUrl?: string;
}

// ─── Tickets sidecar ──────────────────────────────────────────────────────────
export interface Ticket {
  id: string;
  tenantId: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'p1' | 'p2' | 'p3' | 'p4';
  assigneeId?: string;
  contactId?: string;
  conversationId?: string;
  createdAt: string;
  updatedAt: string;
  slaInstanceId?: string;
}

// ─── Escalation sidecar ───────────────────────────────────────────────────────
export interface EscalationRuleset {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  rules: EscalationRule[];
}

export interface EscalationRule {
  id: string;
  rulesetId: string;
  conditions: EscalationCondition[];
  actions: EscalationAction[];
  firedCount?: number;
  lastFiredAt?: string;
}

export interface EscalationCondition {
  field: string;
  operator: string;
  value: string | number;
}

export interface EscalationAction {
  type: string;
  params: Record<string, unknown>;
}

// ─── Platform / tenants sidecar ───────────────────────────────────────────────
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  domain: string;
  plan: 'trial' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'trial';
  features: TenantFeatures;
  agentCount: number;
  createdAt: string;
}

export interface TenantFeatures {
  telephony: boolean;
  pstn: boolean;
  whatsappCalling: boolean;
  rag: boolean;
  voiceBot: boolean;
  sla: boolean;
  outboundDialer: boolean;
}

// ─── Generic API response ──────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  meta?: {
    count?: number;
    current_page?: number;
    next_page?: number;
    total_pages?: number;
    total_count?: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

// ─── Conversation filters (used by useConversations hook) ─────────────────────
export interface ConversationFilters {
  status?: 'open' | 'resolved' | 'pending' | 'all';
  inboxId?: number;
  teamId?: number;
  assigneeId?: number;
  labels?: string[];
  page?: number;
  limit?: number;
}

// --- Mobile-specific ----------------------------------------------------------
export type AppRole = 'customer' | 'agent';

export interface CustomerSession {
  contactId?: number;
  conversationId?: number;
  guestToken?: string;
}

export interface IncomingCallInfo {
  callId: string;
  callerName: string;
  callerNumber: string;
  queueKey?: string;
  startedAt: string;
}
