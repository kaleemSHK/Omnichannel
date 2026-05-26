# Cursor Prompt — Sprint 1 / Feature G04
# Skills Manager Admin UI

**Prerequisite:** Complete SPRINT1_PROMPT1_weighted_sbr.md first (API layer must exist).  
**Reviewer gate:** `npx tsc --noEmit` zero errors. All three states (loading, error, empty) must be present.  
**Architecture doc:** `docs/ARCHITECTURE.md §3.1, §6.1`

---

## Context You Must Read First

1. `frontend/src/lib/api/routing.ts` — AgentSkill types + API functions (created in Prompt 1)
2. `frontend/src/lib/hooks/useSkills.ts` — hooks (created in Prompt 1)
3. `frontend/src/components/routing/` — existing routing components for style consistency
4. `frontend/src/app/(dashboard)/routing/page.tsx` — routing page structure
5. `frontend/src/components/ui/` — available shadcn components

---

## What To Build

A full **Skills Manager** admin panel within the Routing section. Allows supervisors to:
1. View all agents and their current skill proficiency scores
2. Add/remove skills per agent
3. Set proficiency 1–5 via a visual star/pill picker
4. Configure per-queue skill weights (multipliers for scoring)

---

## Component Architecture

```
frontend/src/components/routing/skills/
├── SkillsManager.tsx          — Main container, tab: Agents / Queues
├── AgentSkillsTable.tsx       — Table of all agents with expandable skills row
├── AgentSkillEditor.tsx       — Inline skill add/remove/proficiency editor
├── ProficiencyPicker.tsx      — 1–5 star/dot picker component
├── QueueSkillWeights.tsx      — Per-queue weight configurator
└── SkillBadge.tsx             — Reusable badge showing skill + level
```

---

## Detailed Component Specs

### `ProficiencyPicker.tsx`

Visual component to select proficiency 1–5.

```tsx
interface ProficiencyPickerProps {
  value: number;           // 1–5
  onChange: (v: number) => void;
  disabled?: boolean;
  label?: string;
}
```

**Design:** 5 filled dots/circles. Filled = selected and below. Show tooltip on hover: "1=Beginner, 2=Basic, 3=Proficient, 4=Advanced, 5=Expert". Color: brand-primary (filled), gray-200 (empty).

Example:  ●●●○○  (value=3)

---

### `SkillBadge.tsx`

Compact badge for displaying a skill:

```tsx
interface SkillBadgeProps {
  skill: string;
  proficiency?: number;   // if provided, shows dots
  onRemove?: () => void;  // shows × button if provided
  variant?: 'default' | 'compact';
}
```

---

### `AgentSkillEditor.tsx`

Inline editor for one agent's skills. Shows in a sheet/drawer.

```tsx
interface AgentSkillEditorProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ Agent: John Smith                   [×] │
├─────────────────────────────────────────┤
│ Current Skills:                         │
│  [english  ●●●●○] [×]                  │
│  [spanish  ●●●○○] [×]                  │
│  [tier2    ●●●●●] [×]                  │
├─────────────────────────────────────────┤
│ Add Skill:                              │
│  [Skill name input    ] [1●2○3○4○5○]   │
│  [+ Add Skill]                          │
└─────────────────────────────────────────┘
```

Logic:
- Uses `useAgentSkills(agentId)` hook
- `upsertAgentSkill` mutation on save (optimistic update)
- `deleteAgentSkill` mutation on × (optimistic update)
- Skill name: free text input with autocomplete from known skills list
- "Known skills" = Set of all distinct skill names across all agents in tenant

---

### `AgentSkillsTable.tsx`

Table showing all agents with skill summary.

```tsx
// Data from useAllAgentsWithSkills()
```

**Columns:**
| Agent Name | Skills | Top Skill | Actions |
|-----------|--------|-----------|---------|
| John Smith | ●●●●○ english, ●●●○○ spanish | english (4) | [Edit Skills] |
| Jane Doe   | ●●●●● tier2 | tier2 (5) | [Edit Skills] |

- "Edit Skills" opens `AgentSkillEditor` as a Sheet (shadcn `<Sheet>`)
- Empty state: "No agents found. Agents appear when they first connect."
- Loading state: 3 skeleton rows
- Error state: "Failed to load agents. Retry?"

---

### `QueueSkillWeights.tsx`

Allows setting `skill_weights` multipliers per queue.

**Layout:**
```
Queue: Support Tier 2          [selectionAlgorithm: best_match ▼]
─────────────────────────────────────────
Skill Weight Multipliers:
  english    [1.0× slider ──●──── 3.0×]
  spanish    [1.5× slider ────●── 3.0×]
  tier2      [2.0× slider ──────● 3.0×]
─────────────────────────────────────────
[ Save Weights ]
```

- Slider range 0.5 to 3.0, step 0.5
- Only shows skills that exist in at least one agent for this tenant
- Queue selector at top (dropdown of all queues)
- Also lets supervisor change `selectionAlgorithm` (dropdown: `longest_idle`, `round_robin`, `best_match`)

---

### `SkillsManager.tsx`

Top-level container. Two tabs:

```
[ Agents ]  [ Queue Weights ]
```

- "Agents" tab shows `AgentSkillsTable`
- "Queue Weights" tab shows `QueueSkillWeights`

---

## Integration into Routing Page

In `frontend/src/app/(dashboard)/routing/page.tsx` (or the appropriate routing layout), add a "Skills" tab or section. Keep it inside the existing routing nav structure.

If the routing page has a tab structure (e.g., Queues / Wallboard / Reports), add **Skills** as a new tab.

---

## Types to Add (in `frontend/src/types/index.ts`)

```typescript
export interface AgentSkill {
  skill: string;
  proficiency: 1 | 2 | 3 | 4 | 5;
}

export interface AgentWithSkills {
  agentId: string;
  agentName?: string;
  skills: AgentSkill[];
}
```

Do not duplicate if already added in Prompt 1.

---

## Design Constraints

- Use existing shadcn components from `components/ui/` (Button, Sheet, Badge, Tabs, Skeleton, Select, Slider if available)
- Color: brand-primary (`text-brand-primary`, `bg-brand-primary`)  
- Match font sizes with the existing `WallboardTable.tsx` (xs/sm, uppercase labels for headers)
- All mutations must show `toast.success()` on success and `toast.error()` on failure (use sonner)
- Do NOT use `alert()` or `confirm()` — use toast

---

## Files To Create/Modify Summary

```
CREATE  frontend/src/components/routing/skills/SkillsManager.tsx
CREATE  frontend/src/components/routing/skills/AgentSkillsTable.tsx
CREATE  frontend/src/components/routing/skills/AgentSkillEditor.tsx
CREATE  frontend/src/components/routing/skills/ProficiencyPicker.tsx
CREATE  frontend/src/components/routing/skills/QueueSkillWeights.tsx
CREATE  frontend/src/components/routing/skills/SkillBadge.tsx
MODIFY  frontend/src/app/(dashboard)/routing/page.tsx  (add Skills tab)
MODIFY  frontend/src/types/index.ts  (add AgentSkill, AgentWithSkills if missing)
```

---

## Validation After Build

1. `cd frontend && npx tsc --noEmit` → zero errors
2. All three states visible: loading (skeletons), error (error message + retry), empty (empty state message)
3. Adding a skill with proficiency 4 shows 4 filled dots in the badge
4. Removing a skill removes it immediately (optimistic UI)
5. Queue weight changes persist after page refresh
