'use client';

/**
 * IVR Properties Panel — Sprint 2 IVR1
 *
 * Right-hand panel for editing a selected IVR node.
 * Transfer node extends standard label editing with:
 *   - Queue key input
 *   - Skill requirements editor (add/remove {skill, required} pairs)
 */

import { useState, useEffect } from 'react';
import type { IVRNode } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SkillRequirement {
  skill: string;
  required: boolean;
}

interface Props {
  selected: IVRNode | null;
  label: string;
  onLabelChange: (v: string) => void;
  /** Full config for the selected node — passed by IVRBuilder */
  nodeConfig: Record<string, unknown>;
  /** Called when any config field changes */
  onConfigChange: (c: Record<string, unknown>) => void;
  onSave: () => void;
}

// ─── Skill requirements sub-editor ───────────────────────────────────────────

function SkillRequirementsEditor({
  skills,
  onChange,
}: {
  skills: SkillRequirement[];
  onChange: (skills: SkillRequirement[]) => void;
}) {
  const [newSkill, setNewSkill] = useState('');
  const [newRequired, setNewRequired] = useState(true);

  const add = () => {
    const s = newSkill.trim().toLowerCase();
    if (!s || skills.some((x) => x.skill === s)) return;
    onChange([...skills, { skill: s, required: newRequired }]);
    setNewSkill('');
  };

  const remove = (skill: string) => {
    onChange(skills.filter((x) => x.skill !== skill));
  };

  const toggleRequired = (skill: string) => {
    onChange(skills.map((x) => (x.skill === skill ? { ...x, required: !x.required } : x)));
  };

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-gray-700 mb-1">
        Skill requirements
        <span className="ms-1 text-muted-foreground font-normal">(added to queue defaults)</span>
      </p>

      {skills.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic mb-2">
          No extra skills — uses queue defaults only
        </p>
      ) : (
        <ul className="space-y-1 mb-2">
          {skills.map((s) => (
            <li key={s.skill} className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => toggleRequired(s.skill)}
                title={s.required ? 'Required (click to make optional)' : 'Optional (click to make required)'}
                className={cn(
                  'rounded px-1.5 py-0.5 font-medium text-[10px] leading-none',
                  s.required
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                )}
              >
                {s.required ? 'REQ' : 'OPT'}
              </button>
              <span className="flex-1 font-mono">{s.skill}</span>
              <button
                type="button"
                onClick={() => remove(s.skill)}
                className="text-muted-foreground hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add skill row */}
      <div className="flex gap-1.5 items-center">
        <input
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="e.g. spanish"
          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md font-mono min-w-0"
        />
        <button
          type="button"
          onClick={() => setNewRequired((p) => !p)}
          title="Toggle required / optional"
          className={cn(
            'shrink-0 rounded px-1.5 py-1 text-[10px] font-medium',
            newRequired
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          )}
        >
          {newRequired ? 'REQ' : 'OPT'}
        </button>
        <button
          type="button"
          onClick={add}
          disabled={!newSkill.trim()}
          className="shrink-0 p-1 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IVRPropertiesPanel({
  selected,
  label,
  onLabelChange,
  nodeConfig,
  onConfigChange,
  onSave,
}: Props) {
  // Derive skill requirements from nodeConfig
  const skillRequirements: SkillRequirement[] = Array.isArray(nodeConfig.skillRequirements)
    ? (nodeConfig.skillRequirements as SkillRequirement[])
    : [];

  return (
    <aside className="w-[220px] shrink-0 bg-white border-s border-gray-200 p-3 h-full overflow-y-auto">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Properties</p>

      {!selected ? (
        <p className="text-xs text-muted-foreground">Select a node on the canvas</p>
      ) : (
        <>
          <div className="flex items-center gap-1.5 mb-3">
            <Badge variant="secondary" className="text-[10px] capitalize">
              {selected.type}
            </Badge>
            <span className="text-[10px] text-muted-foreground truncate">{selected.id}</span>
          </div>

          {/* Label — all nodes */}
          <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
          <input
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md"
          />

          {/* play node */}
          {selected.type === 'play' && (
            <>
              <label className="block text-xs font-medium text-gray-700 mt-3 mb-1">TTS text</label>
              <textarea
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md h-20 resize-none"
                defaultValue={String(nodeConfig.text ?? '')}
                onChange={(e) => onConfigChange({ ...nodeConfig, text: e.target.value })}
              />
            </>
          )}

          {/* dtmf node */}
          {selected.type === 'dtmf' && (
            <>
              <label className="block text-xs font-medium text-gray-700 mt-3 mb-1">Prompt</label>
              <textarea
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md h-16 resize-none"
                defaultValue={String(nodeConfig.prompt ?? '')}
                onChange={(e) => onConfigChange({ ...nodeConfig, prompt: e.target.value })}
              />
            </>
          )}

          {/* transfer / enqueue node — IVR1 */}
          {(selected.type === 'transfer' || selected.type === 'enqueue') && (
            <>
              <label className="block text-xs font-medium text-gray-700 mt-3 mb-1">
                Queue key
              </label>
              <input
                value={String(nodeConfig.queueKey ?? nodeConfig.queue ?? '')}
                onChange={(e) =>
                  onConfigChange({ ...nodeConfig, queueKey: e.target.value.trim() })
                }
                placeholder="e.g. support"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md font-mono"
              />

              <SkillRequirementsEditor
                skills={skillRequirements}
                onChange={(reqs) =>
                  onConfigChange({
                    ...nodeConfig,
                    skillRequirements: reqs.length ? reqs : undefined,
                  })
                }
              />

              <p className="text-[10px] text-muted-foreground mt-2">
                Skills are <em>additive</em> — they extend the queue&apos;s own skill requirements
                for this call only.
              </p>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full mt-4 h-8 text-xs"
            onClick={onSave}
          >
            Save changes
          </Button>
        </>
      )}
    </aside>
  );
}
