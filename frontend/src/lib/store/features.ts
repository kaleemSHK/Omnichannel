/**
 * Tenant feature entitlements — loaded at login and refreshed from tenant API.
 */

import { create } from 'zustand';
import { defaultFeatures, type PlatformFeatureKey } from '@/lib/utils/platform';

interface FeaturesState {
  features: Record<PlatformFeatureKey, boolean>;
  loaded: boolean;
  setFeatures: (raw: Record<string, unknown> | null | undefined) => void;
  clear: () => void;
}

export const useFeaturesStore = create<FeaturesState>((set) => ({
  features: defaultFeatures(),
  loaded: false,
  setFeatures: raw => set({ features: defaultFeatures(raw ?? undefined), loaded: true }),
  clear: () => set({ features: defaultFeatures(), loaded: false }),
}));

export function hydrateFeaturesFromLogin(raw: Record<string, unknown> | null | undefined) {
  if (!raw || typeof raw !== 'object') return;
  useFeaturesStore.getState().setFeatures(raw);
}
