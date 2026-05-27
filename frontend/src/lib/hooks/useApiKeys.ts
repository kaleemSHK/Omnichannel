'use client';

/**
 * React Query hooks for API key management — Sprint 3 G19.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listApiKeys,
  createApiKey,
  renameApiKey,
  revokeApiKey,
} from '@/lib/api/apiKeys';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';
import { DEMO_API_KEYS } from '@/lib/demo/apiKeysFixture';
import type { ApiKey, ApiKeyCreateResult, ApiKeyScope } from '@/lib/api/apiKeys';

const KEYS_KEY = ['api-keys'];

// ─── List ──────────────────────────────────────────────────────────────────────

export function useApiKeys() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery<ApiKey[]>({
    queryKey: KEYS_KEY,
    queryFn: async () => {
      if (isDemoDataEnabled() || !gwEnabled) return DEMO_API_KEYS;
      try { return await listApiKeys(); } catch { return DEMO_API_KEYS; }
    },
    staleTime: 30_000,
  });
}

// ─── Create ────────────────────────────────────────────────────────────────────

export function useCreateApiKey(onCreated: (result: ApiKeyCreateResult) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; scopes: ApiKeyScope[] }) => {
      if (isDemoDataEnabled()) {
        const key: ApiKey = {
          id: `key-${Date.now()}`,
          tenantId: '1',
          name: data.name,
          keyPrefix: 'bnk_demo1234',
          scopes: data.scopes,
          createdAt: new Date().toISOString(),
        };
        return {
          key,
          rawKey: 'bnk_demo1234xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        } satisfies ApiKeyCreateResult;
      }
      return createApiKey(data);
    },
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: KEYS_KEY });
      toast.success('API key created');
      onCreated(result);
    },
    onError: () => toast.error('Could not create API key'),
  });
}

// ─── Rename ────────────────────────────────────────────────────────────────────

export function useRenameApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (isDemoDataEnabled()) {
        return { id, name } as ApiKey;
      }
      return renameApiKey(id, name);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS_KEY });
      toast.success('API key renamed');
    },
    onError: () => toast.error('Could not rename API key'),
  });
}

// ─── Revoke ────────────────────────────────────────────────────────────────────

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isDemoDataEnabled()) await revokeApiKey(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS_KEY });
      toast.success('API key revoked');
    },
    onError: () => toast.error('Could not revoke API key'),
  });
}
