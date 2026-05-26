/**
 * MFA / TOTP API client — Sprint 2 M01
 *
 * All enrollment endpoints require an authenticated gateway JWT.
 * The /api/auth/mfa endpoint is unauthenticated (called before the JWT is issued).
 */

import { GATEWAY_URL } from '@/lib/env';
import { bnFetch } from './client';
import { useAuthStore } from '@/lib/store/auth';

const SVC = 'platform';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MfaStatus {
  userId: string;
  tenantId: string;
  enabled: boolean;
}

export interface MfaEnrollResponse {
  secret: string;   // base32 TOTP secret (show to user for manual entry)
  uri: string;      // otpauth:// URI (encode as QR code)
  issuer: string;
  label: string;
}

export interface MfaVerifyLoginResponse {
  token: string;
  expiresIn: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentUserIds(): { userId: string; tenantId: string } | null {
  const user = useAuthStore.getState().user;
  if (!user) return null;
  return { userId: String(user.id), tenantId: String(user.chatwootAccountId ?? user.tenantId) };
}

// ─── Enrollment (requires active session) ────────────────────────────────────

/** Check MFA enrollment status for the current user. */
export async function getMfaStatus(): Promise<MfaStatus> {
  const ids = currentUserIds();
  if (!ids) throw new Error('Not authenticated');
  const res = await bnFetch<{ data: MfaStatus }>(
    SVC,
    `/v1/mfa/status?user_id=${encodeURIComponent(ids.userId)}&tenant_id=${encodeURIComponent(ids.tenantId)}`,
  );
  return res.data;
}

/**
 * Begin TOTP enrollment.
 * Returns a secret + otpauth:// URI to render as a QR code.
 * Enrollment is not active until confirmMfaEnrollment() is called.
 */
export async function enrollMfa(): Promise<MfaEnrollResponse> {
  const ids = currentUserIds();
  if (!ids) throw new Error('Not authenticated');
  const user = useAuthStore.getState().user!;
  const res = await bnFetch<{ data: MfaEnrollResponse }>(SVC, '/v1/mfa/enroll', {
    method: 'POST',
    body: JSON.stringify({
      userId:   ids.userId,
      tenantId: ids.tenantId,
      label:    user.email ?? ids.userId,
    }),
  });
  return res.data;
}

/**
 * Confirm enrollment by verifying the first code from the authenticator.
 * Call this after the user has scanned the QR code.
 */
export async function confirmMfaEnrollment(code: string): Promise<{ confirmed: boolean }> {
  const ids = currentUserIds();
  if (!ids) throw new Error('Not authenticated');
  const res = await bnFetch<{ data: { confirmed: boolean } }>(SVC, '/v1/mfa/confirm', {
    method: 'POST',
    body: JSON.stringify({ userId: ids.userId, tenantId: ids.tenantId, code }),
  });
  return res.data;
}

/**
 * Disable MFA for the current user.
 * Requires re-authentication (password) in a real production flow;
 * here we require the user to be authenticated (gateway JWT).
 */
export async function disableMfa(): Promise<{ disabled: boolean }> {
  const ids = currentUserIds();
  if (!ids) throw new Error('Not authenticated');
  const res = await bnFetch<{ data: { disabled: boolean } }>(
    SVC,
    `/v1/mfa/${encodeURIComponent(ids.userId)}?tenant_id=${encodeURIComponent(ids.tenantId)}`,
    { method: 'DELETE' },
  );
  return res.data;
}

// ─── Login step-up (called before session is established) ────────────────────

/**
 * Submit the TOTP code to complete login after receiving mfa_required.
 * Called with the short-lived mfa_token from /api/auth/token.
 * Returns the full gateway JWT on success.
 */
export async function verifyMfaLogin(
  mfaToken: string,
  code: string,
): Promise<MfaVerifyLoginResponse> {
  const res = await fetch(`${GATEWAY_URL}/api/auth/mfa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfa_token: mfaToken, code }),
  });
  const body = await res.json();
  if (!res.ok) {
    const msg =
      body?.error?.message ??
      body?.message ??
      `MFA verification failed (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return body as MfaVerifyLoginResponse;
}
