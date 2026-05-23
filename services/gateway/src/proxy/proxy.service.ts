import { Injectable } from '@nestjs/common';
import proxy from 'http-proxy';
import type { ServerResponse } from 'node:http';
import type { IncomingMessage } from 'node:http';
import jwt from 'jsonwebtoken';
import { signTenantHeaders } from '../auth/auth.controller.js';
import { requirePermission } from '@blinkone/rbac';
import { runWithLogContext } from '@blinkone/logger';
import { runWithTenantContext } from '@blinkone/tenant-context';

export interface UpstreamRoute {
  prefix: string;
  target: string;
  permission?: string;
  stripPrefix?: string;
  rewriteTo?: string;
}

@Injectable()
export class ProxyService {
  private readonly proxy = proxy.createProxyServer({ changeOrigin: true, ws: true });

  readonly routes: UpstreamRoute[] = [
    { prefix: '/routing', target: process.env.ROUTING_UPSTREAM ?? 'http://routing:8798', permission: 'routing:read', stripPrefix: '/routing' },
    { prefix: '/sla', target: process.env.SLA_UPSTREAM ?? 'http://sla:8796', permission: 'sla:read', stripPrefix: '/sla' },
    { prefix: '/escalation', target: process.env.ESCALATION_UPSTREAM ?? 'http://escalation:8797', permission: 'escalation:read', stripPrefix: '/escalation' },
    { prefix: '/ivr', target: process.env.IVR_UPSTREAM ?? 'http://ivr:8795', permission: 'routing:read', stripPrefix: '/ivr' },
    { prefix: '/billing', target: process.env.BILLING_UPSTREAM ?? 'http://billing:8794', permission: 'billing:read', stripPrefix: '/billing' },
    { prefix: '/ai', target: process.env.AI_UPSTREAM ?? 'http://ai:8793', permission: 'ai:read', stripPrefix: '/ai' },
    { prefix: '/integration', target: process.env.INTEGRATION_UPSTREAM ?? 'http://integration:8800', permission: 'integration:read', stripPrefix: '/integration' },
    { prefix: '/platform', target: process.env.PLATFORM_UPSTREAM ?? 'http://platform:8790', permission: 'branding:read', stripPrefix: '/platform', rewriteTo: '/v1' },
    { prefix: '/tenant', target: process.env.TENANT_UPSTREAM ?? 'http://tenant:8802', permission: 'tenant:read', stripPrefix: '/tenant' },
    { prefix: '/calls', target: process.env.CALLS_UPSTREAM ?? 'http://calls:8792', permission: 'calls:read', stripPrefix: '/calls' },
    { prefix: '/whatsapp-calls', target: process.env.WHATSAPP_CALLS_UPSTREAM ?? 'http://whatsapp-calls:8803', permission: 'calls:read', stripPrefix: '/whatsapp-calls' },
  ];

  match(path: string): UpstreamRoute | undefined {
    return this.routes.find((r) => path.startsWith(r.prefix));
  }

