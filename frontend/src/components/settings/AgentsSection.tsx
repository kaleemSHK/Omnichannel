'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listAgents, createAgent, updateAgent, deleteAgent, type Agent } from '@/lib/api/settings';
import { DEMO_AGENTS, settingsDemoDelay } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
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
import { Users, Pencil, Trash2, Mail } from 'lucide-react';

const STATUS_DOT: Record<string, string> = {
  online: 'bg-green-500',
  busy: 'bg-amber-500',
  offline: 'bg-gray-400',
};

export function AgentsSection() {
  const qc = useQueryClient();
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_AGENTS;
      try {
        const list = await listAgents();
        return list.length ? list : DEMO_AGENTS;
      } catch {
        return DEMO_AGENTS;
      }
    },
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'agent' | 'administrator'>('agent');

  const { mutate: invite, isPending: inviting } = useMutation({
    mutationFn: async () => {
      const payload = { name: inviteName, email: inviteEmail, role: inviteRole };
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return {
          id: Date.now(),
          ...payload,
          availability_status: 'offline' as const,
          confirmed: false,
        };
      }
      return createAgent(payload);
    },
    onSuccess: created => {
      qc.setQueryData<Agent[]>(['agents'], prev => [...(prev ?? []), created]);
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteOpen(false);
      setInviteName('');
      setInviteEmail('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [editRole, setEditRole] = useState<'agent' | 'administrator'>('agent');

  const { mutate: saveRole, isPending: savingRole } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return { ...editAgent!, role: editRole };
      }
      return updateAgent(editAgent!.id, { role: editRole });
    },
    onSuccess: updated => {
      qc.setQueryData<Agent[]>(['agents'], prev =>
        (prev ?? []).map(a => (a.id === updated.id ? { ...a, ...updated } : a)),
      );
      toast.success('Role updated');
      setEditAgent(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);

  const { mutate: removeAgent, isPending: deleting } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return;
      }
      await deleteAgent(deleteTarget!.id);
    },
    onSuccess: () => {
      qc.setQueryData<Agent[]>(['agents'], prev =>
        (prev ?? []).filter(a => a.id !== deleteTarget?.id),
      );
      toast.success('Agent removed');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Agents"
        description={`${agents.length} agent${agents.length !== 1 ? 's' : ''} in your account`}
        actionLabel="Invite agent"
        onAction={() => setInviteOpen(true)}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No agents yet"
          description="Invite your first agent to get started."
          actionLabel="Invite agent"
          onAction={() => setInviteOpen(true)}
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Agent</th>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Role</th>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                        {agent.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.email}</p>
                      </div>
                      {!agent.confirmed && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize text-xs">
                      {agent.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          STATUS_DOT[agent.availability_status] ?? 'bg-gray-400',
                        )}
                      />
                      <span className="text-xs capitalize text-muted-foreground">
                        {agent.availability_status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8"
                        aria-label="Edit role"
                        onClick={() => {
                          setEditAgent(agent);
                          setEditRole(agent.role);
                        }}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-destructive hover:bg-destructive/10"
                        aria-label="Remove agent"
                        onClick={() => setDeleteTarget(agent)}
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

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite agent">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Full name</Label>
            <Input
              placeholder="Sara Al-Balushi"
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email address</Label>
            <Input
              type="email"
              placeholder="agent@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Select value={inviteRole} onValueChange={v => setInviteRole(v as 'agent' | 'administrator')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="administrator">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full bg-brand-primary hover:bg-brand-primary/90"
            disabled={!inviteName || !inviteEmail || inviting}
            onClick={() => invite()}
          >
            <Mail size={14} className="me-1.5" />
            {inviting ? 'Sending…' : 'Send invite'}
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!editAgent} onClose={() => setEditAgent(null)} title={`Change role — ${editAgent?.name ?? ''}`}>
        <div className="space-y-4">
          <Select value={editRole} onValueChange={v => setEditRole(v as 'agent' | 'administrator')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="administrator">Administrator</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="w-full bg-brand-primary hover:bg-brand-primary/90"
            disabled={savingRole}
            onClick={() => saveRole()}
          >
            {savingRole ? 'Saving…' : 'Save role'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Remove ${deleteTarget?.name}?`}
        description="This agent will be removed from your account. Their conversations will remain."
        isPending={deleting}
        onConfirm={() => removeAgent()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
