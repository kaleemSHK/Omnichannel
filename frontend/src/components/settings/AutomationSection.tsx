'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  type AutomationRule,
  type AutomationCondition,
  type AutomationAction,
} from '@/lib/api/settings';
import { DEMO_AUTOMATIONS, settingsDemoDelay } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useAuthStore } from '@/lib/store/auth';
import { can } from '@/lib/rbac';
import { SectionHeader } from './shared/SectionHeader';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { EmptyState } from './shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/Sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-radix';
import { Zap, Pencil, Trash2, Copy, Plus, X } from 'lucide-react';

const EVENTS = [
  { value: 'conversation_created', label: 'Conversation Created' },
  { value: 'conversation_updated', label: 'Conversation Updated' },
  { value: 'conversation_resolved', label: 'Conversation Resolved' },
  { value: 'message_created', label: 'Message Created' },
];

const CONDITION_ATTRS = ['status', 'label', 'assignee', 'team', 'inbox', 'priority', 'language'];
const OPERATORS = ['equal_to', 'not_equal_to', 'contains', 'does_not_contain'];
const ACTIONS = [
  'assign_team',
  'assign_agent',
  'add_label',
  'remove_label',
  'resolve_conversation',
  'snooze_conversation',
  'send_message',
  'send_email',
];

function eventLabel(name: string) {
  return EVENTS.find(e => e.value === name)?.label ?? name;
}

function emptyCondition(): AutomationCondition {
  return { attribute_key: 'status', filter_operator: 'equal_to', values: [''], query_operator: null };
}

function emptyAction(): AutomationAction {
  return { action_name: 'assign_team', action_params: [] };
}

