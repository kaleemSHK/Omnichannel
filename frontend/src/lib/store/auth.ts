/**
 * Auth store — Zustand.
 * Persists tokens in memory only (never localStorage — security).
 * On page refresh user must re-login (or implement httpOnly cookie flow).
 */

import { create } from 'zustand';
import type { BlinkoneUser, AuthTokens } from '@/types';
import { resolveRoleFromAuth } from '@/lib/roles';
import { resetGatewayAuthFailed } from '@/lib/demo/config';

interface AuthState {
  user: BlinkoneUser | null;
  tokens: AuthTokens | null;
  setAuth: (user: BlinkoneUser, tokens: AuthTokens) => void;
  clearAuth: () => void;
  updateTokens: (tokens: AuthTokens) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  setAuth: (user, tokens) => {
    resetGatewayAuthFailed();
    const role = resolveRoleFromAuth(user.role, tokens.gatewayJwt, user.email);
    set({ user: { ...user, role }, tokens });
  },
  clearAuth: () => set({ user: null, tokens: null }),
  updateTokens: (tokens) => set((s) => ({ ...s, tokens })),
}));
