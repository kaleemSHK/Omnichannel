'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getAccount, updateAccount } from '@/lib/api/settings';
import { DEMO_ACCOUNT, settingsDemoDelay } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { withDemoOnly } from '@/lib/demo/tenantSettingsQuery';
import { useTenantAccountId } from '@/lib/hooks/useTenantAccountId';
import { SectionHeader } from './shared/SectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-radix';

const TIMEZONES = ['Asia/Muscat', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'UTC', 'Europe/London'];
const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية (Arabic)' },
];

export function AccountSection() {
  const qc = useQueryClient();
  const accountId = useTenantAccountId();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['account', accountId],
    enabled: accountId > 0,
    queryFn: () => withDemoOnly(DEMO_ACCOUNT, () => getAccount()),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (payload: Parameters<typeof updateAccount>[0]) => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay();
        return { ...DEMO_ACCOUNT, ...payload };
      }
      return updateAccount(payload);
    },
    onSuccess: saved => {
      qc.setQueryData(['account', accountId], saved);
      toast.success('Account settings saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [timezone, setTimezone] = useState('Asia/Muscat');
  const [locale, setLocale] = useState('en');
  const [email, setEmail] = useState('');
  const [autoResolve, setAutoResolve] = useState(false);
  const [csatOn, setCsatOn] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setDomain(data.domain ?? '');
    setTimezone(data.timezone);
    setLocale(data.locale);
    setEmail(data.support_email ?? '');
    setAutoResolve(data.features?.auto_resolve_enabled ?? false);
    setCsatOn(data.features?.csat_survey_enabled ?? false);
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load account settings'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Account Settings"
        description="General configuration for your BlinkOne account."
      />

      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold">General</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Account name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Company name" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Domain</Label>
            <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="company.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Support email</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="support@company.com"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Default language</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map(l => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold">Features</h2>
        {[
          {
            id: 'auto-resolve',
            label: 'Auto-resolve idle conversations',
            desc: 'Automatically resolve conversations with no activity',
            val: autoResolve,
            set: setAutoResolve,
          },
          {
            id: 'csat',
            label: 'CSAT survey',
            desc: 'Send satisfaction survey after conversations resolve',
            val: csatOn,
            set: setCsatOn,
          },
        ].map(f => (
          <div key={f.id} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
            <Switch id={f.id} checked={f.val} onCheckedChange={f.set} />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          disabled={isPending}
          onClick={() =>
            mutate({
              name,
              domain,
              timezone,
              locale,
              support_email: email,
              features: { auto_resolve_enabled: autoResolve, csat_survey_enabled: csatOn },
            })
          }
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </div>
  );
}
