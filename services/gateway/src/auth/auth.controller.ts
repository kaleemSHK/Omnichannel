import { Body, Controller, Get, Post, Req, UnauthorizedException, HttpException } from '@nestjs/common';
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

// ─── D91: Login attempt tracking + account lockout ────────────────────────────
// In-memory store (replace with Redis for HA deployments).
interface LockEntry { count: number; lockedUntil: number | null }
const loginAttempts = new Map<string, LockEntry>();

function checkLoginAttempts(key: string): { blocked: boolean; retryAfter?: number } {
  const entry = loginAttempts.get(key);
  if (!entry) return { blocked: false };
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { blocked: true, retryAfter: Math.ceil((entry.lockedUntil - Date.now()) / 1000) };
  }
  return { blocked: false };
}

function recordLoginFailure(key: string): void {
  const entry = loginAttempts.get(key) ?? { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 min lockout
    entry.count = 0;
  }
  loginAttempts.set(key, entry);
}

function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

@Controller('auth')
export class AuthController {
  @Post('login')
  async login(@Body() body: unknown, @Req() req: FastifyRequest) {
    const { email, password } = loginSchema.parse(body);

    // D91: Check lockout before attempting auth
    const attemptKey = `${req.ip}:${email}`;
    const lockCheck = checkLoginAttempts(attemptKey);
    if (lockCheck.blocked) {
      throw new HttpException(
        { error: { code: 'LOCKED', message: `Too many attempts. Retry in ${lockCheck.retryAfter}s` } },
        429,
      );
    }

    const chatwootUrl = (process.env.CHATWOOT_BASE_URL ?? 'http://chatwoot:3000').replace(/\/$/, '');

    const res = await fetch(`${chatwootUrl}/auth/sign_in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      log.warn({ email, status: res.status }, 'chatwoot login failed');
      // D91: Record failure for lockout tracking
      recordLoginFailure(attemptKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    const data = (await res.json()) as {
      data?: { id?: number; account_id?: number; role?: string };
    };
    const user = data.data;
    if (!user?.id) throw new UnauthorizedException('Invalid session payload');

    // D91: Clear failed attempts on successful login
    clearLoginAttempts(attemptKey);

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

  // D91: Anomalous login pattern detection — list currently locked accounts
  @Get('login-lockouts')
  getLoginLockouts() {
    const locked: Array<{ key: string; lockedUntil: string }> = [];
    for (const [key, entry] of loginAttempts) {
      if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
        locked.push({ key, lockedUntil: new Date(entry.lockedUntil).toISOString() });
      }
    }
    return { locked };
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
