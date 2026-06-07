/**
 * Auth store — Zustand with sessionStorage persistence (survives page refresh).
 * Uses sessionStorage (not localStorage): cleared when the browser tab closes.
 */

import { create } from 'zustand';
import type { BlinkoneUser, AuthTokens } from '@/types';
import { resolveRoleFromAuth } from '@/lib/roles';
import { resetGatewayAuthFailed } from '@/lib/demo/config';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from '@/lib/store/auth-persist';
import { hydratePermissionsFromJwt, usePermissionsStore } from '@/lib/store/permissions';
import { useFeaturesStore } from '@/lib/store/features';

interface AuthState {
  user: BlinkoneUser | null;
  tokens: AuthTokens | null;
  /** False until client has read sessionStorage (avoids refresh → login flash). */
  hydrated: boolean;
  hydrateFromSession: () => void;
  setAuth: (user: BlinkoneUser, tokens: AuthTokens) => void;
  clearAuth: () => void;
  updateTokens: (tokens: AuthTokens) => void;
}

function readSessionIntoState(): Pick<AuthState, 'user' | 'tokens' | 'hydrated'> {
  const stored = loadAuthSession();
  if (stored) {
    const role = resolveRoleFromAuth(
      stored.user.role,
      stored.tokens.gatewayJwt,
      stored.user.email,
    );
    resetGatewayAuthFailed();
    hydratePermissionsFromJwt(stored.tokens.gatewayJwt);
    return {
      user: { ...stored.user, role },
      tokens: stored.tokens,
      hydrated: true,
    };
  }
  return { user: null, tokens: null, hydrated: true };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  hydrated: false,

  hydrateFromSession: () => {
    if (get().hydrated) return;
    set(readSessionIntoState());
  },

  setAuth: (user, tokens) => {
    resetGatewayAuthFailed();
    hydratePermissionsFromJwt(tokens.gatewayJwt);
    const role = resolveRoleFromAuth(user.role, tokens.gatewayJwt, user.email);
    const nextUser = { ...user, role };
    set({ user: nextUser, tokens, hydrated: true });
    saveAuthSession({ user: nextUser, tokens });
  },

  clearAuth: () => {
    clearAuthSession();
    usePermissionsStore.getState().clear();
    useFeaturesStore.getState().clear();
    set({ user: null, tokens: null, hydrated: true });
  },

  updateTokens: tokens => {
    const user = get().user;
    set({ tokens });
    if (user) saveAuthSession({ user, tokens });
  },
}));
