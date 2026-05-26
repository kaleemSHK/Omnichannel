'use client';

/**
 * Branding Settings — Sprint 1 B01
 * Allows admins to configure white-label branding for their tenant.
 * Backend: GET/PATCH /v1/tenants/:id/branding → services/tenant
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/auth';
import { bnFetch } from '@/lib/api/client';
import { SectionHeader } from './shared/SectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette, Globe, Mail, Image } from 'lucide-react';

interface BrandConfig {
  productName?: string;
  companyName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  tagline?: string;
  emailFromName?: string;
  emailFromAddress?: string;
  supportUrl?: string;
  marketingUrl?: string;
  logoUrl?: { full?: string; mark?: string };
  faviconUrl?: string;
}

async function fetchBranding(tenantId: string): Promise<BrandConfig> {
  const res = await bnFetch<{ data: BrandConfig }>('tenant', `/v1/tenants/${tenantId}/branding`);
  return res.data ?? {};
}

async function saveBranding(tenantId: string, brand: Partial<BrandConfig>): Promise<BrandConfig> {
  const res = await bnFetch<{ data: BrandConfig }>('tenant', `/v1/tenants/${tenantId}/branding`, {
    method: 'PATCH',
    body: JSON.stringify({ brand }),
  });
  return res.data ?? {};
}

// ─── Color preview swatch ──────────────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded border border-gray-200 shrink-0 cursor-pointer"
          style={{ backgroundColor: value || '#1B6FEE' }}
          title="Click to change color"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1B6FEE"
          className="h-8 text-sm font-mono w-32"
          maxLength={7}
        />
        <input
          type="color"
          value={value || '#1B6FEE'}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
          title="Pick a color"
        />
      </div>
    </div>
  );
}

// ─── Preview banner ────────────────────────────────────────────────────────

function BrandPreview({ brand }: { brand: Partial<BrandConfig> }) {
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <div
        className="h-10 flex items-center px-4 gap-2"
        style={{ backgroundColor: brand.primaryColor || '#1B6FEE' }}
      >
        {brand.logoUrl?.mark ? (
          <img src={brand.logoUrl.mark} alt="Logo" className="h-6 object-contain" />
        ) : (
          <div className="w-6 h-6 rounded bg-white/30 flex items-center justify-center text-white text-xs font-bold">
            {(brand.productName || 'B').charAt(0)}
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
        Preview — how your branding will appear
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function BrandingSection() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const tenantId = String(user?.chatwootAccountId ?? user?.tenantId ?? '1');

  const { data: remote, isLoading } = useQuery<BrandConfig>({
    queryKey: ['branding', tenantId],
    queryFn: () => fetchBranding(tenantId),
    staleTime: 60_000,
  });

  const [form, setForm] = useState<Partial<BrandConfig>>({});
  const [dirty, setDirty] = useState(false);

  // Sync remote → form on first load
  useEffect(() => {
    if (remote && !dirty) setForm(remote);
  }, [remote, dirty]);

  function set<K extends keyof BrandConfig>(key: K, value: BrandConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const save = useMutation({
    mutationFn: () => saveBranding(tenantId, form),
    onSuccess: (saved) => {
      qc.setQueryData(['branding', tenantId], saved);
      setDirty(false);
      toast.success('Branding saved');
    },
    onError: (err: Error) => toast.error(`Failed to save: ${err.message}`),
  });

  const preview = { ...remote, ...form };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Branding" description="Customize your platform appearance" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader
        title="Branding"
        description="White-label your platform — set your name, colors, and logos"
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
              onChange={(e) => set('productName', e.target.value)}
              placeholder="BlinkOne"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Company name</Label>
            <Input
              value={form.companyName ?? ''}
              onChange={(e) => set('companyName', e.target.value)}
              placeholder="Labbik Tech"
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tagline</Label>
            <Input
              value={form.tagline ?? ''}
              onChange={(e) => set('tagline', e.target.value)}
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
        </div>
        <div className="flex flex-wrap gap-6">
          <ColorField
            label="Primary color"
            value={form.primaryColor ?? '#1B6FEE'}
            onChange={(v) => set('primaryColor', v)}
          />
          <ColorField
            label="Secondary color"
            value={form.secondaryColor ?? '#6366f1'}
            onChange={(v) => set('secondaryColor', v)}
          />
        </div>
      </div>

      {/* Logos */}
      <div className="rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <Image className="w-4 h-4" />
          Logo URLs
          <span className="text-xs text-muted-foreground font-normal ml-1">
            (host images on your CDN)
          </span>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Full logo URL (header)</Label>
            <Input
              value={(form.logoUrl as BrandConfig['logoUrl'])?.full ?? ''}
              onChange={(e) =>
                set('logoUrl', { ...(form.logoUrl as BrandConfig['logoUrl']), full: e.target.value })
              }
              placeholder="https://cdn.example.com/logo-full.svg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mark / icon URL (square)</Label>
            <Input
              value={(form.logoUrl as BrandConfig['logoUrl'])?.mark ?? ''}
              onChange={(e) =>
                set('logoUrl', { ...(form.logoUrl as BrandConfig['logoUrl']), mark: e.target.value })
              }
              placeholder="https://cdn.example.com/logo-mark.svg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Favicon URL</Label>
            <Input
              value={form.faviconUrl ?? ''}
              onChange={(e) => set('faviconUrl', e.target.value)}
              placeholder="https://cdn.example.com/favicon.ico"
            />
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <Mail className="w-4 h-4" />
          Email
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">From name</Label>
            <Input
              value={form.emailFromName ?? ''}
              onChange={(e) => set('emailFromName', e.target.value)}
              placeholder="BlinkOne Notifications"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">From address</Label>
            <Input
              type="email"
              value={form.emailFromAddress ?? ''}
              onChange={(e) => set('emailFromAddress', e.target.value)}
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
            { key: 'supportUrl', label: 'Support URL' },
            { key: 'marketingUrl', label: 'Marketing URL' },
            { key: 'termsUrl', label: 'Terms of service' },
            { key: 'privacyUrl', label: 'Privacy policy' },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                value={(form as Record<string, string>)[key] ?? ''}
                onChange={(e) => set(key as keyof BrandConfig, e.target.value)}
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
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {save.isPending ? 'Saving…' : 'Save branding'}
        </Button>
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => {
              setForm(remote ?? {});
              setDirty(false);
            }}
          >
            Discard changes
          </Button>
        )}
      </div>
    </div>
  );
}
