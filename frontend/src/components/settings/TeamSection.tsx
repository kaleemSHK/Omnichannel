'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAgents } from '@/lib/api/routing';
import { DEMO_AGENTS } from '@/lib/demo/callingFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-radix';
import { UserPlus, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import type { AgentState, RoutingAgent } from '@/types';

const STATE_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  busy: 'bg-amber-500',
  offline: 'bg-gray-400',
};

function mapAgent(agent: RoutingAgent) {
  const statusMap: Record<AgentState, string> = {
    available: 'online',
    busy: 'busy',
    break: 'busy',
    offline: 'offline',
    acw: 'busy',
  };
  return {
    id: agent.id,
    name: agent.name,
    email: `${agent.agentId}@labbik.om`,
    role: agent.skills[0] ?? 'agent',
    availability_status: statusMap[agent.state] ?? 'offline',
  };
}

export function TeamSection() {
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents', 'settings'],
    queryFn: async () => {
      try {
        const data = await listAgents();
        return data.length ? data : isDemoDataEnabled() ? DEMO_AGENTS : [];
      } catch {
        return isDemoDataEnabled() ? DEMO_AGENTS : [];
      }
    },
  });

  const rows = agents.map(mapAgent);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('agent');
  const [inviting, setInviting] = useState(false);

  async function handleInvite() {
    if (!inviteEmail) return;
    setInviting(true);
    await new Promise(r => setTimeout(r, 600));
    setInviting(false);
    setInviteEmail('');
    toast.success(`Invite sent to ${inviteEmail}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Team & Agents</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your agents and their roles.</p>
      </div>

      <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <UserPlus size={15} /> Invite agent
        </h2>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Email address</Label>
            <Input
              type="email"
              placeholder="agent@labbik.om"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="w-36 space-y-1">
            <Label className="text-xs">Role</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={handleInvite}
              disabled={!inviteEmail || inviting}
              className="bg-brand-primary hover:bg-brand-primary/90"
            >
              <Mail size={14} className="me-1.5" />
              {inviting ? 'Sending…' : 'Invite'}
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Agent</th>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Role</th>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [1, 2, 3].map(i => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              : rows.map(agent => (
                  <tr key={agent.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center shrink-0">
                          {agent.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{agent.role}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full',
                            STATE_COLORS[agent.availability_status] ?? 'bg-gray-400',
                          )}
                        />
                        <span className="text-xs capitalize">{agent.availability_status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
