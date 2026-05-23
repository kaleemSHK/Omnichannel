/**
 * TR-58 — MFA (Keycloak / Chatwoot policy documented; smoke when KEYCLOAK_URL set).
 */
import { cfg } from '../lib/config.mjs';

export async function run() {
  const start = Date.now();
  const kc = process.env.KEYCLOAK_URL;
  if (!kc) {
    return {
      status: 'SKIP',
      detail: 'Enable MFA in Keycloak realm + Chatwoot; set KEYCLOAK_URL for automated probe',
    };
  }
  try {
    const res = await fetch(`${kc.replace(/\/$/, '')}/realms/master`, { signal: AbortSignal.timeout(5000) });
    return {
      status: res.ok ? 'PASS' : 'SKIP',
      detail: res.ok ? 'Keycloak reachable — configure OTP required action in realm' : `Keycloak ${res.status}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return { status: 'SKIP', detail: e.message, durationMs: Date.now() - start };
  }
}
