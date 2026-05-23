import { All, Controller, Req, Res } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ProxyService } from './proxy.service.js';

@Controller()
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All(['routing/*', 'sla/*', 'ivr/*', 'billing/*', 'ai/*', 'integration/*', 'platform/*', 'tenant/*', 'calls/*', 'whatsapp-calls/*'])
  handle(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const route = this.proxy.match(path);
    if (!route) {
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Unknown sidecar route' } });
      return;
    }
    const raw = reply.raw;
    this.proxy.forward(req.raw, raw, route, req.headers.authorization as string | undefined);
  }
}
