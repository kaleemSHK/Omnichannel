'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createRole,
  deleteRole,
  fetchRbacCatalog,
  getRole,
  listRoles,
  updateRole,
  type RbacModule,
  type RbacPage,
  type TenantRole,
} from '@/lib/api/rbac';
import { can, canPermission } from '@/lib/rbac';
import { useAuthStore } from '@/lib/store/auth';
import { cn } from '@/lib/utils/cn';

const ROLE_TYPES = [
  { value: 'agent', label: 'Agent' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'manager', label: 'Manager' },
  { value: 'custom', label: 'Custom' },
];

type EditorState = {
  id?: string;
  name: string;
  description: string;
  roleType: string;
  status: 'active' | 'inactive';
  permissions: Record<string, boolean>;
  pages: Record<string, boolean>;
  isSystem?: boolean;
};

function emptyEditor(): EditorState {
  return {
    name: '',
    description: '',
    roleType: 'custom',
    status: 'active',
    permissions: {},
    pages: {},
  };
}

export function RolesSection() {
  const role = useAuthStore(s => s.user?.role);
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [catalog, setCatalog] = useState<{ modules: RbacModule[]; pages: RbacPage[] } | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManage =
    canPermission('roles.view', role) ||
    canPermission('roles.edit', role) ||
    can(role, 'manageTeam');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([listRoles(), fetchRbacCatalog()]);
      setRoles(r);
      setCatalog(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const moduleRows = useMemo(() => catalog?.modules ?? [], [catalog]);

  async function openRole(role: TenantRole) {
    try {
      const full = await getRole(role.id);
      setEditor({
        id: full.id,
        name: full.name,
        description: full.description ?? '',
        roleType: full.role_type,
        status: full.status as 'active' | 'inactive',
        permissions: full.permissions ?? {},
        pages: full.pages ?? {},
        isSystem: full.is_system,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load role');
    }
  }

  async function handleSave() {
    if (!editor?.name.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSaving(true);
    try {
      if (editor.id) {
        await updateRole(editor.id, {
          name: editor.name,
          description: editor.description,
          roleType: editor.roleType,
          status: editor.status,
          permissions: editor.permissions,
          pages: editor.pages,
        });
        toast.success('Role updated');
      } else {
        await createRole({
          name: editor.name,
          description: editor.description,
          roleType: editor.roleType,
          status: editor.status,
          permissions: editor.permissions,
          pages: editor.pages,
        });
        toast.success('Role created');
      }
      setEditor(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this role? Users assigned to it will lose those permissions.')) return;
    try {
      await deleteRole(id);
      toast.success('Role deleted');
      if (editor?.id === id) setEditor(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  if (!canManage) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>You don&apos;t have permission to manage roles.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-72 border-e shrink-0 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Roles</h1>
            <p className="text-xs text-muted-foreground">Dynamic permission sets</p>
          </div>
          <button
            type="button"
            className="p-2 rounded-lg bg-brand-primary text-white hover:opacity-90"
            onClick={() => setEditor(emptyEditor())}
            aria-label="New role"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading && <p className="text-sm text-muted-foreground p-2">Loading…</p>}
          {!loading &&
            roles.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => void openRole(r)}
                className={cn(
                  'w-full text-start px-3 py-2 rounded-lg text-sm hover:bg-muted',
                  editor?.id === r.id && 'bg-muted font-medium',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{r.name}</span>
                  {r.is_system && (
                    <span className="text-[10px] uppercase text-muted-foreground">System</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground capitalize">{r.role_type}</p>
              </button>
            ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!editor ? (
          <div className="text-center text-muted-foreground py-16">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Select a role or create a new one to edit permissions.</p>
          </div>
        ) : (
          <div className="max-w-4xl space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Role Name</label>
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={editor.name}
                  onChange={e => setEditor({ ...editor, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Role Type</label>
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={editor.roleType}
                  onChange={e => setEditor({ ...editor, roleType: e.target.value })}
                >
                  {ROLE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[72px]"
                  value={editor.description}
                  onChange={e => setEditor({ ...editor, description: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={editor.status}
                  onChange={e =>
                    setEditor({ ...editor, status: e.target.value as 'active' | 'inactive' })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <section>
              <h2 className="text-sm font-semibold mb-3">Permission Matrix</h2>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-start px-4 py-2 font-medium">Module</th>
                      <th className="px-2 py-2 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moduleRows.map(mod => (
                      <tr key={mod.key} className="border-t">
                        <td className="px-4 py-3 font-medium align-top">{mod.label}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-3">
                            {(mod.actions ?? []).map(a => {
                              const key = `${mod.key}.${a.key}`;
                              return (
                                <label key={key} className="inline-flex items-center gap-1.5 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(editor.permissions[key])}
                                    onChange={ev =>
                                      setEditor({
                                        ...editor,
                                        permissions: {
                                          ...editor.permissions,
                                          [key]: ev.target.checked,
                                        },
                                      })
                                    }
                                  />
                                  {a.label}
                                </label>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold mb-3">Page Visibility</h2>
              <div className="grid grid-cols-2 gap-2">
                {(catalog?.pages ?? []).map(p => (
                  <label
                    key={p.key}
                    className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={editor.pages[p.key] !== false}
                      onChange={ev =>
                        setEditor({
                          ...editor,
                          pages: { ...editor.pages, [p.key]: ev.target.checked },
                        })
                      }
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </section>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium disabled:opacity-60"
              >
                {saving ? 'Saving…' : editor.id ? 'Save Role' : 'Create Role'}
              </button>
              {editor.id && !editor.isSystem && (
                <button
                  type="button"
                  onClick={() => void handleDelete(editor.id!)}
                  className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm inline-flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="px-4 py-2 rounded-lg border text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
