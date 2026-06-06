import { bnFetch } from './client';

export interface RbacModule {
  key: string;
  label: string;
  sort_order: number;
  actions: { key: string; label: string }[];
}

export interface RbacPage {
  key: string;
  label: string;
  route: string;
  sort_order: number;
}

export interface TenantRole {
  id: string;
  name: string;
  description?: string;
  role_type: string;
  status: string;
  is_system: boolean;
  user_count?: number;
  permissions?: Record<string, boolean>;
  pages?: Record<string, boolean>;
}

export interface TenantUserAssignment {
  id: string;
  tenant_id: string;
  chatwoot_user_id: number;
  full_name?: string;
  email?: string;
  phone?: string;
  department?: string;
  team?: string;
  supervisor_user_id?: number;
  status: string;
  roles?: { id: string; name: string; roleType: string }[];
}

export interface UserSeatStatus {
  used: number;
  limit: number | null;
  remaining: number | null;
  planName: string | null;
  atLimit: boolean;
}

export async function getUserSeats(): Promise<UserSeatStatus> {
  const res = await bnFetch<{ data: UserSeatStatus }>('tenant', '/v1/rbac/users/seats');
  return res.data;
}

export async function listRbacUsers(): Promise<TenantUserAssignment[]> {
  const res = await bnFetch<{ data: TenantUserAssignment[] }>('tenant', '/v1/rbac/users');
  return res.data ?? [];
}

export async function upsertRbacUser(body: {
  chatwootUserId: number;
  fullName?: string;
  email?: string;
  phone?: string;
  department?: string;
  team?: string;
  supervisorUserId?: number;
  status?: string;
  roleIds?: string[];
}): Promise<TenantUserAssignment> {
  const res = await bnFetch<{ data: TenantUserAssignment }>('tenant', '/v1/rbac/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function inviteRbacUser(body: {
  fullName: string;
  email: string;
  password?: string;
  chatwootUserId?: number;
  phone?: string;
  department?: string;
  team?: string;
  supervisorUserId?: number;
  status?: string;
  roleIds?: string[];
  chatwootRole?: 'agent' | 'administrator';
}): Promise<TenantUserAssignment> {
  const res = await bnFetch<{ data: TenantUserAssignment }>('tenant', '/v1/rbac/users/invite', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function deleteRbacUser(id: string): Promise<void> {
  await bnFetch('tenant', `/v1/rbac/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchRbacCatalog(): Promise<{ modules: RbacModule[]; pages: RbacPage[] }> {
  const res = await bnFetch<{ data: { modules: RbacModule[]; pages: RbacPage[] } }>(
    'tenant',
    '/v1/rbac/catalog',
  );
  return res.data;
}

export async function listRoles(): Promise<TenantRole[]> {
  const res = await bnFetch<{ data: TenantRole[] }>('tenant', '/v1/rbac/roles');
  return res.data ?? [];
}

export async function getRole(id: string): Promise<TenantRole> {
  const res = await bnFetch<{ data: TenantRole }>('tenant', `/v1/rbac/roles/${encodeURIComponent(id)}`);
  return res.data;
}

export async function createRole(body: {
  name: string;
  description?: string;
  roleType?: string;
  status?: string;
  permissions?: Record<string, boolean>;
  pages?: Record<string, boolean>;
}): Promise<TenantRole> {
  const res = await bnFetch<{ data: TenantRole }>('tenant', '/v1/rbac/roles', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function updateRole(
  id: string,
  body: Partial<{
    name: string;
    description: string;
    roleType: string;
    status: string;
    permissions: Record<string, boolean>;
    pages: Record<string, boolean>;
  }>,
): Promise<TenantRole> {
  const res = await bnFetch<{ data: TenantRole }>('tenant', `/v1/rbac/roles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function deleteRole(id: string): Promise<void> {
  await bnFetch('tenant', `/v1/rbac/roles/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
