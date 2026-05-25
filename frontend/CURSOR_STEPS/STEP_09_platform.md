# STEP 09 — Platform Admin
> Paste this entire prompt into Cursor Composer. Do NOT move to STEP 10 until all checks pass.

## What to build

```
src/app/(dashboard)/platform/page.tsx
src/components/platform/TenantCard.tsx
src/components/platform/FeatureToggle.tsx
src/components/platform/NewTenantWizard.tsx
src/components/platform/PlatformKPICards.tsx
```

## Auth guard

This page requires `user.role === 'platform_admin'`.
At the top of the page component:
```ts
const { user } = useAuthStore()
if (user?.role !== 'platform_admin') redirect('/conversations')
```

## Layout

```
[IconSidebar] | [170px platform-nav] | [flex-1 main-content]
```

## Platform Nav

- **Tenants** (default)
- Feature flags (global)
- Admins
- Storage
- Health
---divider---
- Audit log
- Alerts

## Main content — Tenants view

### KPI Cards (top row)

From `listTenants()` aggregated:
- Total tenants (neutral)
- Active (green)
- Trial (amber)
- Total agents (blue)

### Toolbar

- Search input (filters tenant list client-side by name/slug)
- "New tenant" blue button → opens `NewTenantWizard`

### Tenant cards

For each tenant from `listTenants()`, render a `TenantCard`:

**TenantCard layout:**
- Top row: initials avatar (2 chars, colored), name (font-semibold), tenant ID (muted text-xs), agent count + location
- Right side of top row: status pill (Active/Trial/Suspended) + plan label + "Edit" + "Impersonate" links
  - "Impersonate" calls `impersonateTenant(tenantId)` → sets gateway JWT for that tenant in memory and refreshes
- Feature flags section (below a subtle divider):
  - Label: "Feature flags" (text-xs muted)
  - `<FeatureToggle>` for each flag:
    - PSTN calling
    - WhatsApp
    - AI assist
    - IVR builder
    - SLA
    - Voice bot
    - RAG knowledge base
    - Billing module
  - Each toggle: label text + Switch component
  - On toggle: `updateTenantFeatures(tenantId, { [flagKey]: !currentValue })`
  - Disabled flags are grayed out (opacity-50)

**Suspended tenants:** entire card has bg-red-50/30 and red border.

## FeatureToggle component

```tsx
interface FeatureFlagToggleProps {
  tenantId: string
  flagKey: keyof TenantFeatures
  label: string
  value: boolean
}
```
Uses `useMutation` + optimistic update so toggle feels instant.

## NewTenantWizard (shadcn Dialog, multi-step)

Step 1 — Basics:
- Tenant name (required)
- Slug (required, url-safe, auto-generated from name)
- Plan (select: Starter / Professional / Enterprise)
- Admin email (required, email)

Step 2 — Features:
- Feature flag checkboxes (same list as above)

Step 3 — Review:
- Summary of all choices
- "Create tenant" button → `createTenant(data)` → `invalidateQueries(['tenants'])`
- Loading spinner while creating

Progress indicator: "Step 1 of 3" at top of dialog.

---

## Acceptance checklist — verify before STEP 10
- [ ] Accessing /platform as non-platform_admin redirects to /conversations
- [ ] Tenant cards render with feature flag toggles
- [ ] Toggling a flag updates optimistically and calls API
- [ ] New tenant wizard steps through 3 pages
- [ ] Tenant count KPI cards are correct
- [ ] No TypeScript errors

✅ Only proceed to STEP 10 once all boxes are checked.
