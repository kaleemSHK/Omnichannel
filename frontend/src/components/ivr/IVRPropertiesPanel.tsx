'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Settings2, Clock } from 'lucide-react';
import type { IVRNode } from '@/types';
import { NODE_META } from './IVRNodeCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

// ─── Sub-editors ───────────────────────────────────────────────────────────────

interface SkillReq { skill: string; required: boolean }

function SkillEditor({
  skills,
  onChange,
}: {
  skills: SkillReq[];
  onChange: (s: SkillReq[]) => void;
}) {
  const [name, setName] = useState('');
  const [req, setReq] = useState(true);

  const add = () => {
    const s = name.trim().toLowerCase();
    if (!s || skills.some(x => x.skill === s)) return;
    onChange([...skills, { skill: s, required: req }]);
    setName('');
  };

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-gray-700 mb-2">Skill requirements</p>
      {skills.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic mb-2">Uses queue defaults</p>
      ) : (
        <ul className="space-y-1 mb-2">
          {skills.map(s => (
            <li key={s.skill} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChange(skills.map(x => x.skill === s.skill ? { ...x, required: !x.required } : x))}
                className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded',
                  s.required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500',
                )}
              >
                {s.required ? 'REQ' : 'OPT'}
              </button>
              <span className="flex-1 text-[11px] font-mono">{s.skill}</span>
              <button type="button" onClick={() => onChange(skills.filter(x => x.skill !== s.skill))}>
                <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="e.g. spanish"
          className="flex-1 px-2 py-1 text-[11px] border border-gray-200 rounded-md font-mono min-w-0"
        />
        <button
          type="button"
          onClick={() => setReq(p => !p)}
          className={cn(
            'text-[9px] font-bold px-1.5 py-1 rounded shrink-0',
            req ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500',
          )}
        >
          {req ? 'REQ' : 'OPT'}
        </button>
        <button
          type="button"
          onClick={add}
          disabled={!name.trim()}
          className="shrink-0 p-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

interface DtmfOption { digit: string; label: string }

function DtmfOptionsEditor({
  options,
  onChange,
}: {
  options: DtmfOption[];
  onChange: (o: DtmfOption[]) => void;
}) {
  const add = () => {
    const next = String(options.length + 1);
    onChange([...options, { digit: next, label: `Option ${next}` }]);
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-700">Menu options</p>
        <button
          type="button"
          onClick={add}
          className="text-[10px] text-brand-primary hover:underline flex items-center gap-0.5"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      <ul className="space-y-1.5">
        {options.map((o, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-gray-100 text-gray-600 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
              {o.digit}
            </span>
            <input
              value={o.label}
              onChange={e => {
                const next = [...options];
                next[i] = { ...o, label: e.target.value };
                onChange(next);
              }}
              className="flex-1 px-1.5 py-0.5 text-[11px] border border-gray-200 rounded-md min-w-0"
            />
            <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))}>
              <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-2 py-1.5 text-[11px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-primary';
const textareaCls = `${inputCls} resize-none`;
const selectCls = `${inputCls} bg-white`;

// ─── Type-specific forms ───────────────────────────────────────────────────────

function PlayForm({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="TTS message">
        <textarea
          className={cn(textareaCls, 'h-24')}
          value={String(cfg.text ?? '')}
          onChange={e => onChange({ ...cfg, text: e.target.value })}
          placeholder="Thank you for calling…"
        />
      </Field>
      <Field label="Audio file URL (optional)">
        <input
          className={inputCls}
          value={String(cfg.media ?? '')}
          onChange={e => onChange({ ...cfg, media: e.target.value })}
          placeholder="sound:hello-world or https://…"
        />
      </Field>
    </>
  );
}

function DtmfForm({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const options: DtmfOption[] = Array.isArray(cfg.options)
    ? (cfg.options as DtmfOption[])
    : [{ digit: '1', label: 'Sales' }, { digit: '2', label: 'Support' }];

  return (
    <>
      <Field label="Prompt text">
        <textarea
          className={cn(textareaCls, 'h-20')}
          value={String(cfg.prompt ?? '')}
          onChange={e => onChange({ ...cfg, prompt: e.target.value })}
          placeholder="Press 1 for Sales, press 2 for Support…"
        />
      </Field>
      <DtmfOptionsEditor
        options={options}
        onChange={o => onChange({ ...cfg, options: o })}
      />
      <Field label="Max retries">
        <input
          type="number"
          className={inputCls}
          value={Number(cfg.maxRetries ?? 3)}
          onChange={e => onChange({ ...cfg, maxRetries: Number(e.target.value) })}
          min={1}
          max={10}
        />
      </Field>
    </>
  );
}

function VoicebotForm({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="AI model">
        <select
          className={selectCls}
          value={String(cfg.model ?? 'gpt-4o')}
          onChange={e => onChange({ ...cfg, model: e.target.value })}
        >
          <option value="gpt-4o">GPT-4o (OpenAI)</option>
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
          <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
          <option value="custom">Custom endpoint</option>
        </select>
      </Field>
      <Field label="System prompt">
        <textarea
          className={cn(textareaCls, 'h-24')}
          value={String(cfg.systemPrompt ?? '')}
          onChange={e => onChange({ ...cfg, systemPrompt: e.target.value })}
          placeholder="You are a helpful customer service assistant…"
        />
      </Field>
      <Field label="Max turns">
        <input
          type="number"
          className={inputCls}
          value={Number(cfg.maxTurns ?? 5)}
          onChange={e => onChange({ ...cfg, maxTurns: Number(e.target.value) })}
          min={1}
          max={20}
        />
      </Field>
      <Field label="Fallback intent (→ next node)">
        <input
          className={inputCls}
          value={String(cfg.fallbackIntent ?? '')}
          onChange={e => onChange({ ...cfg, fallbackIntent: e.target.value })}
          placeholder="e.g. escalate"
        />
      </Field>
    </>
  );
}

function TransferForm({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const skills: SkillReq[] = Array.isArray(cfg.skillRequirements)
    ? (cfg.skillRequirements as SkillReq[])
    : [];

  return (
    <>
      <Field label="Queue key">
        <input
          className={cn(inputCls, 'font-mono')}
          value={String(cfg.queueKey ?? '')}
          onChange={e => onChange({ ...cfg, queueKey: e.target.value.trim() })}
          placeholder="e.g. support"
        />
      </Field>
      <Field label="Priority (higher = faster)">
        <input
          type="number"
          className={inputCls}
          value={Number(cfg.priority ?? 1)}
          onChange={e => onChange({ ...cfg, priority: Number(e.target.value) })}
          min={1}
          max={10}
        />
      </Field>
      <SkillEditor
        skills={skills}
        onChange={s => onChange({ ...cfg, skillRequirements: s.length ? s : undefined })}
      />
    </>
  );
}

function ConditionForm({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Variable name">
        <input
          className={cn(inputCls, 'font-mono')}
          value={String(cfg.variable ?? '')}
          onChange={e => onChange({ ...cfg, variable: e.target.value })}
          placeholder="e.g. caller_type"
        />
      </Field>
      <Field label="Operator">
        <select
          className={selectCls}
          value={String(cfg.operator ?? 'eq')}
          onChange={e => onChange({ ...cfg, operator: e.target.value })}
        >
          <option value="eq">== equals</option>
          <option value="neq">!= not equals</option>
          <option value="contains">contains</option>
          <option value="starts">starts with</option>
          <option value="gt">{'>'} greater than</option>
          <option value="lt">{'<'} less than</option>
          <option value="empty">is empty</option>
          <option value="not_empty">is not empty</option>
        </select>
      </Field>
      <Field label="Value to compare">
        <input
          className={inputCls}
          value={String(cfg.value ?? '')}
          onChange={e => onChange({ ...cfg, value: e.target.value })}
          placeholder="e.g. vip"
        />
      </Field>
    </>
  );
}

function ScheduleForm({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Timezone">
        <select
          className={selectCls}
          value={String(cfg.timezone ?? 'UTC')}
          onChange={e => onChange({ ...cfg, timezone: e.target.value })}
        >
          {['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
            'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata'].map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </Field>
      <Field label="Open hours (24h, e.g. 09:00-17:00)">
        <input
          className={inputCls}
          value={String(cfg.openHours ?? '09:00-17:00')}
          onChange={e => onChange({ ...cfg, openHours: e.target.value })}
          placeholder="09:00-17:00"
        />
      </Field>
      <Field label="Open days (comma-separated)">
        <input
          className={inputCls}
          value={String(cfg.openDays ?? 'Mon,Tue,Wed,Thu,Fri')}
          onChange={e => onChange({ ...cfg, openDays: e.target.value })}
          placeholder="Mon,Tue,Wed,Thu,Fri"
        />
      </Field>
      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Outputs: <strong className="font-mono">open</strong> / <strong className="font-mono">closed</strong>
      </p>
    </>
  );
}

function WebhookForm({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="URL">
        <input
          className={inputCls}
          value={String(cfg.url ?? '')}
          onChange={e => onChange({ ...cfg, url: e.target.value })}
          placeholder="https://api.example.com/hook"
        />
      </Field>
      <Field label="Method">
        <select
          className={selectCls}
          value={String(cfg.method ?? 'POST')}
          onChange={e => onChange({ ...cfg, method: e.target.value })}
        >
          {['GET', 'POST', 'PUT', 'PATCH'].map(m => <option key={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="JSON body (optional)">
        <textarea
          className={cn(textareaCls, 'h-20 font-mono text-[10px]')}
          value={String(cfg.body ?? '')}
          onChange={e => onChange({ ...cfg, body: e.target.value })}
          placeholder={'{\n  "callerId": "{{caller_id}}"\n}'}
        />
      </Field>
      <Field label="Store response in variable">
        <input
          className={cn(inputCls, 'font-mono')}
          value={String(cfg.storeAs ?? '')}
          onChange={e => onChange({ ...cfg, storeAs: e.target.value })}
          placeholder="webhook_response"
        />
      </Field>
    </>
  );
}

function SetVariableForm({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Variable name">
        <input
          className={cn(inputCls, 'font-mono')}
          value={String(cfg.varName ?? '')}
          onChange={e => onChange({ ...cfg, varName: e.target.value })}
          placeholder="caller_type"
        />
      </Field>
      <Field label="Value">
        <input
          className={inputCls}
          value={String(cfg.varValue ?? '')}
          onChange={e => onChange({ ...cfg, varValue: e.target.value })}
          placeholder="vip"
        />
      </Field>
      <p className="text-[10px] text-muted-foreground mt-2">
        Use <code className="bg-gray-100 px-1 rounded font-mono">{'{{variable_name}}'}</code> in later nodes
      </p>
    </>
  );
}

function VoicemailForm({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Beep tone">
        <select
          className={selectCls}
          value={String(cfg.beep ?? 'true')}
          onChange={e => onChange({ ...cfg, beep: e.target.value === 'true' })}
        >
          <option value="true">Yes — play beep</option>
          <option value="false">No beep</option>
        </select>
      </Field>
      <Field label="Max recording (seconds)">
        <input
          type="number"
          className={inputCls}
          value={Number(cfg.maxSeconds ?? 60)}
          onChange={e => onChange({ ...cfg, maxSeconds: Number(e.target.value) })}
          min={5}
          max={300}
        />
      </Field>
      <Field label="Save recording to">
        <input
          className={cn(inputCls, 'font-mono')}
          value={String(cfg.storeAs ?? 'voicemail_url')}
          onChange={e => onChange({ ...cfg, storeAs: e.target.value })}
        />
      </Field>
    </>
  );
}

function SmsForm({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Message">
        <textarea
          className={cn(textareaCls, 'h-20')}
          value={String(cfg.message ?? '')}
          onChange={e => onChange({ ...cfg, message: e.target.value })}
          placeholder="Hi {{caller_name}}, thanks for calling…"
        />
      </Field>
      <Field label="From number (leave blank for default)">
        <input
          className={cn(inputCls, 'font-mono')}
          value={String(cfg.from ?? '')}
          onChange={e => onChange({ ...cfg, from: e.target.value })}
          placeholder="+14155551234"
        />
      </Field>
      <p className="text-[10px] text-muted-foreground mt-2">
        Sent to the caller&apos;s number automatically
      </p>
    </>
  );
}

function CallbackForm({ cfg, onChange }: { cfg: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Queue key">
        <input
          className={cn(inputCls, 'font-mono')}
          value={String(cfg.queueKey ?? '')}
          onChange={e => onChange({ ...cfg, queueKey: e.target.value.trim() })}
          placeholder="support"
        />
      </Field>
      <Field label="Confirmation message">
        <textarea
          className={cn(textareaCls, 'h-16')}
          value={String(cfg.confirmText ?? '')}
          onChange={e => onChange({ ...cfg, confirmText: e.target.value })}
          placeholder="You are queued for a callback. An agent will call you shortly."
        />
      </Field>
    </>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  selected: IVRNode | null;
  label: string;
  onLabelChange: (v: string) => void;
  nodeConfig: Record<string, unknown>;
  onConfigChange: (c: Record<string, unknown>) => void;
  onSave: () => void;
  onDelete?: () => void;
}

export function IVRPropertiesPanel({
  selected,
  label,
  onLabelChange,
  nodeConfig,
  onConfigChange,
  onSave,
  onDelete,
}: Props) {
  const meta = selected ? NODE_META[selected.type] : null;
  const Icon = meta?.icon;

  return (
    <aside className="w-[240px] shrink-0 bg-white border-s border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-gray-800">Properties</span>
      </div>

      {!selected || !meta ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[11px] text-muted-foreground text-center px-4">
            Select a node on the canvas to configure it
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {/* Node type badge */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg mb-3',
              meta.bg,
            )}
          >
            {Icon && <Icon className="w-4 h-4 text-white shrink-0" />}
            <div>
              <p className="text-[11px] font-semibold text-white">{meta.label}</p>
              <p className="text-[10px] text-white/75">{meta.description}</p>
            </div>
          </div>

          {/* Label — all nodes */}
          <Field label="Step label">
            <input
              className={inputCls}
              value={label}
              onChange={e => onLabelChange(e.target.value)}
              placeholder="Friendly name for this step"
            />
          </Field>

          {/* Type-specific form */}
          {selected.type === 'play' && (
            <PlayForm cfg={nodeConfig} onChange={onConfigChange} />
          )}
          {selected.type === 'dtmf' && (
            <DtmfForm cfg={nodeConfig} onChange={onConfigChange} />
          )}
          {selected.type === 'voicebot' && (
            <VoicebotForm cfg={nodeConfig} onChange={onConfigChange} />
          )}
          {(selected.type === 'transfer' || selected.type === 'enqueue') && (
            <TransferForm cfg={nodeConfig} onChange={onConfigChange} />
          )}
          {selected.type === 'condition' && (
            <ConditionForm cfg={nodeConfig} onChange={onConfigChange} />
          )}
          {selected.type === 'schedule' && (
            <ScheduleForm cfg={nodeConfig} onChange={onConfigChange} />
          )}
          {selected.type === 'webhook' && (
            <WebhookForm cfg={nodeConfig} onChange={onConfigChange} />
          )}
          {selected.type === 'set_variable' && (
            <SetVariableForm cfg={nodeConfig} onChange={onConfigChange} />
          )}
          {selected.type === 'voicemail' && (
            <VoicemailForm cfg={nodeConfig} onChange={onConfigChange} />
          )}
          {selected.type === 'sms' && (
            <SmsForm cfg={nodeConfig} onChange={onConfigChange} />
          )}
          {selected.type === 'callback' && (
            <CallbackForm cfg={nodeConfig} onChange={onConfigChange} />
          )}
          {selected.type === 'hangup' && (
            <p className="text-[11px] text-muted-foreground mt-3 italic">
              No configuration needed — this step ends the call.
            </p>
          )}
        </div>
      )}

      {/* Footer actions */}
      {selected && (
        <div className="border-t border-gray-100 px-3 py-2.5 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={onSave}
          >
            Save
          </Button>
          {onDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-red-500 hover:text-red-600 hover:border-red-300"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
    </aside>
  );
}
