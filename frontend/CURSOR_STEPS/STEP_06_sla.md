# STEP 06 — SLA Dashboard
> Paste this entire prompt into Cursor Composer. Do NOT move to STEP 07 until all checks pass.

## What to build

```
src/app/(dashboard)/sla/page.tsx
src/components/sla/SLAKPICards.tsx
src/components/sla/SLAInstanceTable.tsx
src/components/sla/SLAInstanceRow.tsx
src/components/sla/PolicyCard.tsx
src/components/sla/CountdownBar.tsx
```

## Layout

```
[IconSidebar] | [180px sla-nav] | [flex-1 main-content]
```

## SLA Nav sidebar

Section links (same style as settings nav):
- **Dashboard** (default active)
- **Breached** — red badge showing count from `getSlaDashboard().breachedCount`
- **At risk** — amber badge
- **Active**
- **Met**
---divider---
- **Policies**
- **Business hours**

Each link filters the main content view.

## Main content

### KPI Cards row (`SLAKPICards`)

4 cards in a row, from `getSlaDashboard()`:
| Card | Value | Color if elevated |
|---|---|---|
| Breached | count | Always red text |
| At risk | count | Always amber text |
| Active | count | blue text |
| Met today | count + compliance% | green text |

Sub-text: e.g. "↑2 from yesterday", "87% compliance"

### Instance Table (`SLAInstanceTable`)

From `listSLAInstances({ status: activeFilter })`. Polling: `refetchInterval: 30_000`.

Columns:
| # | Contact | Tier | Status | Deadline | Remaining | Assignee |
|---|---|---|---|---|---|---|

- `#`: conversation ID, clickable → navigate to `/conversations?id=X`
- **Contact**: contact name + conversation title (2 lines)
- **Tier badge**: Gold=amber-100/amber-700, Silver=gray-100/gray-600, Bronze=orange-100/orange-700
- **Status chip**: Breached=red, At risk=amber, Active=blue, Met=gray
- **Deadline**: formatted time (HH:mm)
- **Remaining** column:
  - Breached: red text "−Xh Xm" (negative elapsed)
  - At risk: `CountdownBar` + amber text "Xm left"
  - Active: green text "Xh Xm left" + thin progress bar
  - Met: gray "—"
- **Assignee**: agent name or "Unassigned" (red if breached + unassigned)

Row borders:
- Breached rows: `border-l-4 border-red-500`
- At-risk rows: `border-l-4 border-amber-400`

### CountdownBar component

```tsx
// Animated progress bar showing % of SLA window elapsed
// Props: elapsed_seconds, total_seconds
// Color: green → amber → red as % increases
// Threshold: green < 50%, amber 50-85%, red > 85%
```

### Policy Cards (`PolicyCard`)

From `listPolicies()`. Render 3 cards in a 3-column grid:

Each `PolicyCard`:
- Header: tier name badge + "Edit" button (links to settings)
- Rows: First response | Resolution time | Business hours only (Yes/No) | Escalates to

---

## Acceptance checklist — verify before STEP 07
- [ ] SLA nav links filter the instance table correctly
- [ ] Breached rows have red left border
- [ ] At-risk rows have amber left border + countdown bar
- [ ] KPI card numbers update every 30s
- [ ] Policy cards show Gold/Silver/Bronze with correct values
- [ ] Clicking conversation # navigates to conversations page
- [ ] No TypeScript errors

✅ Only proceed to STEP 07 once all boxes are checked.
