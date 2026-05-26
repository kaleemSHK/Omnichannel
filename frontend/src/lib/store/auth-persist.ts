import type { AuthTokens, BlinkoneUser } from '@/types';

const STORAGE_KEY = 'blinkone_auth_session';

export interface PersistedAuthSession {
  user: BlinkoneUser;
  tokens: AuthTokens;
}

function isValidSession(value: unknown): value is PersistedAuthSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as PersistedAuthSession;
  return (
    typeof v.user?.id === 'number' &&
    typeof v.user?.email === 'string' &&
    typeof v.user?.role === 'string' &&
    typeof v.tokens?.accessToken === 'string' &&
    typeof v.tokens?.gatewayJwt === 'string'
  );
}

export function loadAuthSession(): PersistedAuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: PersistedAuthSession): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
