# ADR-007: Dynamic Multi-Tenant RBAC

## Status
Accepted — Phase 1 foundation (2026-06)

## Context
BlinkOne currently uses **hardcoded** roles (`agent`, `supervisor`, `admin`, `platform_admin`) in:
- `frontend/src/lib/rbac.ts`
- `services/_shared/lib/rbac.js`
- Gateway JWT `mapChatwootRoles()`

Tenant Admins cannot create custom roles, configure page visibility, or assign multiple roles per user without code changes.

## Decision

### Hierarchy (4 levels)

| Level | Scope | Identity source |
|-------|--------|-----------------|
| **Super Admin** | Platform (all tenants) | `platform_admin` JWT + platform-service registry |
| **Tenant Admin** | Single tenant | System role `tenant_admin` (DB) |
| **Supervisor** | Single tenant | System/custom role, DB-driven |
| **Agent** | Single tenant | System/custom role, DB-driven |

Super Admin operates on tenant metadata only; tenant data stays isolated via RLS + JWT `tenant_id`.

### Permission model

- **Catalog** (global, seeded): modules × actions — e.g. `calling.receive_call`, `tickets.assign`
- **Pages** (global, seeded): menu routes — e.g. `page.calling` → `/calling`
- **Tenant roles** (per tenant): unlimited custom roles with permission + page visibility sets
- **User assignments** (per tenant): Chatwoot user + department/team/supervisor + **multiple roles** (union)

Effective permissions = **union** of all assigned roles. Page visible if **any** role grants visibility.

### Enforcement layers

1. **Gateway** — JWT includes `permissions[]`, `pages[]`; cross-tenant block; optional route guard middleware
2. **Tenant service** — CRUD for roles/users; `GET /v1/rbac/effective` for login hydration
3. **Microservices** — `requireRbac('module.action')` reads `x-blinkone-permissions` header
4. **Frontend** — `can()` / `canAccessRoute()` read Zustand permission store (API-backed)
5. **Mobile** — same store pattern via login response

### Migration strategy

Phase 1 (this ADR): schema + engine + APIs + login hydration + Role Builder UI shell  
Phase 2: Replace all static `ROLE_PERMISSIONS` checks; mount `requireRbac` on all write routes  
Phase 3: User assignment UI, department/team entities, supervisor reporting chain  
Phase 4: Platform Super Admin console (tenant suspend, global audit, billing)

Static `rbac.ts` remains as **fallback** when tenant DB unavailable (dev/demo).

## Schema

See `services/tenant/db/004_rbac.sql`.

## API (tenant service)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/rbac/catalog` | Permission + page catalog |
| GET | `/v1/rbac/effective` | Current user's effective permissions |
| GET | `/v1/rbac/roles` | List tenant roles |
| POST | `/v1/rbac/roles` | Create custom role |
| PATCH | `/v1/rbac/roles/:id` | Update role + matrix |
| DELETE | `/v1/rbac/roles/:id` | Delete non-system role |
| GET | `/v1/rbac/users` | List user assignments |
| POST | `/v1/rbac/users` | Create/update user assignment |
| POST | `/v1/rbac/users/:id/roles` | Assign roles (multi) |

## Consequences

- **Pros**: Salesforce/Zendesk-style configurability; no deploy for permission changes
- **Cons**: JWT size grows with permission list — mitigate with short keys + optional Redis session cache in Phase 2
- **Chatwoot**: User identity stays in Chatwoot; BlinkOne RBAC overlays Chatwoot roles (gradual replacement)
