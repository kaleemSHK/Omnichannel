# Cursor Prompt — Sprint 1 / Feature G01
# Weighted Skills-Based Routing Engine

**Reviewer gate:** After implementation, run `npx tsc --noEmit` and confirm zero errors.  
**Architecture doc:** `docs/ARCHITECTURE.md §3.1`

---

## Context You Must Read First

1. `services/routing/lib/selection.js` — current binary skill matching
2. `services/routing/lib/redis-state.js` — `listAgentStates()` shape
3. `services/routing/lib/agent-repo.js` — agent CRUD
4. `services/routing/lib/queue-repo.js` — queue schema
5. `services/routing/src/server.js` — existing REST routes

---

## What To Build

Upgrade the routing engine from binary skill matching to **weighted proficiency matching (1–5 scale)** while keeping backward compatibility with existing binary-skill data.

---

## Detailed Requirements

### 1. Database migration (PostgreSQL)

Create `services/routing/migrations/002_agent_skills_proficiency.sql`:

```sql
-- Run only when BLINKONE_DATABASE_URL is set
CREATE TABLE IF NOT EXISTS agent_skills (
  id          SERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  skill       TEXT NOT NULL,
  proficiency SMALLINT NOT NULL DEFAULT 3 CHECK (proficiency BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_agent_skill UNIQUE (tenant_id, agent_id, skill)
);
CREATE INDEX IF NOT EXISTS idx_agent_skills_tenant_agent
  ON agent_skills (tenant_id, agent_id);
```

Also add `skill_weights` column to queues table for queue-level per-skill priorities:
```sql
ALTER TABLE queues ADD COLUMN IF NOT EXISTS skill_weights JSONB DEFAULT '{}';
-- skill_weights example: { "spanish": 2.0, "tier2_support": 1.5 }
```

---

### 2. Update `services/routing/lib/selection.js`

Replace the entire file with this logic:

#### `agentMatchesQueue(agent, queue)` — MUST keep same name and signature

```javascript
/**
 * Returns false if agent cannot handle this queue.
 * Backward compatible: agent.skills (string[]) is treated as proficiency=3 per skill.
 */
function agentMatchesQueue(agent, queue) {
  if (agent.status !== 'available') return false;
  if (agent.currentCallId) return false;

  // Queue key filter
  const keys = agent.queueKeys ?? [];
  if (keys.length && !keys.includes(queue.queueKey)) return false;

  // Required skills check — binary gate
  const required = (queue.skills ?? [])
    .filter(s => s.required !== false)
    .map(s => s.skill);

  if (!required.length) return true;

  // Resolve agent skill set — support both formats:
  //   legacy: agent.skills = ['english', 'tier2']
  //   new:    agent.agentSkills = [{skill: 'english', proficiency: 4}]
  const agentSkillNames = resolveAgentSkillNames(agent);
  return required.every(sk => agentSkillNames.has(sk));
}
```

#### `resolveAgentSkillNames(agent)` — new helper

```javascript
function resolveAgentSkillNames(agent) {
  // New format takes precedence
  if (Array.isArray(agent.agentSkills) && agent.agentSkills.length) {
    return new Set(agent.agentSkills.map(s => s.skill));
  }
  // Legacy format
  if (Array.isArray(agent.skills)) {
    return new Set(agent.skills);
  }
  return new Set();
}
```

#### `getAgentProficiency(agent, skill)` — new helper

```javascript
/**
 * Returns proficiency 1–5 for an agent×skill pair.
 * Falls back to 3 (mid-range) for legacy skill string arrays.
 */
function getAgentProficiency(agent, skill) {
  if (Array.isArray(agent.agentSkills)) {
    const entry = agent.agentSkills.find(s => s.skill === skill);
    if (entry) return entry.proficiency ?? 3;
  }
  // Legacy: if skill string present, treat as 3
  if (Array.isArray(agent.skills) && agent.skills.includes(skill)) return 3;
  return 0;
}
```

#### `scoreAgentForQueue(agent, queue)` — new scoring function

```javascript
/**
 * Compute weighted skill match score.
 * Higher score = agent better matched.
 * Score = Σ (proficiency_i × weight_i) for all queue skills agent can handle.
 */
function scoreAgentForQueue(agent, queue) {
  const queueSkills = queue.skills ?? [];
  const weights = queue.skill_weights ?? queue.skillWeights ?? {};

  return queueSkills.reduce((sum, qs) => {
    const skillName = qs.skill;
    const queueWeight = weights[skillName] ?? 1.0;
    const proficiency = getAgentProficiency(agent, skillName);
    return sum + proficiency * queueWeight;
  }, 0);
}
```

#### Updated `selectAgent(tenantId, queue)` — add `best_match` algorithm

