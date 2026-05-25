'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listBots,
  createBot,
  updateBot,
  deleteBot,
  type AgentBot,
} from '@/lib/api/settings';
import { DEMO_BOTS, settingsDemoDelay } from '@/lib/demo/settingsFixture';
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
import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/Sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-radix';
import { Bot, Pencil, Trash2, Copy } from 'lucide-react';

export function BotsSection() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const canManage = can(role, 'manageInboxes');

  const { data: bots = [], isLoading } = useQuery({
    queryKey: ['agent-bots'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_BOTS;
      try {
        const list = await listBots();
        return list.length ? list : DEMO_BOTS;
      } catch {
        return DEMO_BOTS;
      }
    },
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AgentBot | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [botType, setBotType] = useState<'webhook' | 'agent_ai'>('webhook');
  const [outgoingUrl, setOutgoingUrl] = useState('');
  const demoToken = 'bw_demo_' + (editing?.id ?? 'new');

  function openCreate() {
    setEditing(null);
    setName('');
    setDescription('');
    setBotType('webhook');
    setOutgoingUrl('');
    setSheetOpen(true);
  }

  function openEdit(bot: AgentBot) {
    setEditing(bot);
    setName(bot.name);
    setDescription(bot.description ?? '');
    setBotType(bot.bot_type);
    setOutgoingUrl(bot.outgoing_url);
    setSheetOpen(true);
  }

  const { mutate: saveBot, isPending: saving } = useMutation({
    mutationFn: async () => {
      const payload = { name, description, bot_type: botType, outgoing_url: outgoingUrl };
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        if (editing) return { ...editing, ...payload };
        return { id: Date.now(), ...payload };
      }
      if (editing) return updateBot(editing.id, payload);
      return createBot(payload);
    },
    onSuccess: saved => {
      qc.setQueryData<AgentBot[]>(['agent-bots'], prev => {
        const list = prev ?? [];
        if (editing) return list.map(b => (b.id === saved.id ? saved : b));
        return [...list, saved];
      });
      toast.success(editing ? 'Bot updated' : 'Bot created');
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteTarget, setDeleteTarget] = useState<AgentBot | null>(null);

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return;
      }
      await deleteBot(deleteTarget!.id);
    },
    onSuccess: () => {
      qc.setQueryData<AgentBot[]>(['agent-bots'], prev =>
        (prev ?? []).filter(b => b.id !== deleteTarget?.id),
      );
      toast.success('Bot deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copyToken() {
    void navigator.clipboard.writeText(demoToken);
    toast.success('Token copied');
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Agent Bots"
        description="Connect webhook or AI bots to automate responses."
        actionLabel="Add bot"
        onAction={openCreate}
        canAction={canManage}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No bots"
          description="Add an agent bot to handle conversations via webhook."
          actionLabel="Add bot"
          onAction={openCreate}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {bots.map(bot => (
            <li key={bot.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{bot.name}</h3>
                    <Badge variant="outline" className="text-xs capitalize">
                      {bot.bot_type === 'agent_ai' ? 'Agent AI' : 'Webhook'}
                    </Badge>
                  </div>
                  {bot.description && (
                    <p className="text-xs text-muted-foreground mt-1">{bot.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 truncate font-mono">
                    {bot.outgoing_url}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      aria-label="Edit bot"
                      onClick={() => openEdit(bot)}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-destructive"
                      aria-label="Delete bot"
                      onClick={() => setDeleteTarget(bot)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit bot' : 'New agent bot'}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bot type</Label>
            <Select value={botType} onValueChange={v => setBotType(v as 'webhook' | 'agent_ai')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="agent_ai">Agent AI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Outgoing URL</Label>
            <Input
              value={outgoingUrl}
              onChange={e => setOutgoingUrl(e.target.value)}
              placeholder="https://api.example.com/hook"
            />
          </div>
          <div className="rounded-md bg-muted/50 p-3 space-y-2">
            <Label className="text-xs">Access token</Label>
            <div className="flex gap-2">
              <Input readOnly value={demoToken} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={copyToken} aria-label="Copy token">
                <Copy size={14} />
              </Button>
            </div>
          </div>
          <Button
            className="w-full bg-brand-primary hover:bg-brand-primary/90"
            disabled={!name.trim() || !outgoingUrl.trim() || saving}
            onClick={() => saveBot()}
          >
            {saving ? 'Saving…' : 'Save bot'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name}?`}
        description="Inboxes using this bot will stop receiving automated replies."
        isPending={deleting}
        onConfirm={() => remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
