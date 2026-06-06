'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listMacros,
  createMacro,
  updateMacro,
  deleteMacro,
  type Macro,
  type MacroAction,
  type MacroVisibility,
} from '@/lib/api/settings';
import { DEMO_MACROS, settingsDemoDelay } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { withDemoOnly } from '@/lib/demo/tenantSettingsQuery';
import { useTenantAccountId } from '@/lib/hooks/useTenantAccountId';
import { useAuthStore } from '@/lib/store/auth';
import { can } from '@/lib/rbac';
import { SectionHeader } from './shared/SectionHeader';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { EmptyState } from './shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/Sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-radix';
import { BookOpen, Pencil, Trash2, Plus, X } from 'lucide-react';

const MACRO_ACTIONS = [
  'send_message',
  'assign_team',
  'assign_agent',
  'add_label',
  'remove_label',
  'resolve_conversation',
  'snooze_conversation',
  'mute_conversation',
];

function emptyMacroAction(): MacroAction {
  return { action: 'send_message', action_params: [''] };
}

export function MacrosSection() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const canManageGlobal = can(role, 'manageTeam');

  const accountId = useTenantAccountId();
  const { data: macros = [], isLoading, isError, error } = useQuery({
    queryKey: ['macros', accountId],
    enabled: accountId > 0,
    queryFn: () =>
      withDemoOnly(DEMO_MACROS, async () => {
        const res = await listMacros();
        return res.payload ?? [];
      }),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Macro | null>(null);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<MacroVisibility>('personal');
  const [actions, setActions] = useState<MacroAction[]>([emptyMacroAction()]);

  function openCreate() {
    setEditing(null);
    setName('');
    setVisibility('personal');
    setActions([emptyMacroAction()]);
    setSheetOpen(true);
  }

  function openEdit(macro: Macro) {
    setEditing(macro);
    setName(macro.name);
    setVisibility(macro.visibility);
    setActions(macro.actions.length ? [...macro.actions] : [emptyMacroAction()]);
    setSheetOpen(true);
  }

  const { mutate: saveMacro, isPending: saving } = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const payload = {
        name,
        visibility,
        actions: actions.filter(a => a.action),
      };
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        if (editing) {
          return { payload: { ...editing, ...payload, updated_at: now } };
        }
        return {
          payload: {
            id: Date.now(),
            ...payload,
            created_at: now,
            updated_at: now,
          } as Macro,
        };
      }
      if (editing) return updateMacro(editing.id, payload);
      return createMacro(payload);
    },
    onSuccess: res => {
      const saved = res.payload;
      qc.setQueryData<Macro[]>(['macros'], prev => {
        const list = prev ?? [];
        if (editing) return list.map(m => (m.id === saved.id ? saved : m));
        return [...list, saved];
      });
      toast.success(editing ? 'Macro updated' : 'Macro created');
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteTarget, setDeleteTarget] = useState<Macro | null>(null);

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return;
      }
      await deleteMacro(deleteTarget!.id);
    },
    onSuccess: () => {
      qc.setQueryData<Macro[]>(['macros'], prev =>
        (prev ?? []).filter(m => m.id !== deleteTarget?.id),
      );
      toast.success('Macro deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Macros"
        description="One-click action sequences for agents."
        actionLabel="New macro"
        onAction={openCreate}
      />

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : macros.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No macros"
          description="Create macros to run multiple actions at once."
          actionLabel="New macro"
          onAction={openCreate}
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Visibility</th>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Created</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {macros.map(macro => (
                <tr key={macro.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{macro.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{macro.actions.length}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs capitalize">
                      {macro.visibility}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(macro.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8"
                        aria-label="Edit macro"
                        onClick={() => openEdit(macro)}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-destructive"
                        aria-label="Delete macro"
                        onClick={() => setDeleteTarget(macro)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editing ? 'Edit macro' : 'New macro'}>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Visibility</Label>
            <Select
              value={visibility}
              onValueChange={v => setVisibility(v as MacroVisibility)}
              disabled={!canManageGlobal && visibility === 'global'}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Personal (only me)</SelectItem>
                {canManageGlobal && <SelectItem value="global">Global (all agents)</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Actions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActions(a => [...a, emptyMacroAction()])}
              >
                <Plus size={12} className="me-1" />
                Add action
              </Button>
            </div>
            {actions.map((a, i) => (
              <div key={i} className="flex gap-2 border rounded-md p-2">
                <Select
                  value={a.action}
                  onValueChange={v =>
                    setActions(prev =>
                      prev.map((row, j) => (j === i ? { ...row, action: v } : row)),
                    )
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MACRO_ACTIONS.map(act => (
                      <SelectItem key={act} value={act}>
                        {act.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1"
                  placeholder="Message or param"
                  value={String(a.action_params[0] ?? '')}
                  onChange={e =>
                    setActions(prev =>
                      prev.map((row, j) =>
                        j === i ? { ...row, action_params: [e.target.value] } : row,
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
            onClick={() => saveMacro()}
          >
            {saving ? 'Saving…' : 'Save macro'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        description="Agents will no longer be able to run this macro."
        isPending={deleting}
        onConfirm={() => remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
