'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  listAgents,
  getTeamAgents,
  updateTeamAgents,
  type Team,
  type Agent,
} from '@/lib/api/settings';
import {
  DEMO_TEAMS,
  DEMO_AGENTS,
  DEMO_TEAM_MEMBERS,
  settingsDemoDelay,
} from '@/lib/demo/settingsFixture';
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
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/utils/cn';
import { Users, Pencil, Trash2, Search, Check } from 'lucide-react';

export function TeamsSection() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const canManage = can(role, 'manageTeam');

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_TEAMS;
      try {
        const list = await listTeams();
        return list.length ? list : DEMO_TEAMS;
      } catch {
        return DEMO_TEAMS;
      }
    },
  });

  const { data: allAgents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_AGENTS;
      try {
        return await listAgents();
      } catch {
        return DEMO_AGENTS;
      }
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: async () => {
      const payload = { name: newName, description: newDesc };
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return { id: Date.now(), ...payload, agents_count: 0 };
      }
      return createTeam(payload);
    },
    onSuccess: team => {
      qc.setQueryData<Team[]>(['teams'], prev => [...(prev ?? []), team]);
      toast.success('Team created');
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<Set<number>>(new Set());
  const [agentSearch, setAgentSearch] = useState('');

  const { data: teamMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['team-members', editTeam?.id],
    enabled: editTeam !== null,
    queryFn: async () => {
      if (!editTeam) return [];
      if (isDemoDataEnabled()) {
        const ids = DEMO_TEAM_MEMBERS[editTeam.id] ?? [];
        return DEMO_AGENTS.filter(a => ids.includes(a.id));
      }
      return getTeamAgents(editTeam.id);
    },
  });

  useEffect(() => {
    if (!editTeam) return;
    setEditName(editTeam.name);
    setEditDesc(editTeam.description ?? '');
  }, [editTeam]);

  useEffect(() => {
    setSelectedAgents(new Set(teamMembers.map(m => m.id)));
  }, [teamMembers]);

  const { mutate: saveTeam, isPending: saving } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        DEMO_TEAM_MEMBERS[editTeam!.id] = Array.from(selectedAgents);
        return;
      }
      await updateTeam(editTeam!.id, { name: editName, description: editDesc });
      await updateTeamAgents(editTeam!.id, Array.from(selectedAgents));
    },
    onSuccess: () => {
      qc.setQueryData<Team[]>(['teams'], prev =>
        (prev ?? []).map(t =>
          t.id === editTeam?.id
            ? { ...t, name: editName, description: editDesc, agents_count: selectedAgents.size }
            : t,
        ),
      );
      toast.success('Team updated');
      setEditTeam(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  const { mutate: removeTeam, isPending: deleting } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return;
      }
      await deleteTeam(deleteTarget!.id);
    },
    onSuccess: () => {
      qc.setQueryData<Team[]>(['teams'], prev => (prev ?? []).filter(t => t.id !== deleteTarget?.id));
      toast.success('Team deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredAgents = allAgents.filter(
    a =>
      a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
      a.email.toLowerCase().includes(agentSearch.toLowerCase()),
  );

  function toggleAgent(id: number) {
    setSelectedAgents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Teams"
        description="Organize agents into teams for routing and reporting."
        actionLabel="New team"
        onAction={() => setCreateOpen(true)}
        canAction={canManage}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams yet"
          description="Create teams to group agents for assignment rules."
          actionLabel="New team"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Team</th>
                <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Agents</th>
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {teams.map(team => (
                <tr key={team.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">{team.name}</p>
                    {team.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{team.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{team.agents_count ?? 0}</td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8"
                          aria-label="Edit team"
                          onClick={() => setEditTeam(team)}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-destructive hover:bg-destructive/10"
                          aria-label="Delete team"
                          onClick={() => setDeleteTarget(team)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="New team">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Support" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} />
          </div>
          <Button
            className="w-full bg-brand-primary hover:bg-brand-primary/90"
            disabled={!newName || creating}
            onClick={() => create()}
          >
            {creating ? 'Creating…' : 'Create team'}
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!editTeam} onClose={() => setEditTeam(null)} title={`Edit team — ${editTeam?.name ?? ''}`}>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={editName} onChange={e => setEditName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Team members</Label>
            <div className="relative">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="ps-9"
                placeholder="Search agents…"
                value={agentSearch}
                onChange={e => setAgentSearch(e.target.value)}
                aria-label="Search agents"
              />
            </div>
            {loadingMembers ? (
              <Skeleton className="h-24" />
            ) : (
              <ul className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {filteredAgents.map(agent => {
                  const on = selectedAgents.has(agent.id);
                  return (
                    <li key={agent.id}>
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40 text-start"
                        onClick={() => toggleAgent(agent.id)}
                      >
                        <span
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                            on ? 'bg-brand-primary border-brand-primary text-white' : 'border-gray-300',
                          )}
                        >
                          {on && <Check size={10} />}
                        </span>
                        <span className="flex-1">{agent.name}</span>
                        <span className="text-xs text-muted-foreground">{agent.email}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Button
            className="w-full bg-brand-primary hover:bg-brand-primary/90"
            disabled={!editName || saving}
            onClick={() => saveTeam()}
          >
            {saving ? 'Saving…' : 'Save team'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name}?`}
        description="Agents will not be removed from the account, only unlinked from this team."
        isPending={deleting}
        onConfirm={() => removeTeam()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