export function AutomationSection() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const canManage = can(role, 'manageInboxes');

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_AUTOMATIONS;
      try {
        const res = await listAutomations();
        return res.payload.length ? res.payload : DEMO_AUTOMATIONS;
      } catch {
        return DEMO_AUTOMATIONS;
      }
    },
  });

  const { mutate: toggleActive } = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay(150);
        return { payload: rules.find(r => r.id === id)! };
      }
      return updateAutomation(id, { active });
    },
    onSuccess: (_, { id, active }) => {
      qc.setQueryData<AutomationRule[]>(['automations'], prev =>
        (prev ?? []).map(r => (r.id === id ? { ...r, active } : r)),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventName, setEventName] = useState('conversation_created');
  const [conditions, setConditions] = useState<AutomationCondition[]>([emptyCondition()]);
  const [actions, setActions] = useState<AutomationAction[]>([emptyAction()]);

  function openCreate() {
    setEditing(null);
    setName('');
    setDescription('');
    setEventName('conversation_created');
    setConditions([emptyCondition()]);
    setActions([emptyAction()]);
    setSheetOpen(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditing(rule);
    setName(rule.name);
    setDescription(rule.description ?? '');
    setEventName(rule.event_name);
    setConditions(rule.conditions.length ? [...rule.conditions] : [emptyCondition()]);
    setActions(rule.actions.length ? [...rule.actions] : [emptyAction()]);
    setSheetOpen(true);
  }

  const { mutate: saveRule, isPending: saving } = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        event_name: eventName,
        active: editing?.active ?? true,
        conditions: conditions.filter(c => c.values.some(v => v.trim())),
        actions,
      };
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        if (editing) return { payload: { ...editing, ...payload } };
        return { payload: { id: Date.now(), ...payload } as AutomationRule };
      }
      if (editing) return updateAutomation(editing.id, payload);
      return createAutomation(payload);
    },
    onSuccess: res => {
      const saved = res.payload;
      qc.setQueryData<AutomationRule[]>(['automations'], prev => {
        const list = prev ?? [];
        if (editing) return list.map(r => (r.id === saved.id ? saved : r));
        return [...list, saved];
      });
      toast.success(editing ? 'Rule updated' : 'Rule created');
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { mutate: duplicate } = useMutation({
    mutationFn: async (rule: AutomationRule) => {
      const copy = {
        ...rule,
        name: `${rule.name} (copy)`,
        active: false,
      };
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return { payload: { ...copy, id: Date.now() } };
      }
      return createAutomation(copy);
    },
    onSuccess: res => {
      qc.setQueryData<AutomationRule[]>(['automations'], prev => [...(prev ?? []), res.payload]);
      toast.success('Rule duplicated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return;
      }
      await deleteAutomation(deleteTarget!.id);
    },
    onSuccess: () => {
      qc.setQueryData<AutomationRule[]>(['automations'], prev =>
        (prev ?? []).filter(r => r.id !== deleteTarget?.id),
      );
      toast.success('Rule deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Automation"
        description="Automate repetitive tasks with event-based rules."
        actionLabel="New rule"
        onAction={openCreate}
        canAction={canManage}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No automation rules"
          description="Create rules to assign, label, or resolve conversations automatically."
          actionLabel="New rule"
          onAction={openCreate}
        />
      ) : (
        <ul className="space-y-3">
          {rules.map(rule => (
            <li key={rule.id} className="border rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold">{rule.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {eventLabel(rule.event_name)}
                    </Badge>
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {rule.conditions.length} condition(s) · {rule.actions.length} action(s)
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={rule.active}
                    disabled={!canManage}
                    onCheckedChange={v => toggleActive({ id: rule.id, active: v })}
                    aria-label={`Toggle ${rule.name}`}
                  />
                  {canManage && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8"
                        aria-label="Duplicate rule"
                        onClick={() => duplicate(rule)}
                      >
                        <Copy size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8"
                        aria-label="Edit rule"
                        onClick={() => openEdit(rule)}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-destructive"
                        aria-label="Delete rule"
                        onClick={() => setDeleteTarget(rule)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit automation rule' : 'New automation rule'}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Event</Label>
            <Select value={eventName} onValueChange={setEventName}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENTS.map(e => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Conditions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConditions(c => [...c, emptyCondition()])}
              >
                <Plus size={12} className="me-1" />
                Add condition
              </Button>
            </div>
            {conditions.map((c, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-end border rounded-md p-2">
                <Select
                  value={c.attribute_key}
                  onValueChange={v =>
                    setConditions(prev =>
                      prev.map((row, j) => (j === i ? { ...row, attribute_key: v } : row)),
                    )
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_ATTRS.map(a => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={c.filter_operator}
                  onValueChange={v =>
                    setConditions(prev =>
                      prev.map((row, j) => (j === i ? { ...row, filter_operator: v } : row)),
                    )
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map(o => (
                      <SelectItem key={o} value={o}>
                        {o.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1 min-w-[80px]"
                  value={c.values[0] ?? ''}
                  onChange={e =>
                    setConditions(prev =>
                      prev.map((row, j) =>
                        j === i ? { ...row, values: [e.target.value] } : row,
                      ),
                    )
                  }
                  placeholder="Value"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  aria-label="Remove condition"
                  onClick={() => setConditions(prev => prev.filter((_, j) => j !== i))}
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Actions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActions(a => [...a, emptyAction()])}
              >
                <Plus size={12} className="me-1" />
                Add action
              </Button>
            </div>
            {actions.map((a, i) => (
              <div key={i} className="flex gap-2 items-end border rounded-md p-2">
                <Select
                  value={a.action_name}
                  onValueChange={v =>
                    setActions(prev =>
                      prev.map((row, j) => (j === i ? { ...row, action_name: v } : row)),
                    )
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map(act => (
                      <SelectItem key={act} value={act}>
                        {act.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1"
                  placeholder="Params (comma-separated)"
                  value={String(a.action_params[0] ?? '')}
                  onChange={e =>
                    setActions(prev =>
                      prev.map((row, j) =>
                        j === i
                          ? {
                              ...row,
                              action_params: e.target.value
                                .split(',')
                                .map(s => s.trim())
                                .filter(Boolean),
                            }
                          : row,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  aria-label="Remove action"
                  onClick={() => setActions(prev => prev.filter((_, j) => j !== i))}
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>

          <Button
            className="w-full bg-brand-primary hover:bg-brand-primary/90"
            disabled={!name.trim() || saving}
            onClick={() => saveRule()}
          >
            {saving ? 'Saving…' : 'Save rule'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This automation rule will stop running immediately."
        isPending={deleting}
        onConfirm={() => remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
