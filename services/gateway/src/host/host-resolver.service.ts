import { Injectable } from '@nestjs/common';
import { createLogger } from '@blinkone/logger';

const log = createLogger({ service: 'gateway-host' });

export interface ResolvedHost {
  tenantId: string;
  slug: string;
  branding: Record<string, unknown>;
}

interface CacheEntry {
  data: ResolvedHost;
  exp: number;
}

@Injectable()
export class HostResolverService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = Number(process.env.HOST_RESOLVE_CACHE_MS ?? 60_000);
  private readonly tenantUrl = (process.env.TENANT_UPSTREAM ?? 'http://tenant:8802').replace(/\/$/, '');
  private readonly token = (process.env.TENANT_TOKEN ?? process.env.PLATFORM_TOKEN ?? '').trim();

  async resolve(hostname: string): Promise<ResolvedHost | null> {
    const host = hostname.toLowerCase().split(':')[0].trim();
    if (!host || host === 'localhost' || host === '127.0.0.1') return null;

    const cached = this.cache.get(host);
    if (cached && cached.exp > Date.now()) return cached.data;

    try {
      const res = await fetch(
        `${this.tenantUrl}/v1/resolve-host?host=${encodeURIComponent(host)}`,
        {
          headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: ResolvedHost };
      const data = json.data;
      if (!data?.tenantId) return null;
      this.cache.set(host, { data, exp: Date.now() + this.ttlMs });
      return data;
    } catch (e) {
      log.warn({ host, err: (e as Error).message }, 'host resolve failed');
      return null;
    }
  }
}
