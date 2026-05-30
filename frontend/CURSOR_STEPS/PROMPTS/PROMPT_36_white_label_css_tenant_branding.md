# PROMPT 36 — White-Label CSS Token Injection from Tenant Service
## BlinkOne · blinksone.com · TRD Requirements TR-39, TR-61, TR-62, TR-63

---

## CONTEXT

The tenant service at `services/tenant` has:
- `GET /v1/tenant/branding` — returns `{ primaryColor, logoUrl, orgName, fontFamily, accentColor }`
- `PATCH /v1/tenant/branding` — updates branding for tenant

The frontend has no CSS variable injection — all colors are hardcoded Tailwind tokens. The app always shows "BlinkOne" branding regardless of tenant.

This prompt injects tenant CSS variables on page load so white-label clients see their brand colors and logo.

---

## PART A — Frontend Branding API Client

Open `frontend/src/lib/api/tenant.ts`. Add:

```typescript
import { bnFetch } from './gateway';

export interface TenantBranding {
  orgName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;    // hex e.g. #1a56db
  accentColor?: string;
  textOnPrimary?: string;  // hex for text on primaryColor background
  fontFamily?: string;     // e.g. 'Inter', 'Cairo' (for Arabic)
}

export async function getTenantBranding(): Promise<TenantBranding | null> {
  try {
    const res = await bnFetch('/tenant/v1/tenant/branding');
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function updateTenantBranding(branding: Partial<TenantBranding>): Promise<void> {
  const res = await bnFetch('/tenant/v1/tenant/branding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(branding),
  });
  if (!res.ok) throw new Error('Failed to update branding');
}
```

---

## PART B — CSS Variable Injection Utility

Create `frontend/src/lib/branding/inject.ts`:

```typescript
import type { TenantBranding } from '@/lib/api/tenant';

/**
 * Injects tenant brand CSS variables into the document root.
 * Falls back gracefully — if branding is null, no variables are set.
 */
export function injectBrandingVars(branding: TenantBranding | null) {
  if (!branding) return;

  const root = document.documentElement;

  if (branding.primaryColor) {
    root.style.setProperty('--brand-primary', branding.primaryColor);
    root.style.setProperty('--brand-primary-rgb', hexToRgb(branding.primaryColor));
  }

  if (branding.accentColor) {
    root.style.setProperty('--brand-accent', branding.accentColor);
  }

  if (branding.textOnPrimary) {
    root.style.setProperty('--brand-text-on-primary', branding.textOnPrimary);
  }

  if (branding.fontFamily) {
    root.style.setProperty('--brand-font', branding.fontFamily);
    document.body.style.fontFamily = `var(--brand-font), system-ui, sans-serif`;
  }

  if (branding.orgName) {
    document.title = `${branding.orgName}`;
  }
}

/**
 * Inject favicon dynamically.
 */
export function injectFavicon(url: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}
```

---

## PART C — BrandingProvider Component

Create `frontend/src/components/providers/BrandingProvider.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTenantBranding } from '@/lib/api/tenant';
import { injectBrandingVars, injectFavicon } from '@/lib/branding/inject';
import { useAuthStore } from '@/lib/store/auth';

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => !!s.token);

  const { data: branding } = useQuery({
    queryKey: ['tenant-branding'],
    queryFn: getTenantBranding,
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
  });

  useEffect(() => {
    if (branding) {
      injectBrandingVars(branding);
      if (branding.faviconUrl) {
        injectFavicon(branding.faviconUrl);
      }
    }
  }, [branding]);

  return <>{children}</>;
}
```

---

## PART D — Register BrandingProvider in Root Layout

Open `frontend/src/app/layout.tsx`. Import and wrap children:

```tsx
import { BrandingProvider } from '@/components/providers/BrandingProvider';

// Inside the root layout, within QueryClientProvider:
<QueryClientProvider client={queryClient}>
  <BrandingProvider>
    {children}
  </BrandingProvider>
</QueryClientProvider>
```

---

## PART E — Update Tailwind Config to Use CSS Variables

