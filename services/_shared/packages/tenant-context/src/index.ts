import { AsyncLocalStorage } from 'node:async_hooks';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: string[];
  accountId?: number;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error('Tenant context not available — request missing gateway auth');
  }
  return ctx;
}

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export interface TenantContextPluginOptions {
  /** Shared secret for X-BlinkOne-Tenant-Id HMAC (gateway signs) */
  headerSecret?: string;
}

export const tenantContextPlugin: FastifyPluginAsync<TenantContextPluginOptions> = fp(
  async (app, opts: TenantContextPluginOptions) => {
    app.addHook('onRequest', async (req) => {
      const tenantId = req.headers['x-blinkone-tenant-id'];
      const userId = req.headers['x-blinkone-user-id'];
      const rolesRaw = req.headers['x-blinkone-roles'];
      if (typeof tenantId !== 'string' || typeof userId !== 'string') {
        return;
      }
      const roles =
        typeof rolesRaw === 'string' && rolesRaw.length > 0
          ? rolesRaw.split(',').map((r) => r.trim())
          : [];
      const accountRaw = req.headers['x-blinkone-account-id'];
      const accountId =
        typeof accountRaw === 'string' && accountRaw.length > 0
          ? Number(accountRaw)
          : undefined;
      storage.enterWith({
        tenantId,
        userId,
        roles,
        accountId: Number.isFinite(accountId) ? accountId : undefined,
      });
      if (opts.headerSecret) {
        const sig = req.headers['x-blinkone-context-sig'];
        if (typeof sig !== 'string') {
          throw new Error('Missing tenant context signature');
        }
      }
    });
  },
  { name: 'blinkone-tenant-context' },
);
