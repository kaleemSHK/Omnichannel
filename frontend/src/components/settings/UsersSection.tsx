'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Trash2, Users } from 'lucide-react';
import { listTeams, type Team } from '@/lib/api/settings';
import {
  deleteRbacUser,
  getUserSeats,
  inviteRbacUser,
  listRoles,
  listRbacUsers,
  upsertRbacUser,
  type TenantRole,
  type TenantUserAssignment,
  type UserSeatStatus,
} from '@/lib/api/rbac';
import { can, canPermission } from '@/lib/rbac';
import { useAuthStore } from '@/lib/store/auth';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { SectionHeader } from './shared/SectionHeader';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  department: string;
  team: string;
  supervisorUserId: string;
  status: 'active' | 'inactive' | 'suspended';
  roleIds: string[];
};

function emptyForm(): FormState {
  return {
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    department: '',
    team: '',
    supervisorUserId: '',
    status: 'active',
    roleIds: [],
  };
}

function generatePassword(): string {
  return `BlinkOne-${Math.random().toString(36).slice(2, 10)}!A1`;
}

export function UsersSection() {
  const role = useAuthStore(s => s.user?.role);
  const currentUserId = useAuthStore(s => s.user?.id);
  const [users, setUsers] = useState<TenantUserAssignment[]>([]);
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [seats, setSeats] = useState<UserSeatStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const canManage =
    canPermission('users.view', role) ||
    canPermission('users.edit', role) ||
    can(role, 'manageTeam');

  const canDelete =
    canPermission('users.delete', role) ||
    canPermission('users.edit', role) ||
    can(role, 'manageTeam');

  const isSelf = editingUserId != null && currentUserId === editingUserId;

  const load = useCallback(async () => {
    if (isDemoDataEnabled()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [u, r, t, seatInfo] = await Promise.all([
        listRbacUsers(),
        listRoles(),
        listTeams(),
        getUserSeats().catch(() => null),
      ]);
      setUsers(u);
      setRoles(r.filter(x => x.status === 'active'));
      setTeams(t);
      setSeats(seatInfo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const supervisors = useMemo(
    () => users.filter(u => u.roles?.some(r => ['supervisor', 'manager', 'tenant_admin'].includes(r.roleType))),
    [users],
  );

  const seatLabel = useMemo(() => {
    if (seats?.limit) {
      return `${seats.used} / ${seats.limit} users${seats.planName ? ` (${seats.planName})` : ''}`;
    }
    if (seats) return `${seats.used} user${seats.used === 1 ? '' : 's'} (unlimited — no plan cap)`;
    return null;
  }, [seats]);

  function openCreate() {
    if (seats?.atLimit) {
      toast.error(`User limit reached (${seats.used}/${seats.limit}). Upgrade your plan to add more users.`);
      return;
    }
    setEditingRecordId(null);
    setEditingUserId(null);
    const agentRole = roles.find(r => r.role_type === 'agent');
    const pwd = generatePassword();
    setForm({
      ...emptyForm(),
      roleIds: agentRole ? [agentRole.id] : [],
      password: pwd,
      confirmPassword: pwd,
    });
    setShowPassword(true);
    setSheetOpen(true);
  }

  function openEdit(row: TenantUserAssignment) {
    setEditingRecordId(row.id);
    setEditingUserId(row.chatwoot_user_id);
    setForm({
      fullName: row.full_name ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      password: '',
      confirmPassword: '',
      department: row.department ?? '',
      team: row.team ?? '',
      supervisorUserId: row.supervisor_user_id ? String(row.supervisor_user_id) : '',
      status: (row.status as FormState['status']) || 'active',
      roleIds: (row.roles ?? []).map(r => r.id),
    });
    setSheetOpen(true);
  }

  function toggleRole(roleId: string) {
    setForm(f => ({
      ...f,
      roleIds: f.roleIds.includes(roleId)
        ? f.roleIds.filter(id => id !== roleId)
        : [...f.roleIds, roleId],
    }));
  }

  function applyGeneratedPassword() {
    const pwd = generatePassword();
    setForm(f => ({ ...f, password: pwd, confirmPassword: pwd }));
    setShowPassword(true);
  }

  async function handleSave() {
    if (!form.roleIds.length) {
      toast.error('Assign at least one role');
      return;
    }

    const isNew = editingUserId == null;

    if (isNew) {
      if (form.password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      if (form.password !== form.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    setSaving(true);
    try {
      const isAdmin = form.roleIds.some(
        id => roles.find(r => r.id === id)?.role_type === 'tenant_admin',
      );
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        department: form.department.trim() || undefined,
        team: form.team.trim() || undefined,
        supervisorUserId: form.supervisorUserId ? Number(form.supervisorUserId) : undefined,
        status: form.status,
        roleIds: form.roleIds,
        chatwootRole: (isAdmin ? 'administrator' : 'agent') as 'agent' | 'administrator',
      };

      if (isNew) {
        await inviteRbacUser({
          ...payload,
          password: form.password,
        });
        toast.success(`User created. Login: ${form.email.trim()}`, { duration: 10000 });
      } else {
        await upsertRbacUser({
          chatwootUserId: editingUserId!,
          ...payload,
        });
        toast.success('User updated');
      }

      setSheetOpen(false);
      setEditingRecordId(null);
      setEditingUserId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingRecordId) return;
    setDeleting(true);
    try {
      await deleteRbacUser(editingRecordId);
      toast.success('User deleted');
      setDeleteOpen(false);
      setSheetOpen(false);
      setEditingRecordId(null);
      setEditingUserId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  if (!canManage) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>You don&apos;t have permission to manage users.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <SectionHeader
        title="Users & Access"
        description={
          seatLabel
            ? `Assign departments, teams, supervisors, and roles. Plan allowance: ${seatLabel}.`
            : 'Assign departments, teams, supervisors, and multiple roles per user.'
        }
        actionLabel="Add user"
        onAction={openCreate}
      />

      {seats?.atLimit && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          User limit reached ({seats.used}/{seats.limit}). Contact your platform admin to upgrade the plan or
          deactivate an existing user.
        </div>
      )}

      <div className="mt-6 border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No RBAC user assignments yet. Add users here — they log in with email and password.
                </td>
              </tr>
            )}
            {!loading &&
              users.map(u => (
                <tr
                  key={u.id}
                  className="border-t hover:bg-muted/20 cursor-pointer"
                  onClick={() => openEdit(u)}
                >
                  <td className="px-4 py-3 font-medium">{u.full_name || `User #${u.chatwoot_user_id}`}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email || '—'}</td>
                  <td className="px-4 py-3">{u.department || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles ?? []).map(r => (
                        <Badge key={r.id} variant="secondary" className="text-[10px]">
                          {r.name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">{u.status}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setEditingRecordId(null);
          setEditingUserId(null);
        }}
        title={editingUserId != null ? 'Edit user assignment' : 'Add user'}
      >
        <div className="space-y-4 p-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Full name</Label>
              <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                disabled={editingUserId != null}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            {editingUserId != null && (
              <div>
                <Label>Chatwoot user ID</Label>
                <Input value={String(editingUserId)} disabled className="bg-muted/40" />
              </div>
            )}
            {editingUserId == null && (
              <>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label>Password</Label>
                    <button
                      type="button"
                      className="text-[11px] text-brand-primary hover:underline"
                      onClick={applyGeneratedPassword}
                    >
                      Generate
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      autoComplete="new-password"
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label>Confirm password</Label>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
              </>
            )}
            <div>
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })}
              />
            </div>
            <div>
              <Label>Team</Label>
              <select
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={form.team}
                onChange={e => setForm({ ...form, team: e.target.value })}
              >
                <option value="">— Select team —</option>
                {teams.map(t => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
                {form.team && !teams.some(t => t.name === form.team) && (
                  <option value={form.team}>{form.team}</option>
                )}
              </select>
              {teams.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  No teams yet — create teams under Settings → Teams first.
                </p>
              )}
            </div>
            <div>
              <Label>Reporting supervisor</Label>
              <select
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                value={form.supervisorUserId}
                onChange={e => setForm({ ...form, supervisorUserId: e.target.value })}
              >
                <option value="">— None —</option>
                {supervisors.map(s => (
                  <option key={s.id} value={String(s.chatwoot_user_id)}>
                    {s.full_name || s.email || s.chatwoot_user_id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                value={form.status}
                onChange={e =>
                  setForm({ ...form, status: e.target.value as FormState['status'] })
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">
              Assign roles (required — at least one)
            </Label>
            {!form.roleIds.length && (
              <p className="text-xs text-destructive mb-2">Select at least one role to save.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {roles.map(r => (
                <label
                  key={r.id}
                  className={cn(
                    'flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer',
                    form.roleIds.includes(r.id) && 'border-brand-primary bg-brand-primary/5',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={form.roleIds.includes(r.id)}
                    onChange={() => toggleRole(r.id)}
                  />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => void handleSave()} disabled={saving || !form.roleIds.length}>
              {saving ? 'Saving…' : editingUserId != null ? 'Save changes' : 'Create user'}
            </Button>
            {editingRecordId && canDelete && !isSelf && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4 me-1" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${form.fullName || form.email || 'user'}?`}
        description="Removes this user from BlinkOne and their Chatwoot account access. This cannot be undone."
        confirmLabel="Delete user"
        isPending={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
