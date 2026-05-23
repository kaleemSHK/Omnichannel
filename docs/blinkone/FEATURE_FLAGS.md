# BlinkOne feature flags

Enterprise capabilities are **not** Chatwoot Enterprise code. Each capability is gated by `tenant_features` (per workspace) and optionally seeded from `billing_plans.features` when a subscription is assigned.

## Feature keys

| Key | Service | Description |
|-----|---------|-------------|
| `sla` | `services/sla` | SLA policies, calendars, breach worker |
| `escalation` | `services/escalation` | JSON-Logic escalation rules |
| `sso` | `services/integration` | Keycloak OIDC per tenant |
| `audit` | `services/integration` | Immutable audit log read API |
| `agent_assist` | `services/ai` | Reply suggestions, summaries |
| `voice_bot` | `services/ai` | Arabic voice bot sessions |
| `rag` | `services/ai` | Knowledge base / RAG collections |
| `telephony` | routing, ivr, calls | Core telephony sidecars |
| `calling.pstn` | calls, Vue calling UI | PSTN / JsSIP agent calling |
| `calling.whatsapp` | whatsapp-calls | WhatsApp Business calling |
| `telephony.supervisor` | routing | Listen / whisper / barge |
| `telephony.reports` | routing | CDR / performance reports |
| `white_label` | tenant | Extra branding (Enterprise plan) |

## Plan defaults

| Plan id | SLA | Escalation | SSO | PSTN | WA calling |
|---------|-----|------------|-----|------|------------|
| `starter` | off | off | off | off | off |
| `business` | on | on | off | on | off |
| `enterprise` | on | on | on | on | on |

Templates live in [`services/_shared/lib/plan-features.js`](../../services/_shared/lib/plan-features.js). DB column `billing_plans.features` overrides templates.

## APIs

- `GET /api/tenant/v1/tenants/:id` — returns `features` map (Vue `loadFeatures()`).
- `POST /api/tenant/v1/tenants/:id/features/apply` — internal; billing calls after subscription change.
- `PATCH /api/tenant/v1/tenants/:id` with `{ features: { sla: true } }` — platform admin override.
- `GET /api/billing/v1/tenants/:id/usage/limits` — usage vs allowance; gateway returns 402 when blocked.

## Vue

```js
import { useFeature } from 'shared/blinkone/useFeature';
const { enabled } = useFeature('sla');
```

Or wrap UI:

```vue
<BlinkoneFeatureGate feature="sla">...</BlinkoneFeatureGate>
```

## Sidecars

Middleware: `requireFeature('sla', resolveTenantId, fail)` from [`services/_shared/lib/features.js`](../../services/_shared/lib/features.js).

| Service | Feature key |
|---------|-------------|
| `services/calls` | `calling.pstn` (mutating routes) |
| `services/routing` | `telephony` (non-GET routes) |
| `services/ai` | `agent_assist`, `rag`, `voice_bot` |
| `services/sla` | `sla` |
| `services/escalation` | `escalation` |
| `services/integration` | `sso`, `audit` |

On subscription assign, billing calls `applyPlanEntitlements()` → `POST /v1/tenants/:id/features/apply`. Platform plan editor: Settings → Platform → Plans.
