import { create } from 'zustand';
import { saveTokens, loadTokens, clearTokens } from '@/lib/storage';
import { fetchProfile } from '@/api/auth';
import type { BlinkoneUser, AuthTokens } from '@/types';

interface AuthState {
  user: BlinkoneUser | null;
  tokens: AuthTokens | null;
  hydrated: boolean;
  setAuth: (user: BlinkoneUser, tokens: AuthTokens) => Promise<void>;
  clearAuth: () => Promise<void>;
  updateTokens: (tokens: AuthTokens) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  hydrated: false,

  hydrate: async () => {
    const stored = await loadTokens();
    if (stored?.accessToken) {
      try {
        const user = await fetchProfile(stored.accessToken);
        set({ user, tokens: stored, hydrated: true });
        return;
      } catch {
        await clearTokens();
        set({ user: null, tokens: null, hydrated: true });
        return;
      }
    }
    set({ tokens: stored, hydrated: true });
  },

  setAuth: async (user, tokens) => {
    await saveTokens(tokens);
    set({ user, tokens });
  },

  clearAuth: async () => {
    await clearTokens();
    set({ user: null, tokens: null });
  },

  updateTokens: async (tokens) => {
    await saveTokens(tokens);
    set((s) => ({ ...s, tokens }));
  },
}));
