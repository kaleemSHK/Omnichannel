# Prompt 8 — RLS review checklist

**Do not enable in production until this checklist is signed off.**

## Policy model

- Setting: `app.tenant_id` (TEXT), set with `set_config(..., true)` inside a transaction (`SET LOCAL` semantics).
- Policy: `tenant_id = current_setting('app.tenant_id', true)` on tables with `tenant_id`.
- Child tables (e.g. `sla_targets`, `ivr_flow_versions`): subquery policy via parent `tenant_id`.
- `FORCE ROW LEVEL SECURITY`: table owner (`app`) is also subject to policies.

## Fail-closed behaviour

| Scenario | Expected |
|----------|----------|
| Query without `set_config` | 0 rows (not an error) |
| Tenant A context, `WHERE tenant_id = B` | 0 rows |
| Migration runner | Uses raw pool **without** RLS context for DDL only; `*_schema_migrations` tables have **no** RLS |

## Risks to verify

1. **Background workers** (SLA worker, STT worker) must wrap DB calls in `tenantQuery(pool, tenantId, ...)` per job.
2. **Platform admin** list/create tenants uses direct pool (no RLS on insert) — intentional for control plane; restrict DB role if needed.
3. **Cross-service joins** across tenants — none today; avoid shared views without tenant predicate.
4. **Performance** — subquery policies on large child tables; add indexes on FK paths if explain plans regress.

## Rollout

1. Apply migrations on staging `blinkone_app`.
2. Run `RUN_RLS_TESTS=1 npm test` in `services/tenant`.
3. Smoke SLA/routing/AI with `X-Blinkone-Tenant-Id` after retrofitting `tenantQuery` in repos.
4. Manual: create tenants A/B, write policy as A, confirm B's API returns empty/404.

## Sign-off

- [ ] Staging migrations applied without error  
- [ ] Cross-tenant test passed  
- [ ] Workers audited for `tenantQuery`  
- [ ] Platform provisioning still works  
- [ ] Owner: _________________ Date: _________