  forward(
    req: IncomingMessage,
    res: ServerResponse,
    route: UpstreamRoute,
    authHeader?: string,
  ): void {
    const correlationId = (req.headers['x-request-id'] as string) ?? randomId();
    const headers = { ...req.headers };

    const proxyRequest = () => {
      const strip = route.stripPrefix ?? route.prefix;
      const url = req.url ?? '/';
      const rest = url.replace(new RegExp(`^${strip}`), '') || '/';
      req.url = route.rewriteTo ? `${route.rewriteTo}${rest}` : rest;
      const proxyHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === 'string') proxyHeaders[k] = v;
      }
      this.proxy.web(req, res, { target: route.target, headers: proxyHeaders }, (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 'BAD_GATEWAY', message: err?.message ?? 'Upstream error' } }));
        }
      });
    };

    if (!authHeader?.startsWith('Bearer ')) {
      runWithLogContext({ correlationId }, proxyRequest);
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'CONFIG_ERROR', message: 'JWT_SECRET missing' } }));
      return;
    }

    const bearer = authHeader.slice(7);
    const serviceToken = serviceTokenForRoute(route.prefix);
    if (serviceToken && bearer === serviceToken) {
      runWithLogContext({ correlationId }, proxyRequest);
      return;
    }

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(bearer, secret) as jwt.JwtPayload;
    } catch {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }));
      return;
    }

    Object.assign(headers, signTenantHeaders(payload));
    const headerTenant = headers['x-blinkone-tenant-id'];
    const jwtTenant = String(payload.tenant_id ?? '');
    if (
      typeof headerTenant === 'string' &&
      headerTenant &&
      jwtTenant &&
      headerTenant !== jwtTenant &&
      !(payload.roles as string[])?.includes('platform_admin')
    ) {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Cross-tenant access denied' } }));
      return;
    }

    const tenantCtx = {
      tenantId: typeof headerTenant === 'string' && headerTenant ? headerTenant : jwtTenant,
      userId: String(payload.sub),
      roles: (payload.roles as string[]) ?? [],
      accountId: payload.account_id as number | undefined,
    };

    const method = (req.method ?? 'GET').toUpperCase();
    const urlPath = (req.url ?? '/').split('?')[0] ?? '/';
    const permission = resolvePermission(route, method, urlPath);

    runWithLogContext({ correlationId, tenantId: tenantCtx.tenantId, userId: tenantCtx.userId }, () => {
      runWithTenantContext(tenantCtx, () => {
        try {
          if (permission) requirePermission(permission);
          proxyRequest();
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Forbidden';
          if (!res.headersSent) {
            res.writeHead(403, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: { code: 'FORBIDDEN', message: msg } }));
          }
        }
      });
    });
  }
}

function resolvePermission(route: UpstreamRoute, method: string, urlPath: string): string | undefined {
  const read = method === 'GET' || method === 'HEAD';
  if (route.prefix === '/integration') {
    if (urlPath.includes('/sso/login') || urlPath.includes('/sso/callback')) return undefined;
    if (urlPath.includes('/sso')) return read ? 'sso:read' : 'sso:write';
    if (urlPath.includes('/audit')) return read ? 'audit:read' : 'audit:write';
    return read ? 'integration:read' : 'integration:write';
  }
  if (route.prefix === '/ai') return read ? 'ai:read' : 'ai:write';
  if (route.prefix === '/escalation') return read ? 'escalation:read' : 'escalation:write';
  if (route.prefix === '/sla') return read ? 'sla:read' : 'sla:write';
  if (route.prefix === '/billing') return read ? 'billing:read' : 'billing:write';
  if (route.prefix === '/routing' || route.prefix === '/ivr') return read ? 'routing:read' : 'routing:write';
  if (route.prefix === '/tenant') return read ? 'tenant:read' : 'tenant:write';
  if (route.prefix === '/calls' || route.prefix === '/whatsapp-calls') return read ? 'calls:read' : 'calls:write';
  if (route.prefix === '/platform') return read ? 'branding:read' : 'branding:write';
  return route.permission;
}

function randomId(): string {
  return crypto.randomUUID();
}

function serviceTokenForRoute(prefix: string): string | undefined {
  const map: Record<string, string | undefined> = {
    '/routing': process.env.ROUTING_TOKEN,
    '/sla': process.env.SLA_TOKEN,
    '/ivr': process.env.IVR_TOKEN,
    '/escalation': process.env.ESCALATION_TOKEN,
    '/billing': process.env.BILLING_TOKEN,
    '/ai': process.env.AI_TOKEN,
    '/integration': process.env.INTEGRATION_TOKEN,
    '/tenant': process.env.TENANT_TOKEN ?? process.env.PLATFORM_TOKEN,
    '/calls': process.env.CALLS_TOKEN,
    '/whatsapp-calls': process.env.WHATSAPP_CALLS_TOKEN,
  };
  return map[prefix]?.trim() || undefined;
}
