/**
 * Demo fixtures for Sprint 3 G19 — API key management.
 */

import type { ApiKey } from '@/lib/api/apiKeys';

export const DEMO_API_KEYS: ApiKey[] = [
  {
    id: 'key-001',
    tenantId: '1',
    name: 'CI / CD Pipeline',
    keyPrefix: 'bnk_a1b2c3d4',
    scopes: ['read', 'write'],
    createdAt: '2026-04-15T08:00:00Z',
  },
  {
    id: 'key-002',
    tenantId: '1',
    name: 'Analytics Export Bot',
    keyPrefix: 'bnk_e5f6g7h8',
    scopes: ['read'],
    createdAt: '2026-05-01T12:00:00Z',
  },
  {
    id: 'key-003',
    tenantId: '1',
    name: 'Internal Admin Script',
    keyPrefix: 'bnk_i9j0k1l2',
    scopes: ['read', 'write', 'admin'],
    createdAt: '2026-05-20T09:30:00Z',
  },
];
