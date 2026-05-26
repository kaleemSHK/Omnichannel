'use client';

/**
 * Branding Settings — Sprint 3 W1
 * White-label: product name, colors (with live preview), logos, email identity, links.
 * Uses the consolidated branding API (frontend/src/lib/api/branding.ts) which correctly
 * extracts `res.data.brand` from the tenant service response.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/auth';
import { SectionHeader } from './shared/SectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette, Globe, Mail, Image, Type } from 'lucide-react';
import { getTenantBranding, patchTenantBranding, type BrandConfig } from '@/lib/api/branding';
import { injectBrandingVars } from '@/lib/branding/inject';

// ─── Color picker field ────────────────────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange,
  defaultValue = '#1B6FEE',
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  defaultValue?: string;
}) {
  const current = value || defaultValue;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded border border-gray-200 shrink-0"
          style={{ backgroundColor: current }}
        />
        <Input
          type="text"
          value={current}
          onChange={e => onChange(e.target.value)}
          placeholder={defaultValue}
          className="h-8 text-sm font-mono w-28"
          maxLength={7}
        />
        <input
          type="color"
          value={current}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
          title="Pick a color"
        />
      </div>
    </div>
  );
}

// ─── Live preview banner ───────────────────────────────────────────────────────

function BrandPreview({ brand }: { brand: Partial<BrandConfig> }) {
  const logoSrc =
    typeof brand.logoUrl === 'object' ? brand.logoUrl?.mark : brand.logoUrl;

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <div
        className="h-10 flex items-center px-4 gap-2"
        style={{ backgroundColor: brand.primaryColor || '#0B5FFF' }}
      >
        {logoSrc ? (
          <img src={logoSrc} alt="Logo" className="h-6 object-contain" />
        ) : (
          <div className="w-6 h-6 rounded bg-white/30 flex items-center justify-center text-white text-xs font-bold">
            {(brand.productName || 'B').charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-white text-sm font-semibold">
          {brand.productName || 'BlinkOne'}
        </span>
        <span className="text-white/60 text-xs ml-auto">
          {brand.tagline || 'Contact Center Platform'}
        </span>
      </div>
      <div className="p-3 bg-gray-50 text-xs text-muted-foreground">
        Preview — how your branding will appear in the sidebar and app header
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter (default)' },
  { value: 'Cairo', label: 'Cairo (Arabic-friendly)' },
  { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'IBM Plex Sans', label: 'IBM Plex Sans' },
];

export function BrandingSection() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const tenantId = String(user?.chatwootAccountId ?? user?.tenantId ?? '1');

  const { data: remote, isLoading } = useQuery<BrandConfig | null>({
    queryKey: ['tenant-branding', tenantId],
    queryFn: () => getTenantBranding(tenantId),
    staleTime: 60_000,
  });

  const [form, setForm] = useState<Partial<BrandConfig>>({});
  const [dirty, setDirty] = useState(false);

  // Sync remote → local form on first load
  useEffect(() => {
    if (remote && !dirty) setForm(remote);
  }, [remote, dirty]);

  function set<K extends keyof BrandConfig>(key: K, value: BrandConfig[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const save = useMutation({
    mutationFn: () => patchTenantBranding(tenantId, form),
    onSuccess: saved => {
      // Push into React Query cache — BrandingProvider & IconSidebar see the change
      qc.setQueryData(['tenant-branding', tenantId], saved);
      // Inject immediately — no page reload needed
      injectBrandingVars(saved);
      setDirty(false);
      toast.success('Branding saved and applied');
    },
    onError: (err: Error) => toast.error(`Failed to save: ${err.message}`),
  });

  const preview = { ...remote, ...form } as Partial<BrandConfig>;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Branding" description="Customize your platform appearance" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader
        title="Branding"
        description="White-label your platform — set your name, colors, and logos. Changes apply instantly."
      />

      {/* Live preview */}
      <BrandPreview brand={preview} />

      {/* Identity */}
      <div className="rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <Globe className="w-4 h-4" />
          Identity
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Product name</Label>
            <Input
              value={form.productName ?? ''}
              onChange={e => set('productName', e.target.value)}
              placeholder="BlinkOne"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Company name</Label>
            <Input
              value={form.companyName ?? ''}
              onChange={e => set('companyName', e.target.value)}
              placeholder="Labbik Telecom"
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tagline</Label>
            <Input
              value={form.tagline ?? ''}
              onChange={e => set('tagline', e.target.value)}
              placeholder="Your Contact Center Platform"
            />
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <Palette className="w-4 h-4" />
          Colors
          <span className="text-xs text-muted-foreground font-normal ml-1">
            (CSS variables update live — no page reload)
          </span>
        </div>
        <div className="flex flex-wrap gap-6">
          <ColorField
            label="Primary color"
            value={form.primaryColor}
            onChange={v => set('primaryColor', v)}
            defaultValue="#0B5FFF"
          />
          <ColorField
            label="Accent / secondary color"
            value={form.accentColor ?? form.secondaryColor}
            onChange={v => set('accentColor', v)}
            defaultValue="#0ea5e9"
          />
        </div>
      </div>

      {/* Typography */}
      <div className="rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <Type className="w-4 h-4" />
          Typography
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Font family</Label>
          <select
            value={form.fontFamily ?? 'Inter'}
            onChange={e => set('fontFamily', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            {FONT_OPTIONS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logos */}
      <div className="rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <Image className="w-4 h-4" />
          Logo URLs
          <span className="text-xs text-muted-foreground font-normal ml-1">
            (host on your CDN — SVG or PNG)
          </span>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Full logo (header / login page)</Label>
            <Input
              value={(form.logoUrl as BrandConfig['logoUrl'])?.full ?? ''}
              onChange={e =>
                set('logoUrl', { ...(form.logoUrl as BrandConfig['logoUrl']), full: e.target.value })
              }
              placeholder="https://cdn.example.com/logo-full.svg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mark / icon (square — sidebar)</Label>
            <Input
              value={(form.logoUrl as BrandConfig['logoUrl'])?.mark ?? ''}
              onChange={e =>
                set('logoUrl', { ...(form.logoUrl as BrandConfig['logoUrl']), mark: e.target.value })
              }
              placeholder="https://cdn.example.com/logo-mark.svg"
            />
            {(form.logoUrl as BrandConfig['logoUrl'])?.mark && (
              <img
                src={(form.logoUrl as BrandConfig['logoUrl'])?.mark}
                alt="Logo mark preview"
                className="mt-1 h-10 w-10 object-contain border rounded"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Favicon URL (.ico or .svg)</Label>
            <Input
              value={form.faviconUrl ?? ''}
              onChange={e => set('faviconUrl', e.target.value)}
              placeholder="https://cdn.example.com/favicon.ico"
            />
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <Mail className="w-4 h-4" />
          Email identity
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">From name</Label>
            <Input
              value={form.emailFromName ?? ''}
              onChange={e => set('emailFromName', e.target.value)}
              placeholder="BlinkOne Notifications"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">From address</Label>
            <Input
              type="email"
              value={form.emailFromAddress ?? ''}
              onChange={e => set('emailFromAddress', e.target.value)}
              placeholder="noreply@yourdomain.com"
            />
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="text-sm font-medium text-gray-700 mb-1">Support links</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'supportUrl'  as const, label: 'Support URL' },
            { key: 'marketingUrl' as const, label: 'Marketing URL' },
            { key: 'termsUrl'    as const, label: 'Terms of service' },
            { key: 'privacyUrl'  as const, label: 'Privacy policy' },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                value={(form[key] as string) ?? ''}
                onChange={e => set(key, e.target.value)}
                placeholder="https://..."
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          className="bg-brand-primary hover:bg-brand-primary/90 text-white"
        >
          {save.isPending ? 'Saving…' : 'Save branding'}
        </Button>
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => { setForm(remote ?? {}); setDirty(false); }}
          >
            Discard changes
          </Button>
        )}
      </div>
    </div>
  );
}