```javascript
export async function selectAgent(tenantId, queue) {
  const agents = await listAgentStates(tenantId);
  const pool = agents.filter(a => agentMatchesQueue(a, queue));
  if (!pool.length) return null;

  const algo = queue.selectionAlgorithm || 'longest_idle';

  if (algo === 'round_robin') {
    pool.sort((a, b) => String(a.agentId).localeCompare(String(b.agentId)));
    return pool[0];
  }

  if (algo === 'best_match') {
    // Primary: highest weighted skill score
    // Tiebreak: longest idle (oldest lastIdleAt first)
    pool.sort((a, b) => {
      const scoreDiff = scoreAgentForQueue(b, queue) - scoreAgentForQueue(a, queue);
      if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
      const ta = new Date(a.lastIdleAt || 0).getTime();
      const tb = new Date(b.lastIdleAt || 0).getTime();
      return ta - tb;
    });
    return pool[0];
  }

  // longest_idle (default): oldest lastIdleAt first; tie-break lower occupancy
  pool.sort((a, b) => {
    const ta = new Date(a.lastIdleAt || 0).getTime();
    const tb = new Date(b.lastIdleAt || 0).getTime();
    if (ta !== tb) return ta - tb;
    return (a.occupancy ?? 0) - (b.occupancy ?? 0);
  });
  return pool[0];
}
```

---

### 3. Update `services/routing/lib/agent-repo.js`

Add `agentSkills` to the agent model. When loading agents from DB or file store, populate `agentSkills` array from `agent_skills` table (or from stored JSON if no DB).

Add new functions:
```javascript
/**
 * Upsert skill proficiency for an agent.
 * @param {string} tenantId
 * @param {string} agentId
 * @param {string} skill
 * @param {number} proficiency — 1 to 5
 */
export async function upsertAgentSkill(tenantId, agentId, skill, proficiency) { ... }

/**
 * Delete a skill from an agent.
 */
export async function deleteAgentSkill(tenantId, agentId, skill) { ... }

/**
 * List all skills for an agent (returns [{skill, proficiency}])
 */
export async function listAgentSkills(tenantId, agentId) { ... }

/**
 * List all agents with their skills for a tenant.
 * Returns [{agentId, skills: [{skill, proficiency}]}]
 */
export async function listAgentsWithSkills(tenantId) { ... }
```

File-store fallback: Store `agentSkills` array inside the agent JSON object in the file store.

---

### 4. Add REST routes to `services/routing/src/server.js`

```
GET    /v1/agents/:agentId/skills
       → listAgentSkills(tenantId, agentId) → [{skill, proficiency}]

PUT    /v1/agents/:agentId/skills/:skill
       body: { proficiency: 1-5 }
       → upsertAgentSkill(...)

DELETE /v1/agents/:agentId/skills/:skill
       → deleteAgentSkill(...)

GET    /v1/agents/skills
       → listAgentsWithSkills(tenantId) → [{agentId, skills:[...]}]

PATCH  /v1/queues/:queueKey/skill-weights
       body: { skill_weights: { "spanish": 2.0 } }
       → updates queue skill_weights
```

All routes:
- Use `auth` middleware (existing `bearerAuth`)
- Use `resolveTenantId(req)` for tenant isolation
- Validate with Zod (add `zod` to package.json if not present)

---

### 5. Update `services/routing/lib/redis-state.js`

When writing agent state to Redis (on registration/heartbeat), include `agentSkills` in the hash if present.

---

### 6. Frontend API layer — `frontend/src/lib/api/routing.ts`

Add these functions (follow existing `bnFetch` pattern):

```typescript
export interface AgentSkill {
  skill: string;
  proficiency: 1 | 2 | 3 | 4 | 5;
}

export interface AgentWithSkills {
  agentId: string;
  skills: AgentSkill[];
}

export async function listAgentSkills(agentId: string): Promise<AgentSkill[]>
export async function upsertAgentSkill(agentId: string, skill: string, proficiency: number): Promise<void>
export async function deleteAgentSkill(agentId: string, skill: string): Promise<void>
export async function listAgentsWithSkills(): Promise<AgentWithSkills[]>
export async function updateQueueSkillWeights(queueKey: string, weights: Record<string, number>): Promise<void>
```

---

### 7. Frontend hook — `frontend/src/lib/hooks/useSkills.ts` (NEW FILE)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as routingApi from '@/lib/api/routing';

export function useAgentSkills(agentId: string) {
  // useQuery: queryKey ['agentSkills', agentId]
  // useMutation: upsert + delete + invalidate
}

export function useAllAgentsWithSkills() {
  // useQuery: queryKey ['agentsWithSkills']
}
```

---

## Backward Compatibility Contract

- Existing calls to `selectAgent()` with `queue.selectionAlgorithm = 'longest_idle'` MUST behave identically to before
- Agents that only have `agent.skills: string[]` (old format) MUST still match and be selected
- New `proficiency` field defaults to `3` if not present

---

## Testing Instructions

After implementation, verify:

1. `services/routing` — run existing tests, ensure no regressions
2. Manually: set algorithm to `best_match` on a test queue, verify agent with highest total proficiency score is selected first
3. TypeScript: `cd frontend && npx tsc --noEmit` — zero errors

---

## Files To Create/Modify Summary

```
MODIFY  services/routing/lib/selection.js
MODIFY  services/routing/lib/agent-repo.js
MODIFY  services/routing/lib/redis-state.js
MODIFY  services/routing/src/server.js
CREATE  services/routing/migrations/002_agent_skills_proficiency.sql
MODIFY  frontend/src/lib/api/routing.ts
CREATE  frontend/src/lib/hooks/useSkills.ts
```
