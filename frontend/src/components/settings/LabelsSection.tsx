'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  type Label,
} from '@/lib/api/settings';
import { DEMO_LABELS, settingsDemoDelay } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useAuthStore } from '@/lib/store/auth';
import { can } from '@/lib/rbac';
import { SectionHeader } from './shared/SectionHeader';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { EmptyState } from './shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as FormLabel } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/utils/cn';
import { Tag, Pencil, Trash2 } from 'lucide-react';

const COLOR_PRESETS = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#0B5FFF',
  '#8B5CF6',
  '#EC4899',
  '#6B7280',
  '#14B8A6',
  '#F97316',
  '#6366F1',
  '#84CC16',
  '#0EA5E9',
];

export function LabelsSection() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const canManage = can(role, 'manageInboxes');

  const { data: labels = [], isLoading } = useQuery({
    queryKey: ['labels'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_LABELS;
      try {
        const res = await listLabels();
        return res.payload.length ? res.payload : DEMO_LABELS;
      } catch {
        return DEMO_LABELS;
      }
    },
  });

  const { mutate: toggleSidebar } = useMutation({
    mutationFn: async ({ id, show }: { id: number; show: boolean }) => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay(150);
        return { payload: labels.find(l => l.id === id)! };
      }
      return updateLabel(id, { show_on_sidebar: show });
    },
    onSuccess: (_, { id, show }) => {
      qc.setQueryData<Label[]>(['labels'], prev =>
        (prev ?? []).map(l => (l.id === id ? { ...l, show_on_sidebar: show } : l)),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Label | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]!);
  const [showSidebar, setShowSidebar] = useState(true);

  function openCreate() {
    setEditing(null);
    setTitle('');
    setDescription('');
    setColor(COLOR_PRESETS[0]!);
    setShowSidebar(true);
    setSheetOpen(true);
  }

  function openEdit(label: Label) {
    setEditing(label);
    setTitle(label.title);
    setDescription(label.description ?? '');
    setColor(label.color);
    setShowSidebar(label.show_on_sidebar);
    setSheetOpen(true);
  }

  const { mutate: saveLabel, isPending: saving } = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.toLowerCase().trim(),
        description,
        color,
        show_on_sidebar: showSidebar,
      };
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        if (editing) return { payload: { ...editing, ...payload } };
        return {
          payload: { id: Date.now(), ...payload },
        };
      }
      if (editing) return updateLabel(editing.id, payload);
      return createLabel(payload);
    },
    onSuccess: res => {
      const saved = res.payload;
      qc.setQueryData<Label[]>(['labels'], prev => {
        const list = prev ?? [];
        if (editing) return list.map(l => (l.id === saved.id ? saved : l));
        return [...list, saved];
      });
      toast.success(editing ? 'Label updated' : 'Label created');
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteTarget, setDeleteTarget] = useState<Label | null>(null);

  const { mutate: removeLabel, isPending: deleting } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return;
      }
      await deleteLabel(deleteTarget!.id);
    },
    onSuccess: () => {
      qc.setQueryData<Label[]>(['labels'], prev =>
        (prev ?? []).filter(l => l.id !== deleteTarget?.id),
      );
      toast.success('Label deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Labels"
        description="Organize conversations with colored labels."
        actionLabel="Add label"
        onAction={openCreate}
        canAction={canManage}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : labels.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No labels"
          description="Create labels to categorize conversations."
          actionLabel="Add label"
          onAction={openCreate}
        />
      ) : (
        <ul className="border rounded-lg divide-y">
          {labels.map(label => (
            <li
              key={label.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: label.color }}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium capitalize">{label.title}</p>
                {label.description && (
                  <p className="text-xs text-muted-foreground truncate">{label.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:inline">Sidebar</span>
                <Switch
                  checked={label.show_on_sidebar}
                  disabled={!canManage}
                  onCheckedChange={v => toggleSidebar({ id: label.id, show: v })}
                  aria-label={`Show ${label.title} on sidebar`}
                />
                {canManage && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      aria-label="Edit label"
                      onClick={() => openEdit(label)}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-destructive hover:bg-destructive/10"
                      aria-label="Delete label"
                      onClick={() => setDeleteTarget(label)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit label' : 'New label'}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <FormLabel className="text-xs">Title</FormLabel>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="billing" />
          </div>
          <div className="space-y-1">
            <FormLabel className="text-xs">Description</FormLabel>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <FormLabel className="text-xs">Color</FormLabel>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  className={cn(
                    'w-7 h-7 rounded-full border-2 transition-transform',
                    color === c ? 'border-gray-900 scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                aria-label="Custom color"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <FormLabel className="text-xs">Show on sidebar</FormLabel>
            <Switch checked={showSidebar} onCheckedChange={setShowSidebar} />
          </div>
          <Button
            className="w-full bg-brand-primary hover:bg-brand-primary/90"
            disabled={!title.trim() || saving}
            onClick={() => saveLabel()}
          >
            {saving ? 'Saving…' : 'Save label'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete label "${deleteTarget?.title}"?`}
        description="This label will be removed from all conversations."
        isPending={deleting}
        onConfirm={() => removeLabel()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