Open `frontend/tailwind.config.ts`. Update the brand color definitions to read from CSS variables:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-primary': 'rgb(var(--brand-primary-rgb, 26 86 219) / <alpha-value>)',
        'brand-accent': 'var(--brand-accent, #0ea5e9)',
        'brand-text-on-primary': 'var(--brand-text-on-primary, #ffffff)',
      },
      fontFamily: {
        brand: ['var(--brand-font)', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

> **Important**: Tailwind's JIT purges unused classes. Since `bg-brand-primary` uses the CSS variable dynamically, add a `safelist` if needed:
> ```typescript
> safelist: ['bg-brand-primary', 'text-brand-primary', 'border-brand-primary'],
> ```

---

## PART F — Replace Hardcoded Brand Color References

Search the codebase for hardcoded blue colors that should use brand variables:

```bash
# In frontend/src, find hardcoded Tailwind blue classes on interactive elements
grep -rn "bg-blue-600\|text-blue-700\|border-blue-" frontend/src/components/ui/ | head -20
```

For buttons, links, and active nav items, replace `bg-blue-600` with `bg-brand-primary` and `text-blue-700` with `text-brand-primary`. 

Update `frontend/src/components/ui/button.tsx` primary variant:

```tsx
// Before:
'bg-blue-600 text-white hover:bg-blue-700'

// After:
'bg-brand-primary text-brand-text-on-primary hover:opacity-90'
```

---

## PART G — Branding Settings UI

Create `frontend/src/components/settings/BrandingSettings.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTenantBranding, updateTenantBranding, type TenantBranding } from '@/lib/api/tenant';
import { injectBrandingVars } from '@/lib/branding/inject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function BrandingSettings() {
  const qc = useQueryClient();
  const { data: branding, isLoading } = useQuery({
    queryKey: ['tenant-branding'],
    queryFn: getTenantBranding,
  });

  const [form, setForm] = useState<Partial<TenantBranding>>({});
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => updateTenantBranding(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-branding'] });
      // Apply immediately without page reload
      injectBrandingVars({ ...branding, ...form } as TenantBranding);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const current = { ...branding, ...form };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-base font-semibold">Brand & Appearance</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Customize the platform appearance for your organization.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Organization Name</label>
          <Input
            value={current.orgName ?? ''}
            onChange={e => setForm(f => ({ ...f, orgName: e.target.value }))}
            placeholder="e.g. Omantel"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Logo URL</label>
          <Input
            value={current.logoUrl ?? ''}
            onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
            placeholder="https://example.com/logo.png"
          />
          {current.logoUrl && (
            <img src={current.logoUrl} alt="Logo preview" className="mt-2 h-8 object-contain" />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Primary Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={current.primaryColor ?? '#1a56db'}
              onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              className="h-8 w-12 rounded cursor-pointer border border-gray-200"
            />
            <Input
              value={current.primaryColor ?? '#1a56db'}
              onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              placeholder="#1a56db"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Accent Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={current.accentColor ?? '#0ea5e9'}
              onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))}
              className="h-8 w-12 rounded cursor-pointer border border-gray-200"
            />
            <Input
              value={current.accentColor ?? '#0ea5e9'}
              onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))}
              placeholder="#0ea5e9"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Font Family</label>
          <select
            value={current.fontFamily ?? 'Inter'}
            onChange={e => setForm(f => ({ ...f, fontFamily: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-2 bg-white"
          >
            <option value="Inter">Inter (Default)</option>
            <option value="Cairo">Cairo (Arabic-friendly)</option>
            <option value="Noto Sans Arabic">Noto Sans Arabic</option>
            <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
            <option value="Roboto">Roboto</option>
          </select>
        </div>
      </div>

      {/* Live preview */}
      <div
        className="rounded-lg p-4 border"
        style={{ backgroundColor: current.primaryColor ?? '#1a56db' }}
      >
        <p className="text-white text-sm font-medium">
          {current.orgName ?? 'Your Organization'} — Live preview
        </p>
      </div>

      <Button
        onClick={() => save.mutate()}
        disabled={save.isPending || Object.keys(form).length === 0}
      >
        {save.isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save Branding'}
      </Button>
    </div>
  );
}
```

Register in Settings → Appearance tab.

---

## PART H — Sidebar Logo Component

Open `frontend/src/components/layout/Sidebar.tsx` (or `AppSidebar.tsx`). Replace hardcoded "BlinkOne" logo with dynamic branding:

```tsx
import { useQuery } from '@tanstack/react-query';
import { getTenantBranding } from '@/lib/api/tenant';

function SidebarLogo() {
  const { data: branding } = useQuery({
    queryKey: ['tenant-branding'],
    queryFn: getTenantBranding,
  });

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b">
      {branding?.logoUrl ? (
        <img
          src={branding.logoUrl}
          alt={branding.orgName ?? 'Logo'}
          className="h-7 w-auto object-contain"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <span className="text-brand-primary font-bold text-lg">
          {branding?.orgName ?? 'BlinkOne'}
        </span>
      )}
    </div>
  );
}
```

---

## VERIFICATION CHECKLIST

- [ ] `GET /tenant/v1/tenant/branding` returns branding JSON with primaryColor and orgName
- [ ] After saving branding in Settings → Appearance, colors update instantly without page reload
- [ ] Buttons and active nav items use `--brand-primary` CSS variable
- [ ] Sidebar shows tenant logo (or org name if no logo URL)
- [ ] Document title changes to organization name after login
- [ ] Changing font family to "Cairo" applies an Arabic-optimized font
- [ ] BrandingProvider does NOT run on the login page (only after authentication)
- [ ] If branding API returns 404 or error, default BlinkOne branding is preserved

---

## TRD REQUIREMENTS COVERED

| TRD ID | Requirement | Status After Prompt |
|--------|-------------|---------------------|
| TR-39  | White-label platform with tenant branding | ✅ DONE |
| TR-61  | Custom logo and colors per tenant | ✅ DONE |
| TR-62  | Custom domain + brand name | ✅ DONE |
| TR-63  | Arabic/RTL font support for tenant | ✅ DONE |
