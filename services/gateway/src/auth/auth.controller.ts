import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createLogger } from '@blinkone/logger';

const log = createLogger({ service: 'gateway-auth' });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

@Controller('auth')
export class AuthController {
  @Post('login')
  async login(@Body() body: unknown, @Req() req: FastifyRequest) {
    const { email, password } = loginSchema.parse(body);
    const chatwootUrl = (process.env.CHATWOOT_BASE_URL ?? 'http://chatwoot:3000').replace(/\/$/, '');

    const res = await fetch(`${chatwootUrl}/auth/sign_in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      log.warn({ email, status: res.status }, 'chatwoot login failed');
      throw new UnauthorizedException('Invalid credentials');
    }

    const data = (await res.json()) as {
      data?: { id?: number; account_id?: number; role?: string };
    };
    const user = data.data;
    if (!user?.id) throw new UnauthorizedException('Invalid session payload');

    let tenantId = String(user.account_id ?? user.id);
    let branding: Record<string, unknown> | undefined;
    const host = (req.headers.host as string) || '';
    const resolved = await resolveHostForLogin(host);
    if (resolved?.tenantId) {
      tenantId = resolved.tenantId;
      branding = resolved.branding;
    }

    const roles = mapChatwootRoles(user.role);
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    const token = jwt.sign(
      {
        sub: String(user.id),
        tenant_id: tenantId,
        roles,
        account_id: user.account_id,
        ...(branding ? { branding } : {}),
      },
      secret,
      { expiresIn: '12h', issuer: 'blinkone-gateway' },
    );

    return {
      data: {
        access_token: token,
        token_type: 'Bearer',
        tenant_id: tenantId,
        user_id: String(user.id),
        roles,
        branding,
        request_id: req.id,
      },
    };
  }
}

async function resolveHostForLogin(host: string) {
  const h = host.toLowerCase().split(':')[0].trim();
  if (!h || h === 'localhost') return null;
  const base = (process.env.TENANT_UPSTREAM ?? 'http://tenant:8802').replace(/\/$/, '');
  const token = (process.env.TENANT_TOKEN ?? process.env.PLATFORM_TOKEN ?? '').trim();
  try {
    const res = await fetch(`${base}/v1/resolve-host?host=${encodeURIComponent(h)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { tenantId: string; branding?: Record<string, unknown> } };
    return json.data ?? null;
  } catch {
    return null;
  }
}

function mapChatwootRoles(role?: string): string[] {
  if (role === 'administrator') return ['admin'];
  if (role === 'supervisor') return ['supervisor'];
  if (role === 'agent') return ['agent'];
  return ['viewer'];
}

export function signTenantHeaders(payload: jwt.JwtPayload): Record<string, string> {
  const tenantId = String(payload.tenant_id ?? '');
  const userId = String(payload.sub ?? '');
  const roles = Array.isArray(payload.roles) ? payload.roles.join(',') : '';
  const secret = process.env.JWT_SECRET ?? '';
  const sig = createHmac('sha256', secret)
    .update(`${tenantId}:${userId}:${roles}`)
    .digest('hex');
  return {
    'x-blinkone-tenant-id': tenantId,
    'x-blinkone-user-id': userId,
    'x-blinkone-roles': roles,
    'x-blinkone-context-sig': sig,
    ...(payload.account_id ? { 'x-blinkone-account-id': String(payload.account_id) } : {}),
  };
}
