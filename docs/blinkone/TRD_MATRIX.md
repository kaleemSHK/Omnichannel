# LABBIK TRD traceability matrix (BlinkOne)

Status legend: **PENDING DESIGN** | IN PROGRESS | DONE | OUT OF SCOPE

Fill **Implementation** and **Status** as each prompt lands. Source TRD document: _attach LABBIK TRD PDF to this repo or link internally._

| TR ID | Requirement (summary) | Implementation | Status |
|-------|----------------------|----------------|--------|
| TR-01 | Platform scope / objectives | PENDING DESIGN | PENDING DESIGN |
| TR-02 | On-prem deployment model | `docker-compose.yml` | PENDING DESIGN |
| TR-03 | High availability architecture | `docs/blinkone/deploy/ha.md` (Prompt 11) | PENDING DESIGN |
| TR-04 | Disaster recovery | `docs/blinkone/deploy/dr.md` (Prompt 11) | PENDING DESIGN |
| TR-05 | Capacity / sizing | PENDING DESIGN | PENDING DESIGN |
| TR-06 | Voice / telephony platform | `services/calls`, `services/ivr`, `infra/asterisk` (Prompt 5) | STEPS 5–9 — ACD, CDR, supervise, dashboards, phone UI |
| TR-07 | Omnichannel inbox (baseline) | `core-chatwoot` | PENDING DESIGN |
| TR-08 | Email channel | `core-chatwoot` | PENDING DESIGN |
| TR-09 | Web widget | `core-chatwoot` + rebrand (Waves A–D) | IN PROGRESS |
| TR-10 | Social / messaging channels | `core-chatwoot` | PENDING DESIGN |
| TR-11 | SMS channel | `core-chatwoot` / integration | PENDING DESIGN |
| TR-12 | Inbound PSTN / SIP trunks | `infra/kamailio`, `infra/asterisk` (Prompt 5) | STEP 1 DONE — review |
| TR-13 | ACD / queue routing | `services/routing` (Prompt 5) | PENDING DESIGN |
| TR-14 | Agent selection algorithm | `services/routing` (Prompt 5) | PENDING DESIGN |
| TR-15 | Queue overflow rules | `services/routing` (Prompt 5) | PENDING DESIGN |
| TR-16 | Call recording | `services/recording` (Prompt 5) | PENDING DESIGN |
| TR-17 | Supervisor listen/whisper/barge | `services/routing` (Prompt 5) | PENDING DESIGN |
| TR-18 | CDR / agent performance | `services/routing`, `services/recording` | PENDING DESIGN |
| TR-19 | Real-time telephony dashboards | `services/routing` + Vue admin (Prompt 5) | PENDING DESIGN |
| TR-20 | Ticketing / case management | `services/tickets` | PENDING DESIGN |
| TR-21 | CRM / contact model | `core-chatwoot` | PENDING DESIGN |
| TR-22 | Knowledge base (help center) | `core-chatwoot` portal | PENDING DESIGN |
| TR-23 | SLA policies | `services/sla` (Prompt 6) — **not** Chatwoot Enterprise | PENDING DESIGN |
| TR-24 | Escalation rules | `services/escalation` (Prompt 6) | PENDING DESIGN |
| TR-25 | Workflow automation (baseline) | `core-chatwoot` | PENDING DESIGN |
| TR-26 | Campaigns / outbound | PENDING DESIGN | PENDING DESIGN |
| TR-27 | Reporting (baseline) | `core-chatwoot` | PENDING DESIGN |
| TR-28 | Custom reports / exports | sidecar / integration | PENDING DESIGN |
| TR-29 | Arabic voice bot | `services/ai` (Prompt 7) | PENDING DESIGN |
| TR-30 | IVR self-service flows | `services/ivr` (Prompt 5) | STEP 3 — Postgres + admin UI |
| TR-31 | Agent assist (suggestions) | `services/ai` + Vue (Prompt 7) | PENDING DESIGN |
| TR-32 | Sentiment analysis | `services/ai` (Prompt 7) | PENDING DESIGN |
| TR-33 | Auto ticket classification | `services/ai` (Prompt 7) | PENDING DESIGN |
| TR-34 | Conversation summarization | `services/ai` (Prompt 7) | PENDING DESIGN |
| TR-35 | Call transcription (STT) | `services/ai` (Prompt 7) | PENDING DESIGN |
| TR-36 | RAG knowledge base | `services/ai` (Prompt 7) | PENDING DESIGN |
| TR-37 | Multi-tenant SaaS model | `services/platform` / `services/tenant` (Prompt 8) | PENDING DESIGN |
| TR-38 | Tenant data isolation | gateway + RLS + Redis prefix (Prompt 8) | PENDING DESIGN |
| TR-39 | White-label / per-tenant branding | `config/blinkone/branding.yml`, `/blinkone/api/v1/branding`, `public/blinkone-brand/` | IN PROGRESS |
| TR-40 | Per-tenant workflows | sidecars (tenant-scoped) | PENDING DESIGN |
| TR-41 | Tenant RBAC | gateway `@blinkone/rbac` (Prompt 4) | PENDING DESIGN |
| TR-42 | Subscription plans | `services/billing` (Prompt 9) | PENDING DESIGN |
| TR-43 | Usage metering | `services/billing` (Prompt 9) | PENDING DESIGN |
| TR-44 | Invoicing (OMR / VAT) | `services/billing` (Prompt 9) | PENDING DESIGN |
| TR-45 | Payment / dunning | `services/billing` (Prompt 9) | PENDING DESIGN |
| TR-46 | Public REST API | gateway + OpenAPI aggregate (Prompt 10) | PENDING DESIGN |
| TR-47 | Outbound webhooks | `services/integration` (Prompt 10) | PENDING DESIGN |
| TR-48 | ERP / government connectors | `services/integration` (Prompt 10) | PENDING DESIGN |
| TR-49 | SSO / SAML / AD | Keycloak + `services/integration` (Prompt 10) | PENDING DESIGN |
| TR-50 | API documentation portal | `services/integration` (Prompt 10) | PENDING DESIGN |
| TR-51 | Data retention policies | PENDING DESIGN | PENDING DESIGN |
| TR-52 | Backup / restore | `scripts/blinkone/backup-production.sh` | PENDING DESIGN |
| TR-53 | Monitoring / alerting | Prometheus/Grafana (Prompt 4) | PENDING DESIGN |
| TR-54 | Data residency (Gulf) | AI provider config (Prompt 7) | PENDING DESIGN |
| TR-55 | Encryption at rest | MinIO + per-tenant keys (Prompt 5) | PENDING DESIGN |
| TR-56 | Roles & permissions | gateway RBAC (Prompt 4) | PENDING DESIGN |
| TR-57 | Immutable audit logs | `@blinkone/audit` (Prompt 4, 10) | PENDING DESIGN |
| TR-58 | MFA | Keycloak / Chatwoot config | PENDING DESIGN |
| TR-59 | Session security | gateway JWT (Prompt 4) | PENDING DESIGN |
| TR-60 | Network security / mTLS | sidecar hooks (Prompt 4) | PENDING DESIGN |
| TR-61 | Performance — routing latency | `tests/load/` (Prompt 11) | IN PROGRESS |
| TR-62 | Performance — concurrent calls | `tests/load/` (Prompt 11) | IN PROGRESS |
| TR-63 | Scalability — horizontal sidecars | compose / k8s (Prompt 11) | PENDING DESIGN |
| TR-64 | Arabic / English UI | rebrand + i18n (Waves A–D) | IN PROGRESS |
| TR-65 | RTL layout | rebrand QA (Prompt 3) | PENDING DESIGN |
| TR-66 | Admin training / UX | admin-panels / Vue (ongoing) | PENDING DESIGN |
| TR-67 | KPI dashboards | telephony + Chatwoot reports | PENDING DESIGN |
| TR-68 | Acceptance criteria | `tests/acceptance/` (Prompt 11) | IN PROGRESS |
| TR-69 | Documentation deliverables | `docs/blinkone/` + `mkdocs.yml` (Prompt 11) | IN PROGRESS |
| TR-70 | Handover package | `BlinkOne-Deliverables-v1.0/` (Prompt 11) | IN PROGRESS |
| TR-71 | Source code delivery | git release bundle | IN PROGRESS |
| TR-72 | Knowledge transfer plan | `docs/blinkone/KT_PLAN.md` (Prompt 11) | DONE |
| TR-73 | Training schedule | `docs/blinkone/training/` (Prompt 11) | IN PROGRESS |

## Enterprise feature mapping (build fresh — never port `enterprise/`)

| Chatwoot Enterprise | BlinkOne | TR |
|---------------------|----------|-----|
| SLA policies | `services/sla` | TR-23 |
| Custom branding UI | Brand tokens (Prompt 2) | TR-39 |
| Captain AI | `services/ai` | TR-29–36 |
| SSO / SAML | Keycloak + integration | TR-49 |
| Audit logs | `@blinkone/audit` | TR-57 |
| Advanced permissions | gateway RBAC | TR-56 |
| Agent capacity | `services/routing` | TR-13/14 |
