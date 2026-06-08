'use client';

/**
 * Skills Manager Admin UI — Sprint 1 G04
 * Allows supervisors/admins to manage agent skill proficiency levels and
 * configure queue skill weights for weighted SBR.
 *
 * Backend: services/routing (GET/PUT/DELETE /v1/agents/:id/skills, PATCH /v1/queues/:id/skill-weights)
 */

import { useState, useCallback } from 'react';
import { useAllAgentsWithSkills, useAgentSkills, useQueueSkillWeights } from '@/lib/hooks/useSkills';
import { useQuery } from '@tanstack/react-query';
import { listQueues } from '@/lib/api/routing';
import { useTenantId } from '@/lib/hooks/useTenantScope';
import { SectionHeader } from './shared/SectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { AgentWithSkills, AgentSkill, Queue } from '@/types';
import {
  Users,
  Star,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ─── Proficiency Stars ─────────────────────────────────────────────────────────

const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Novice',
  2: 'Beginner',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

const PROFICIENCY_COLORS: Record<number, string> = {
  1: 'text-gray-400',
  2: 'text-blue-400',
  3: 'text-yellow-500',
  4: 'text-orange-500',
  5: 'text-red-500',
};

function ProficiencyStars({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div
      className="flex gap-0.5"
      title={PROFICIENCY_LABELS[display] ?? String(display)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(n)}
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => !readonly && setHovered(null)}
          className={cn(
            'transition-colors',
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
            n <= display ? PROFICIENCY_COLORS[value] ?? 'text-yellow-500' : 'text-gray-200',
          )}
          aria-label={`Proficiency ${n}: ${PROFICIENCY_LABELS[n]}`}
        >
          <Star className="w-4 h-4 fill-current" />
        </button>
      ))}
    </div>
  );
}

// ─── Agent skill row (inline add/edit) ─────────────────────────────────────────

function AgentSkillRow({
  agentId,
  skill,
}: {
  agentId: string;
  skill: AgentSkill;
}) {
  const { upsert, remove } = useAgentSkills(agentId);
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center gap-2 py-1 group">
      <span className="text-sm font-mono text-gray-600 min-w-[100px] truncate">{skill.skill}</span>
      <ProficiencyStars
        value={skill.proficiency}
        readonly={!editing}
        onChange={(p) => {
          upsert.mutate({ skill: skill.skill, proficiency: p });
          setEditing(false);
        }}
      />
      <span className="text-xs text-muted-foreground w-24 hidden group-hover:block">
        {PROFICIENCY_LABELS[skill.proficiency]}
      </span>
      <div className="ms-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="p-1 rounded hover:bg-muted text-muted-foreground text-xs"
          title="Edit proficiency"
        >
          <Star className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => remove.mutate({ skill: skill.skill })}
          className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 text-xs"
          title="Remove skill"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Add skill form ────────────────────────────────────────────────────────────

function AddSkillForm({ agentId, existingSkills }: { agentId: string; existingSkills: string[] }) {
  const [skillName, setSkillName] = useState('');
  const [proficiency, setProficiency] = useState(3);
  const { upsert } = useAgentSkills(agentId);

  const submit = useCallback(() => {
    const name = skillName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name || existingSkills.includes(name)) return;
    upsert.mutate({ skill: name, proficiency });
    setSkillName('');
    setProficiency(3);
  }, [skillName, proficiency, existingSkills, upsert]);

  return (
    <div className="flex items-center gap-2 pt-2 border-t border-dashed">
      <Input
        value={skillName}
        onChange={(e) => setSkillName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="new_skill_name"
        className="h-7 text-xs font-mono w-36"
      />
      <ProficiencyStars value={proficiency} onChange={setProficiency} />
      <Button
        size="sm"
        variant="ghost"
        onClick={submit}
        disabled={!skillName.trim() || upsert.isPending}
        className="h-7 px-2 text-xs"
      >
        <Plus className="w-3 h-3 me-1" />
        Add
      </Button>
    </div>
  );
}

