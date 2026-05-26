import type { PlatformTenantView } from '@/lib/utils/platform';
import { defaultFeatures } from '@/lib/utils/platform';
import type {
  PlatformAdmin,
  StorageTenantStat,
  HealthAllResult,
  AuditEvent,
  AlertRule,
} from '@/lib/api/platform';

export const DEMO_PLATFORM_TENANTS: PlatformTenantView[] = [
  {
    id: '1',
    slug: 'labbik-telecom',
    name: 'LABBIK Telecom',
    domain: 'labbik.blinkone.local',
    plan: 'enterprise',
    status: 'active',
    agentCount: 42,
    createdAt: '2025-01-15T00:00:00Z',
    location: 'Muscat, OM',
    features: defaultFeatures({
      pstn: true,
      whatsappCalling: true,
      aiAssist: true,
      ivr: true,
      sla: true,
      voiceBot: false,
      rag: true,
      billing: true,
      telephony: true,
    }),
  },
  {
    id: '2',
    slug: 'gulf-retail',
    name: 'Gulf Retail Group',
    domain: 'gulf-retail.blinkone.local',
    plan: 'pro',
    status: 'active',
    agentCount: 18,
    createdAt: '2025-06-01T00:00:00Z',
    location: 'Dubai, AE',
    features: defaultFeatures({
      pstn: true,
      whatsappCalling: true,
      aiAssist: true,
      ivr: false,
      sla: true,
      voiceBot: false,
      rag: true,
      billing: true,
    }),
  },
  {
    id: '3',
    slug: 'oman-startup',
    name: 'Oman Startup Hub',
    domain: 'startup.blinkone.local',
    plan: 'starter',
    status: 'trial',
    agentCount: 5,
    createdAt: '2026-04-01T00:00:00Z',
    location: 'Salalah, OM',
    features: defaultFeatures({
      pstn: false,
      whatsappCalling: true,
      aiAssist: false,
      ivr: false,
      sla: false,
      voiceBot: false,
      rag: false,
      billing: false,
    }),
  },
  {
    id: '4',
    slug: 'legacy-corp',
    name: 'Legacy Corp (suspended)',
    domain: 'legacy.blinkone.local',
    plan: 'pro',
    status: 'suspended',
    agentCount: 0,
    createdAt: '2024-11-20T00:00:00Z',
    location: 'Muscat, OM',
    features: defaultFeatures({
      pstn: true,
      whatsappCalling: false,
      aiAssist: false,
      ivr: true,
      sla: true,
      voiceBot: false,
      rag: false,
      billing: true,
    }),
  },
];

// ─── P1: Demo admins ─────────────────────────────────────────────────────────

export const DEMO_ADMINS: PlatformAdmin[] = [
  {
    id: 'adm-001',
    email: 'kalim@blinkone.io',
    name: 'Kalim Sheikh',
    role: 'platform_admin',
    status: 'active',
    createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'adm-002',
    email: 'ops@blinkone.io',
    name: 'Ops Lead',
    role: 'platform_admin',
    status: 'active',
    createdAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'adm-003',
    email: 'readonly@blinkone.io',
    name: 'Readonly User',
    role: 'platform_viewer',
    status: 'invited',
    createdAt: '2026-05-20T00:00:00Z',
  },
];

// ─── P1: Demo storage stats ───────────────────────────────────────────────────

export const DEMO_STORAGE_STATS: StorageTenantStat[] = [
  { tenantId: '1', tenantName: 'LABBIK Telecom',       plan: 'enterprise', recordings_gb: 38, assets_gb: 6,  ai_gb: 11, total_gb: 55, quota_gb: 500 },
  { tenantId: '2', tenantName: 'Gulf Retail Group',    plan: 'pro',        recordings_gb: 22, assets_gb: 4,  ai_gb: 5,  total_gb: 31, quota_gb: 100 },
  { tenantId: '3', tenantName: 'Oman Startup Hub',     plan: 'starter',    recordings_gb: 6,  assets_gb: 2,  ai_gb: 2,  total_gb: 10, quota_gb: 25  },
  { tenantId: '4', tenantName: 'Legacy Corp',          plan: 'pro',        recordings_gb: 0,  assets_gb: 0,  ai_gb: 0,  total_gb: 0,  quota_gb: 100 },
];

