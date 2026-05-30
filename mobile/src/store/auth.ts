import { create } from 'zustand';
import { saveTokens, loadTokens, clearTokens } from '@/lib/storage';
import { fetchProfile, refreshGatewayToken } from '@/api/auth';
import { registerPushDevice } from '@/api/devices';
import { disconnectCable } from '@/api/websocket';
import type { BlinkoneUser, AuthTokens } from '@/types';

async function syncPushRegistration() {
  const { pushToken, tokens } = useAuthStore.getState();
  if (!pushToken || !tokens?.gatewayJwt) return;
  try {
    await registerPushDevice(pushToken);
  } catch (err) {
    console.warn('[push] registration failed', err);
  }
}

interface AuthState {
  user: BlinkoneUser | null;
  tokens: AuthTokens | null;
  hydrated: boolean;
  pushToken: string | null;
  setAuth: (user: BlinkoneUser, tokens: AuthTokens) => Promise<void>;
  clearAuth: () => Promise<void>;
  updateTokens: (tokens: AuthTokens) => Promise<void>;
  hydrate: () => Promise<void>;
  setPushToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  hydrated: false,
  pushToken: null,

  hydrate: async () => {
    const stored = await loadTokens();
    if (stored?.accessToken) {
      try {
        const user = await fetchProfile(stored.accessToken);
        let gatewayJwt = stored.gatewayJwt;
        try {
          gatewayJwt = await refreshGatewayToken(stored.accessToken);
        } catch {
          if (!gatewayJwt) throw new Error('Gateway JWT missing');
        }
        const tokens = { ...stored, gatewayJwt };
        await saveTokens(tokens);
        set({ user, tokens, hydrated: true });
        void syncPushRegistration();
        return;
      } catch {
        await clearTokens();
        disconnectCable();
        set({ user: null, tokens: null, hydrated: true });
        return;
      }
    }
    set({ tokens: stored, hydrated: true });
  },

  setAuth: async (user, tokens) => {
    await saveTokens(tokens);
    set({ user, tokens });
    void syncPushRegistration();
  },

  clearAuth: async () => {
    disconnectCable();
    await clearTokens();
    set({ user: null, tokens: null, pushToken: null });
  },

  updateTokens: async (tokens) => {
    await saveTokens(tokens);
    set((s) => ({ ...s, tokens }));
  },

  setPushToken: (token) => {
    set({ pushToken: token });
    void syncPushRegistration();
  },
}));
