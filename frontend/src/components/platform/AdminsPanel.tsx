'use client';

/**
 * AdminsPanel — P1 Platform Admin
 * List + invite + remove platform admin users.
 */

import { useState } from 'react';
import { Loader2, Mail, Plus, Trash2, ShieldCheck, Eye } from 'lucide-react';
import { useAdmins, useCreateAdmin, useDeleteAdmin } from '@/lib/hooks/usePlatform';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { PlatformAdmin } from '@/lib/api/platform';

const ROLE_CHIP: Record<PlatformAdmin['role'], string> = {
  platform_admin:  'bg-blue-50 text-blue-700 border border-blue-200',
  platform_viewer: 'bg-gray-50 text-gray-600 border border-gray-200',
};

const STATUS_CHIP: Record<PlatformAdmin['status'], string> = {
  active:  'bg-green-50 text-green-700',
  invited: 'bg-amber-50 text-amber-700',
};

function InviteForm({ onClose }: { onClose: () => void }) {
  const create = useCreateAdmin();
  const [email, setEmail]   = useState('');
  const [name, setName]     = useState('');
  const [role, setRole]     = useState<PlatformAdmin['role']>('platform_admin');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    create.mutate(
      { email: email.trim(), name: name.trim() || undefined, role },
      { onSuccess: onClose },
    );
  };

  return (
    <form onSubmit={submit} className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-blue-900">Invite platform admin</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Email *</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@company.com"
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Display name"
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value as PlatformAdmin['role'])}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="platform_admin">Platform admin</option>
            <option value="platform_viewer">Viewer (read-only)</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
          Send invite
        </Button>
      </div>
    </form>
  );
}

function AdminRow({ admin }: { admin: PlatformAdmin }) {
  const del = useDeleteAdmin();
  const configured = admin.source === 'configured' || admin.id.startsWith('env-');
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
          {admin.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{admin.name}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Mail size={10} />
            {admin.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1', ROLE_CHIP[admin.role])}>
          {admin.role === 'platform_admin' ? <ShieldCheck size={10} /> : <Eye size={10} />}
          {admin.role === 'platform_admin' ? 'Admin' : 'Viewer'}
        </span>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_CHIP[admin.status])}>
          {admin.status}
        </span>
        <button
          type="button"
          onClick={() => del.mutate(admin.id)}
          disabled={del.isPending || configured}
          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          title={configured ? 'Configured in PLATFORM_ADMIN_EMAILS' : 'Remove admin'}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function AdminsPanel() {
  const { data, isLoading } = useAdmins();
  const admins = Array.isArray(data) ? data : [];
  const [inviting, setInviting] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Platform administrators</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage who has access to the platform admin panel. Server-configured emails (PLATFORM_ADMIN_EMAILS) appear as active.
          </p>
        </div>
        <Button size="sm" onClick={() => setInviting(true)} disabled={inviting}>
          <Plus size={14} className="mr-1" />
          Invite admin
        </Button>
      </div>

      {inviting && <InviteForm onClose={() => setInviting(false)} />}

      <div className="bg-white border border-gray-200 rounded-lg px-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-gray-400" size={22} />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No admins found.</p>
        ) : (
          admins.map(a => <AdminRow key={a.id} admin={a} />)
        )}
      </div>
    </div>
  );
}