// ─── P1: Demo health ─────────────────────────────────────────────────────────

export const DEMO_HEALTH: HealthAllResult = {
  overall: 'healthy',
  checkedAt: new Date().toISOString(),
  services: [
    { name: 'gateway',     status: 'up',      latency_ms: 12  },
    { name: 'routing',     status: 'up',      latency_ms: 18  },
    { name: 'ivr',         status: 'up',      latency_ms: 22  },
    { name: 'ai',          status: 'up',      latency_ms: 45  },
    { name: 'sla',         status: 'up',      latency_ms: 15  },
    { name: 'billing',     status: 'up',      latency_ms: 20  },
    { name: 'integration', status: 'up',      latency_ms: 17  },
    { name: 'calls',       status: 'up',      latency_ms: 14  },
    { name: 'recording',   status: 'up',      latency_ms: 23  },
    { name: 'tenant',      status: 'up',      latency_ms: 9   },
  ],
};

// ─── P1: Demo audit log ───────────────────────────────────────────────────────

export const DEMO_AUDIT_LOG: AuditEvent[] = [
  { id: 'ev-001', ts: '2026-05-27T10:31:00Z', action: 'tenant.feature_updated',  resourceType: 'tenant', tenantId: '1', actorEmail: 'kalim@blinkone.io' },
  { id: 'ev-002', ts: '2026-05-27T10:15:00Z', action: 'tenant.created',          resourceType: 'tenant', tenantId: '3', actorEmail: 'kalim@blinkone.io' },
  { id: 'ev-003', ts: '2026-05-27T09:42:00Z', action: 'api_key.created',         resourceType: 'apiKey', tenantId: '2', actorEmail: 'ops@blinkone.io'   },
  { id: 'ev-004', ts: '2026-05-27T09:10:00Z', action: 'admin.invited',           resourceType: 'admin',  tenantId: null, actorEmail: 'kalim@blinkone.io' },
  { id: 'ev-005', ts: '2026-05-27T08:55:00Z', action: 'tenant.impersonated',     resourceType: 'tenant', tenantId: '2', actorEmail: 'kalim@blinkone.io' },
  { id: 'ev-006', ts: '2026-05-26T17:30:00Z', action: 'tenant.status_changed',   resourceType: 'tenant', tenantId: '4', actorEmail: 'ops@blinkone.io'   },
  { id: 'ev-007', ts: '2026-05-26T15:00:00Z', action: 'alert.created',           resourceType: 'alert',  tenantId: null, actorEmail: 'kalim@blinkone.io' },
  { id: 'ev-008', ts: '2026-05-26T12:00:00Z', action: 'branding.updated',        resourceType: 'tenant', tenantId: '1', actorEmail: 'ops@blinkone.io'   },
];

// ─── P1: Demo alert rules ─────────────────────────────────────────────────────

export const DEMO_ALERTS: AlertRule[] = [
  {
    id: 'alr-001',
    name: 'SLA breach spike',
    condition: 'sla_breach_rate > threshold',
    threshold: 20,
    channels: ['email', 'slack'],
    enabled: true,
    createdAt: '2026-05-20T00:00:00Z',
  },
  {
    id: 'alr-002',
    name: 'Service down',
    condition: 'service_status == down',
    threshold: null,
    channels: ['email', 'pagerduty'],
    enabled: true,
    createdAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'alr-003',
    name: 'Storage quota warning',
    condition: 'storage_used_pct > threshold',
    threshold: 80,
    channels: ['email'],
    enabled: false,
    createdAt: '2026-03-15T00:00:00Z',
  },
];
