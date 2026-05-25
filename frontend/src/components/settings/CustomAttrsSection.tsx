'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listCustomAttributes,
  createCustomAttribute,
  deleteCustomAttribute,
  type CustomAttribute,
  type AttrEntity,
  type AttrType,
} from '@/lib/api/settings';
import { DEMO_CUSTOM_ATTRS, settingsDemoDelay } from '@/lib/demo/settingsFixture';
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
import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/Sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-radix';
import { cn } from '@/lib/utils/cn';
import { Sliders, Trash2 } from 'lucide-react';

type TabId = 'conversation_attribute' | 'contact_attribute';

function toAttributeKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const ATTR_TYPES: { value: AttrType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'list', label: 'List' },
  { value: 'link', label: 'Link' },
];

export function CustomAttrsSection() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const canManage = can(role, 'manageInboxes');
  const [tab, setTab] = useState<TabId>('conversation_attribute');

  const { data: attrs = [], isLoading } = useQuery({
    queryKey: ['custom-attrs', tab],
    queryFn: async () => {
      if (isDemoDataEnabled()) {
        return DEMO_CUSTOM_ATTRS.filter(a => a.attribute_model === tab);
      }
      try {
        const list = await listCustomAttributes(tab);
        return list.length ? list : DEMO_CUSTOM_ATTRS.filter(a => a.attribute_model === tab);
      } catch {
        return DEMO_CUSTOM_ATTRS.filter(a => a.attribute_model === tab);
      }
    },
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [attrType, setAttrType] = useState<AttrType>('text');
  const [listValues, setListValues] = useState('');

  const keyPreview = toAttributeKey(displayName);

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: async () => {
      const payload = {
        attribute_display_name: displayName,
        attribute_display_type: attrType,
        attribute_model: tab as AttrEntity,
        ...(attrType === 'list'
          ? {
              attribute_values: listValues
                .split(',')
                .map(v => v.trim())
                .filter(Boolean),
            }
          : {}),
      };
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return {
          id: Date.now(),
          attribute_key: keyPreview,
          ...payload,
        } as CustomAttribute;
      }
      return createCustomAttribute(payload);
    },
    onSuccess: created => {
      qc.setQueryData<CustomAttribute[]>(['custom-attrs', tab], prev => [...(prev ?? []), created]);
      toast.success('Attribute created');
      setSheetOpen(false);
      setDisplayName('');
      setListValues('');
      setAttrType('text');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteTarget, setDeleteTarget] = useState<CustomAttribute | null>(null);

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return;
      }
      await deleteCustomAttribute(deleteTarget!.id);
    },
    onSuccess: () => {
      qc.setQueryData<CustomAttribute[]>(['custom-attrs', tab], prev =>
        (prev ?? []).filter(a => a.id !== deleteTarget?.id),
      );
      toast.success('Attribute deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Custom Attributes"
        description="Add custom fields to conversations and contacts."
        actionLabel="New attribute"
        onAction={() => setSheetOpen(true)}
        canAction={canManage}
      />

      <div className="flex gap-1 border-b">
        {(
          [
            ['conversation_attribute', 'Conversation attributes'],
            ['contact_attribute', 'Contact attributes'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : attrs.length === 0 ? (
        <EmptyState
          icon={Sliders}
          title="No attributes"
          description="Add custom fields for richer conversation context."
          actionLabel="New attribute"
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Display name</th>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Key</th>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Values</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {attrs.map(attr => (
                <tr key={attr.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{attr.attribute_display_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {attr.attribute_key}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs capitalize">
                      {attr.attribute_display_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {attr.attribute_values?.join(', ') ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-destructive"
                        aria-label="Delete attribute"
                        onClick={() => setDeleteTarget(attr)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="New attribute">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Display name</Label>
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Account Number"
            />
            {keyPreview && (
              <p className="text-xs text-muted-foreground font-mono">Key: {keyPreview}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={attrType} onValueChange={v => setAttrType(v as AttrType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTR_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {attrType === 'list' && (
            <div className="space-y-1">
              <Label className="text-xs">Values (comma-separated)</Label>
              <Input
                value={listValues}
                onChange={e => setListValues(e.target.value)}
                placeholder="Basic, Pro, Enterprise"
              />
            </div>
          )}
          <Button
            className="w-full bg-brand-primary hover:bg-brand-primary/90"
            disabled={!displayName.trim() || creating}
            onClick={() => create()}
          >
            {creating ? 'Creating…' : 'Create attribute'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.attribute_display_name}"?`}
        description="Custom attributes cannot be edited after creation. You can recreate it if needed."
        isPending={deleting}
        onConfirm={() => remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
