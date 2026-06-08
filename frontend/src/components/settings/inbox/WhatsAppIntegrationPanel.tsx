'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getWhatsAppConfig,
  updateWhatsAppConfig,
  type WhatsAppConfig,
} from '@/lib/api/whatsapp-config';
import { useTenantId } from '@/lib/hooks/useTenantScope';

const SECRET_PLACEHOLDER = '••••••••';

interface Props {
  inboxId: number;
}

export function WhatsAppIntegrationPanel({ inboxId }: Props) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-config', tenantId],
    queryFn: getWhatsAppConfig,
  });
  const [form, setForm] = useState<WhatsAppConfig | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      ...data,
      chatwootInboxId: data.chatwootInboxId || String(inboxId),
    });
  }, [data, inboxId]);

  const save = useMutation({
    mutationFn: () => updateWhatsAppConfig(form ?? {}),
    onSuccess: next => {
      qc.setQueryData(['whatsapp-config', tenantId], next);
      setForm({ ...next, chatwootInboxId: next.chatwootInboxId || String(inboxId) });
      toast.success('WhatsApp integration saved');
    },
    onError: (e: Error) => toast.error(e.message || 'Save failed'),
  });

  if (isLoading || !form) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }

  function set<K extends keyof WhatsAppConfig>(k: K, v: WhatsAppConfig[K]) {
    setForm(p => (p ? { ...p, [k]: v } : p));
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-2">
        <p className="font-semibold">Meta Developer Console</p>
        <p className="text-xs">
          Paste these values from your Meta app → WhatsApp → API Setup. Changes apply immediately to
          the BlinkOne bridge — no server restart needed.
        </p>
        <a
          href="https://developers.facebook.com/apps/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
        >
          Open Meta Apps <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Meta App credentials
        </p>
        <Field
          id="wa-meta-app-id"
          label="Meta App ID"
          value={form.metaAppId}
          onChange={v => set('metaAppId', v)}
          placeholder="1990063798544089"
        />
        <SecretField
          id="wa-meta-app-secret"
          label="Meta App Secret"
          value={form.metaAppSecret}
          hasValue={form.hasMetaAppSecret}
          onChange={v => set('metaAppSecret', v)}
          placeholder="App secret from Meta dashboard"
        />
        <Field
          id="wa-verify-token"
          label="Webhook verify token"
          value={form.metaVerifyToken}
          onChange={v => set('metaVerifyToken', v)}
          placeholder="blinkone_wh_2026"
          hint="Must match the verify token in Meta → WhatsApp → Configuration"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          WhatsApp Business API
        </p>
        <Field
          id="wa-phone-number-id"
          label="Phone Number ID"
          value={form.phoneNumberId}
          onChange={v => set('phoneNumberId', v)}
          placeholder="1236816386176073"
        />
        <Field
          id="wa-business-phone"
          label="Business phone (E.164)"
          type="tel"
          value={form.businessPhone}
          onChange={v => set('businessPhone', v)}
          placeholder="+15556712440"
          hint="Must match the number in Chatwoot inbox and Meta"
        />
        <SecretField
          id="wa-access-token"
          label="WhatsApp access token"
          value={form.accessToken}
          hasValue={form.hasAccessToken}
          onChange={v => set('accessToken', v)}
          placeholder="Permanent or system user token"
        />
        <Field
          id="wa-inbox-id"
          label="Chatwoot inbox ID"
          value={form.chatwootInboxId}
          onChange={v => set('chatwootInboxId', v)}
          placeholder={String(inboxId)}
          hint={`This inbox is #${inboxId} — bridge routes messages here`}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Webhook URLs (read-only)
        </p>
        <ReadOnlyUrl
          label="BlinkOne Meta webhook"
          value={form.webhookUrl}
          onCopy={() => copyText(form.webhookUrl, 'Webhook URL')}
        />
        <ReadOnlyUrl
          label="Chatwoot native webhook"
          value={form.chatwootWebhookUrl}
          onCopy={() => copyText(form.chatwootWebhookUrl, 'Chatwoot webhook URL')}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Behaviour
        </p>
        <ToggleRow
          id="wa-messaging"
          label="Messaging enabled"
          description="Receive and send WhatsApp messages via BlinkOne bridge"
          checked={form.messagingEnabled}
          onChange={v => set('messagingEnabled', v)}
        />
        <ToggleRow
          id="wa-calling"
          label="Calling enabled"
          description="WhatsApp voice calling (SDP relay)"
          checked={form.callingEnabled}
          onChange={v => set('callingEnabled', v)}
        />
        <ToggleRow
          id="wa-unsigned"
          label="Allow unsigned webhooks (demo)"
          description="Skip Meta signature check when App Secret is not set"
          checked={form.allowUnsignedWebhook}
          onChange={v => set('allowUnsignedWebhook', v)}
        />
      </div>

      <div className="flex justify-end pt-1">
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {save.isPending ? 'Saving…' : 'Save integration'}
        </Button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SecretField({
  id,
  label,
  value,
  hasValue,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  hasValue?: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const display = value === SECRET_PLACEHOLDER ? '' : value;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="password"
        value={display}
        placeholder={hasValue && !display ? 'Leave blank to keep current' : placeholder}
        onChange={e => onChange(e.target.value)}
      />
      {hasValue ? (
        <p className="text-[11px] text-muted-foreground">Saved — enter a new value to replace</p>
      ) : null}
    </div>
  );
}

function ReadOnlyUrl({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="text-xs font-mono bg-muted/40" />
        <Button type="button" variant="outline" size="icon" onClick={onCopy} aria-label="Copy URL">
          <Copy className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
