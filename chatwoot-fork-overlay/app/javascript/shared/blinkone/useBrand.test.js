import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBranding, invalidateBrandingCache, useBrand } from './useBrand.js';

describe('useBrand', () => {
  beforeEach(() => {
    invalidateBrandingCache();
    vi.restoreAllMocks();
  });

  it('fetchBranding returns API payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          productName: 'BlinkOne',
          primaryColor: '#0B5FFF',
          logoUrl: { full: '/blinkone-brand/logo-full.svg' },
        },
      }),
    }));

    const data = await fetchBranding(1);
    expect(data.productName).toBe('BlinkOne');
    expect(fetch).toHaveBeenCalledWith('/blinkone/api/v1/branding?accountId=1', expect.any(Object));
  });

  it('caches branding per account', async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { productName: 'BlinkOne' } }),
    });
    vi.stubGlobal('fetch', mock);

    await fetchBranding();
    await fetchBranding();
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('logoUrl falls back when branding not loaded', () => {
    const brand = useBrand();
    expect(brand.logoUrl('full')).toContain('logo-full');
  });
});
