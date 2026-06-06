'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
  type CannedResponse,
} from '@/lib/api/settings';
import { DEMO_CANNED, settingsDemoDelay } from '@/lib/demo/settingsFixture';
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
import { Textarea } from '@/components/ui/textarea';
import { Sheet } from '@/components/ui/Sheet';
import { MessageSquare, Pencil, Trash2, Search } from 'lucide-react';

const SHORT_CODE_RE = /^[a-z0-9-]+$/;

export function CannedSection() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const canDeleteAny = can(role, 'manageTeam');

  const accountId = useTenantAccountId();
  const [search, setSearch] = useState('');

  const { data: canned = [], isLoading, isError, error } = useQuery({
    queryKey: ['canned', accountId, search],
    enabled: accountId > 0,
    queryFn: () =>
      withDemoOnly(
        search
          ? DEMO_CANNED.filter(
              c => c.short_code.includes(search.toLowerCase()) || c.content.toLowerCase().includes(search.toLowerCase()),
            )
          : DEMO_CANNED,
        () => listCannedResponses(search || undefined),
      ),
  });

  const filtered = canned;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [shortCode, setShortCode] = useState('');
  const [content, setContent] = useState('');

  function openCreate() {
    setEditing(null);
    setShortCode('');
    setContent('');
    setSheetOpen(true);
  }

  function openEdit(item: CannedResponse) {
    setEditing(item);
    setShortCode(item.short_code);
    setContent(item.content);
    setSheetOpen(true);
  }

  const codeValid = shortCode.length > 0 && shortCode.length <= 30 && SHORT_CODE_RE.test(shortCode);
  const contentValid = content.length > 0 && content.length <= 10000;

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: async () => {
      const payload = { short_code: shortCode, content };
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        if (editing) return { ...editing, ...payload };
        return { id: Date.now(), ...payload };
      }
      if (editing) return updateCannedResponse(editing.id, payload);
      return createCannedResponse(payload);
    },
    onSuccess: saved => {
      qc.setQueryData<CannedResponse[]>(['canned', search], prev => {
        const list = prev ?? [];
        if (editing) return list.map(c => (c.id === saved.id ? saved : c));
        return [...list, saved];
      });
      qc.invalidateQueries({ queryKey: ['cannedResponses'] });
      toast.success(editing ? 'Canned response updated' : 'Canned response created');
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteTarget, setDeleteTarget] = useState<CannedResponse | null>(null);

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return;
      }
      await deleteCannedResponse(deleteTarget!.id);
    },
    onSuccess: () => {
      qc.setQueryData<CannedResponse[]>(['canned', search], prev =>
        (prev ?? []).filter(c => c.id !== deleteTarget?.id),
      );
      qc.invalidateQueries({ queryKey: ['cannedResponses'] });
      toast.success('Canned response deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Canned Responses"
        description="Quick replies using short codes like /greet."
        actionLabel="New canned response"
        onAction={openCreate}
      />

      <div className="relative max-w-md">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="ps-9"
          placeholder="Search by short code or content…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search canned responses"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No canned responses"
          description="Create shortcuts agents can type in conversations."
          actionLabel="New canned response"
          onAction={openCreate}
        />
      ) : (
        <ul className="border rounded-lg divide-y">
          {filtered.map(item => (
            <li
              key={item.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20"
            >
              <code className="text-sm font-mono text-brand-primary shrink-0">/{item.short_code}</code>
              <p className="text-sm text-muted-foreground flex-1 line-clamp-2">{item.content}</p>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  aria-label="Edit canned response"
                  onClick={() => openEdit(item)}
                >
                  <Pencil size={13} />
                </Button>
                {canDeleteAny && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-destructive"
                    aria-label="Delete canned response"
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit canned response' : 'New canned response'}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Short code</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-sm">/</span>
              <Input
                value={shortCode}
                onChange={e =>
                  setShortCode(
                    e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                  )
                }
                placeholder="greet"
                maxLength={30}
              />
            </div>
            {shortCode && !codeValid && (
              <p className="text-xs text-destructive">Use letters, numbers, and hyphens only (max 30).</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Content</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} rows={6} maxLength={10000} />
            <p className="text-xs text-muted-foreground text-end">{content.length} / 10,000</p>
          </div>
          <Button
            className="w-full bg-brand-primary hover:bg-brand-primary/90"
            disabled={!codeValid || !contentValid || saving}
            onClick={() => save()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete /${deleteTarget?.short_code}?`}
        description="Agents will no longer be able to use this shortcut."
        isPending={deleting}
        onConfirm={() => remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
