# STEP 08 — Billing & Usage
> Paste this entire prompt into Cursor Composer. Do NOT move to STEP 09 until all checks pass.

## What to build

```
src/app/(dashboard)/billing/page.tsx
src/components/billing/PlanBanner.tsx
src/components/billing/UsageGauge.tsx
src/components/billing/InvoiceTable.tsx
src/components/billing/AddOnCard.tsx
```

## Layout

```
[IconSidebar] | [160px billing-nav] | [flex-1 main-content]
```

## Billing Nav

- Overview (default)
- Usage (detailed breakdown)
- Invoices
- Payment methods
- Add-ons

## Overview page content

### PlanBanner

From `getSubscription()`:
- Plan badge: Enterprise=blue / Professional=indigo / Starter=gray
- Plan name + renewal date ("Renews 1 July 2026 · 8 days left")
- Monthly price (right-aligned, large text, brand-primary)
- "Manage plan" button → link to billing portal or opens UpgradePlanModal

Layout: horizontal flex, white card, rounded-lg, border, p-5

### Usage Gauges section

Title: "Usage this cycle"

6 `UsageGauge` components in a 3-column grid from `getUsage()`:

**UsageGauge props:** `label: string, used: number, total: number, unit: string, overage?: number, overageCost?: number`

Each gauge renders:
- Label (top-left) + "X / Y unit" (top-right, font-medium)
- Horizontal progress bar (h-2, rounded-full)
  - Blue: used/total < 85%
  - Amber: 85-99%
  - Red: ≥ 100% (fills to 100% visually, shows overage text)
- If overage > 0: `+N unit overage · OMR X.XX` in red-600 text-sm

Gauges to show:
| Label | API field | Unit |
|---|---|---|
| Agents | seats_used / seats_limit | agents |
| PSTN minutes | pstn_minutes_used / pstn_minutes_limit | min |
| WhatsApp messages | wa_messages_used / wa_messages_limit | msgs |
| AI assist tokens | ai_tokens_used / ai_tokens_limit | tokens |
| Storage | storage_used / storage_limit | GB |
| SMS | sms_used / sms_limit | msgs |

### Invoice Table

From `listInvoices()`. Columns:
| Period | Amount | Overage | Status | Action |
|---|---|---|---|---|

- Period: "May 2026"
- Amount: "OMR 432.00" (always 2 dp)
- Overage: "+OMR X.XX" in red if > 0, else "—"
- Status: `<Badge>` Paid=green, Pending=amber, Failed=red
- Action: "Download" link → opens invoice PDF URL in new tab

## Usage detail page (`/billing?tab=usage`)

Same gauges but with a monthly chart (recharts AreaChart) showing each metric over the past 6 months.
Data from `getUsage({ period: 'historical', months: 6 })`.

---

## Acceptance checklist — verify before STEP 09
- [ ] Plan banner shows correct plan, renewal date, and price
- [ ] All 6 usage gauges render with correct colors
- [ ] Gauges turn red when over limit and show overage cost
- [ ] Invoice table shows correct status badges
- [ ] Download link opens the PDF
- [ ] No TypeScript errors

✅ Only proceed to STEP 09 once all boxes are checked.
