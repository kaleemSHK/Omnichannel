import { Injectable, NestMiddleware } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { HostResolverService } from './host-resolver.service.js';

@Injectable()
export class HostMiddleware implements NestMiddleware {
  constructor(private readonly resolver: HostResolverService) {}

  async use(req: FastifyRequest, _reply: FastifyReply, next: () => void) {
    const host = (req.headers.host as string) || '';
    const resolved = await this.resolver.resolve(host);
    if (resolved) {
      req.headers['x-blinkone-tenant-id'] = resolved.tenantId;
      req.headers['x-blinkone-resolved-host'] = host;
      if (resolved.branding) {
        req.headers['x-blinkone-branding'] = JSON.stringify(resolved.branding);
      }
    }
    next();
  }
}
