# STEP 07 — Escalation Rules
> Paste this entire prompt into Cursor Composer. Do NOT move to STEP 08 until all checks pass.

## What to build

```
src/app/(dashboard)/escalation/page.tsx
src/components/escalation/RulesetCard.tsx
src/components/escalation/ConditionBuilder.tsx
src/components/escalation/ActionsList.tsx
src/components/escalation/DryRunPanel.tsx
src/components/escalation/NewRuleModal.tsx
```

## Layout

```
[IconSidebar] | [flex-1 rules-list (left)] | [260px dry-run-panel (right)]
```

TopBar: "Escalation rules" title | "Dry-run simulator" outline button | "New rule" blue button (opens `NewRuleModal`)

## Rules list

From `listRulesets()`. Each rule renders as a `RulesetCard`.

**RulesetCard:**
- Header row: rule name (font-medium) | Active/Inactive pill | "Edit" + "Duplicate" action buttons
  - Active = green pill, Inactive = gray pill
  - Toggle switch on the pill to enable/disable → `updateRuleset(id, { enabled: !current })`
- **Conditions block** (label: "CONDITIONS · ALL MATCH"):
  - Each condition as a chip: `field operator value` — e.g. `sla_tier = Gold`
  - Between chips: `AND` or `OR` operator pill (gray bg)
  - Chips use rounded-full, border, text-sm
  - Available fields: `sla_tier`, `sla_status`, `call_status`, `missed_count`, `ai_sentiment`,
    `assigned_agent`, `inbox_type`, `contact_tag`
  - Available operators: `=`, `≠`, `>`, `≥`, `<`, `≤`, `∈` (in list)
- **Actions block** (label: "ACTIONS"):
  - Each action as a row: colored icon badge + action description
  - Action types:
    - Reassign: `UserPlus` icon (blue) — "Reassign to [agent/team]"
    - Notify: `Bell` icon (amber) — "Notify via [email/WhatsApp/SMS]"
    - Label: `Tag` icon (green) — "Add label: [label]"
    - Message: `MessageSquare` icon (purple) — "Send message to [channel]"
    - Webhook: `Globe` icon (gray) — "POST to [url]"
- Inactive cards are visually dimmed (opacity-60)
- "Add rule" dashed button at bottom of list

## ConditionBuilder (used inside NewRuleModal and edit mode)

Allows building conditions interactively:
- Dropdown to select field + operator + value input (changes type based on field)
- "Add condition" button adds another row
- "AND/OR" toggle between rows
- Remove (×) button on each row

## DryRunPanel (right panel)

Title: "Dry-run" + description text

Form inputs (react-hook-form):
- Conversation ID (text)
- SLA tier (select: Gold/Silver/Bronze)
- SLA status (select: breached/at_risk/active/met)
- Call status (select: active/missed/ended)
- AI sentiment (select: positive/neutral/negative)
- Assigned agent (text)

"Run simulation" blue button → calls `simulateRule({ rulesetId: 'all', context: formValues })`

Results section (appears after run):
- For each ruleset: show ✓ matched (green) or "no match" (gray)
- For matched rules: indent list of actions that would fire
- If inactive rule would have matched: show "(inactive, skipped)" in muted text

## NewRuleModal (shadcn Dialog)

Multi-section form:
1. Rule name (text input)
2. Enabled toggle
3. Conditions (use ConditionBuilder)
4. Actions (list of action rows, each: type select + target input)
5. Save button → `createRuleset(data)` → `invalidateQueries(['rulesets'])`

---

## Acceptance checklist — verify before STEP 08
- [ ] Rules list renders all rulesets from API
- [ ] Condition chips render correctly with field/operator/value
- [ ] Active/Inactive toggle updates the ruleset
- [ ] Dry-run returns correct match/no-match results
- [ ] New rule modal creates and saves a ruleset
- [ ] No TypeScript errors

✅ Only proceed to STEP 08 once all boxes are checked.
