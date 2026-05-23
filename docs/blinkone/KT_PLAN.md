# Knowledge transfer plan (TR-72, TR-73)

Four-week schedule for LABBIK engineering and operations teams.

## Week 1 — Architecture & local environment

| Day | Topic | Owner | Outcome |
|-----|-------|-------|---------|
| 1 | System context, C4, compose topology | BlinkOne architect | Slides + [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 2 | Clone, `.env`, `docker compose up` | All devs | Each dev runs dashboard locally |
| 3 | Gateway JWT, tenant context, RBAC | Backend lead | Trace one API call end-to-end |
| 4 | Chatwoot overlay build (`docker/chatwoot-blinkone`) | Frontend lead | Rebuild image with branding patch |
| 5 | **Lab:** provision demo tenant, place test call | All | Demo script checklist signed |

**Artifacts:** [deploy/on-prem.md](./deploy/on-prem.md), [DEMO_DATA.md](./DEMO_DATA.md)

## Week 2 — Sidecar deep dives

| Session | Service | Exercise |
|---------|---------|----------|
| Mon AM | routing + ivr | Add queue, publish IVR flow |
| Mon PM | sla + escalation | Create policy, simulate breach |
| Tue AM | ai | Index KB doc, run RAG query |
| Tue PM | tenant + billing | Provision tenant, generate invoice |
| Wed AM | integration | Configure webhook + SSO stub |
| Wed PM | platform / gateway | Add RBAC permission mapping |
| Thu | **Lab:** each LABBIK dev ships a 1-line config change (PR) | Merged to `develop` |
| Fri | Retrospective + open questions | ADR backlog |

## Week 3 — Operations

| Topic | Runbook |
|-------|---------|
| Backup / restore | `scripts/blinkone/backup-production.sh`, [deploy/dr.md](./deploy/dr.md) |
| Monitoring | Prometheus/Grafana (Prompt 4 compose overlay) |
| **Drill:** restore Postgres snapshot to staging | Ops team |
| **Drill:** Asterisk / Kamailio failure | [runbooks/asterisk-recovery.md](./runbooks/asterisk-recovery.md) |
| On-call escalation path | LABBIK internal |

## Week 4 — Customization

| Track | Deliverable |
|-------|-------------|
| Connector | Generic REST mapping for one ERP event |
| IVR | New DTMF branch in flow builder |
| Escalation | New JSON-Logic rule |
| UI | BlinkOne settings page copy tweak |

**Exit criteria:** LABBIK can release a patch release without vendor presence.

## Ongoing

- Monthly upstream Chatwoot merge ([deploy/upgrade.md](./deploy/upgrade.md))
- Weekly cross-tenant gauntlet in CI
- Quarterly security scan per [SECURITY_REVIEW.md](./SECURITY_REVIEW.md)
