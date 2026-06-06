'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listInboxes } from '@/lib/api/conversations';
import { DEMO_INBOXES } from '@/lib/demo/inboxesFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { withDemoOnly } from '@/lib/demo/tenantSettingsQuery';
import { useTenantAccountId } from '@/lib/hooks/useTenantAccountId';
import { useAuthStore } from '@/lib/store/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Inbox } from 'lucide-react';
import { InboxCard, CHANNEL_META } from './inbox/InboxCard';
import { InboxEditDrawer } from './inbox/InboxEditDrawer';
import { InboxDeleteDialog } from './inbox/InboxDeleteDialog';
import { InboxCreateWizard } from './inbox/InboxCreateWizard';
import type { CWInbox } from '@/types';

function useInboxPermissions() {
  const user = useAuthStore(s => s.user);
  const role = user?.role ?? 'agent';
  return {
    canCreate: role === 'admin' || role === 'platform_admin',
    canEdit: role !== 'agent',
    canDelete: role === 'admin' || role === 'platform_admin',
  };
}

export function InboxSection() {
  const { canCreate, canEdit, canDelete } = useInboxPermissions();
  const accountId = useTenantAccountId();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [editingInbox, setEditingInbox] = useState<CWInbox | null>(null);
  const [deletingInbox, setDeletingInbox] = useState<CWInbox | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: inboxes = [], isLoading, isError, error } = useQuery({
    queryKey: ['inboxes', accountId],
    enabled: accountId > 0 || isDemoDataEnabled(),
    queryFn: () => withDemoOnly(DEMO_INBOXES, () => listInboxes()),
    staleTime: 30_000,
  });

  const channelTypes = ['all', ...Array.from(new Set(inboxes.map(i => i.channel_type)))];

  const filtered = inboxes.filter(inbox => {
    const matchSearch =
      inbox.name.toLowerCase().includes(search.toLowerCase()) ||
      (CHANNEL_META[inbox.channel_type]?.label ?? '')
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchType = filterType === 'all' || inbox.channel_type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Inboxes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage connected channels — {inboxes.length} inbox{inboxes.length !== 1 ? 'es' : ''} total
          </p>
        </div>
        {canCreate && (
          <Button
            className="bg-brand-primary hover:bg-brand-primary/90 shrink-0"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} className="me-1.5" aria-hidden />
            New inbox
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder="Search inboxes…"
            className="ps-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search inboxes"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {channelTypes.map(ct => {
            const label = ct === 'all' ? 'All' : (CHANNEL_META[ct]?.label ?? ct);
            return (
              <button
                key={ct}
                type="button"
                onClick={() => setFilterType(ct)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterType === ct
                    ? 'bg-brand-primary text-white'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
                aria-pressed={filterType === ct}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="list" className="space-y-2">
        {isLoading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Inbox size={20} className="text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium">No inboxes found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || filterType !== 'all'
                  ? 'Try adjusting your search or filter'
                  : canCreate
                    ? 'Create your first inbox to get started'
                    : 'No inboxes have been configured yet'}
              </p>
            </div>
            {canCreate && !search && filterType === 'all' && (
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="bg-brand-primary hover:bg-brand-primary/90"
              >
                <Plus size={14} className="me-1.5" aria-hidden /> New inbox
              </Button>
            )}
          </div>
        ) : (
          filtered.map(inbox => (
            <InboxCard
              key={inbox.id}
              inbox={inbox}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={setEditingInbox}
              onDelete={setDeletingInbox}
            />
          ))
        )}
      </div>

      {!isLoading && inboxes.length > 0 && (
        <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {filtered.length} of {inboxes.length} inboxes
          </span>
          <span>{inboxes.filter(i => i.working_hours_enabled).length} with business hours</span>
        </div>
      )}

      <InboxCreateWizard open={createOpen} onClose={() => setCreateOpen(false)} />
      <InboxEditDrawer inbox={editingInbox} onClose={() => setEditingInbox(null)} />
      <InboxDeleteDialog inbox={deletingInbox} onClose={() => setDeletingInbox(null)} />
    </div>
  );
}