// ─── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentWithSkills }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-100 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-start transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
          {(agent.displayName ?? agent.agentId).slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {agent.displayName ?? agent.agentId}
          </p>
          <div className="flex gap-1 flex-wrap mt-0.5">
            {agent.agentSkills.length === 0 ? (
              <span className="text-xs text-muted-foreground">No skills assigned</span>
            ) : (
              agent.agentSkills.map((s) => (
                <Badge
                  key={s.skill}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                >
                  {s.skill} ×{s.proficiency}
                </Badge>
              ))
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 py-3 bg-gray-50 border-t space-y-1">
          {agent.agentSkills.map((s) => (
            <AgentSkillRow key={s.skill} agentId={agent.agentId} skill={s} />
          ))}
          <AddSkillForm
            agentId={agent.agentId}
            existingSkills={agent.agentSkills.map((s) => s.skill)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Queue skill weights panel ────────────────────────────────────────────────

function QueueWeightsPanel({ queue }: { queue: Queue }) {
  const { updateWeights } = useQueueSkillWeights(queue.id);
  const [weights, setWeights] = useState<Record<string, number>>(
    (queue.skillWeights as Record<string, number> | undefined) ?? {},
  );
  const [dirty, setDirty] = useState(false);

  const skills = (queue.skills ?? []).map((s) =>
    typeof s === 'string' ? s : (s as { skill: string }).skill,
  );

  function setWeight(skill: string, val: string) {
    const n = parseFloat(val);
    setWeights((prev) => ({ ...prev, [skill]: Number.isFinite(n) ? n : 1 }));
    setDirty(true);
  }

  return (
    <div className="rounded-lg border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{queue.name}</p>
          <p className="text-xs text-muted-foreground">
            Algorithm: <span className="font-mono">{queue.selectionAlgorithm ?? 'longest_idle'}</span>
          </p>
        </div>
        {dirty && (
          <Button
            size="sm"
            onClick={() => {
              updateWeights.mutate({ skillWeights: weights });
              setDirty(false);
            }}
            disabled={updateWeights.isPending}
            className="bg-brand-primary hover:bg-brand-primary/90 h-7 text-xs"
          >
            {updateWeights.isPending ? 'Saving…' : 'Save weights'}
          </Button>
        )}
      </div>

      {skills.length === 0 ? (
        <p className="text-xs text-muted-foreground">No required skills configured for this queue.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {skills.map((skill) => (
            <div key={skill} className="space-y-1">
              <Label className="text-xs text-muted-foreground font-mono">{skill}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={weights[skill] ?? 1}
                  onChange={(e) => setWeight(skill, e.target.value)}
                  className="h-7 text-xs w-20"
                />
                <div
                  className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"
                  title={`Relative weight: ${weights[skill] ?? 1}`}
                >
                  <div
                    className="h-full bg-brand-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((weights[skill] ?? 1) / 10) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function SkillsManagerSection() {
  const tenantId = useTenantId();
  const agentsQuery = useAllAgentsWithSkills();
  const queuesQuery = useQuery<Queue[]>({
    queryKey: ['queues', tenantId],
    queryFn: listQueues,
    staleTime: 30_000,
  });

  const [tab, setTab] = useState<'agents' | 'queues'>('agents');
  const [search, setSearch] = useState('');

  const agents = (agentsQuery.data ?? []).filter((a) =>
    search
      ? (a.displayName ?? a.agentId).toLowerCase().includes(search.toLowerCase())
      : true,
  );

  const queues = (queuesQuery.data ?? []).filter((q) =>
    q.selectionAlgorithm === 'best_match' ||
    (q.skills && (q.skills as unknown[]).length > 0),
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader
        title="Skills Manager"
        description="Assign skills and proficiency levels to agents, and configure queue skill weights for best-match routing."
      />

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
        {(['agents', 'queues'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t
                ? 'bg-white text-brand-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'agents' ? <Users className="w-4 h-4" /> : <Sliders className="w-4 h-4" />}
            {t === 'agents' ? 'Agent Skills' : 'Queue Weights'}
          </button>
        ))}
      </div>

      {/* Agents tab */}
      {tab === 'agents' && (
        <div className="space-y-3">
          <Input
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />

          {agentsQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : agents.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {search ? 'No agents match your search.' : 'No agents found. Agents appear here once they have been registered in the routing service.'}
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((a) => (
                <AgentCard key={a.agentId} agent={a} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Queue weights tab */}
      {tab === 'queues' && (
        <div className="space-y-3">
          {queuesQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : queues.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
              <Sliders className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No queues with <code className="font-mono text-xs">best_match</code> algorithm found.
              </p>
              <p className="text-xs text-muted-foreground">
                Queues appear here when they have required skills or use the best_match selection algorithm.
              </p>
            </div>
          ) : (
            queues.map((q) => <QueueWeightsPanel key={q.id} queue={q} />)
          )}
        </div>
      )}
    </div>
  );
}
