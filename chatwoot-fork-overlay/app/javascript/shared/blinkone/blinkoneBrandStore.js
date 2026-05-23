import { defineStore } from 'pinia';
import { fetchBranding, invalidateBrandingCache } from './useBrand';

/**
 * Pinia store — load once per session; call refresh() after admin branding save.
 * Copy into Chatwoot fork: app/javascript/shared/blinkone/
 */
export const useBlinkoneBrandStore = defineStore('blinkoneBrand', {
  state: () => ({
    loaded: false,
    loading: false,
    error: null,
    data: null,
    accountId: null,
  }),

  getters: {
    productName: (s) => s.data?.productName ?? 'BlinkOne',
    primaryColor: (s) => s.data?.primaryColor ?? '#0B5FFF',
    logoUrlFull: (s) => s.data?.logoUrl?.full ?? '/blinkone-brand/logo-full.svg',
  },

  actions: {
    async load(accountId = null, { force = false } = {}) {
      if (this.loaded && !force && this.accountId === accountId) return this.data;
      this.loading = true;
      this.error = null;
      try {
        this.data = await fetchBranding(accountId);
        this.accountId = accountId;
        this.loaded = true;
        return this.data;
      } catch (e) {
        this.error = e.message || 'Failed to load branding';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async refresh(accountId = null) {
      invalidateBrandingCache();
      return this.load(accountId ?? this.accountId, { force: true });
    },
  },
});
