/**
 * BlinkOne API key management — Sprint 3 G19.
 * Routes through the gateway to the integration service.
 */

import { bnFetch } from './client';

const SVC = 'integrations';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiKeyScope = 'read' | 'write' | 'admin';

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;          // first 12 chars of the raw key (safe to display)
  scopes: ApiKeyScope[];
  createdAt: string;
}

/** Returned once on creation — rawKey is never stored and not re-fetchable. */
export interface ApiKeyCreateResult {
  key: ApiKey;
  rawKey: string;
}

// ─── Scope catalog ────────────────────────────────────────────────────────────

export const API_KEY_SCOPES: { value: ApiKeyScope; label: string; description: string }[] = [
  { value: 'read',  label: 'Read',  description: 'List resources, fetch data'         },
  { value: 'write', label: 'Write', description: 'Create and update resources'         },
  { value: 'admin', label: 'Admin', description: 'Delete, revoke, and manage settings' },
];

// ─── API functions ─────────────────────────────────────────────────────────────

export async function listApiKeys(): Promise<ApiKey[]> {
  return bnFetch<ApiKey[]>(SVC, '/v1/api-keys');
}

export async function createApiKey(data: {
  name: string;
  scopes: ApiKeyScope[];
}): Promise<ApiKeyCreateResult> {
  return bnFetch<ApiKeyCreateResult>(SVC, '/v1/api-keys', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function renameApiKey(id: string, name: string): Promise<ApiKey> {
  return bnFetch<ApiKey>(SVC, `/v1/api-keys/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function revokeApiKey(id: string): Promise<void> {
  await bnFetch<unknown>(SVC, `/v1/api-keys/${id}`, { method: 'DELETE' });
}
