'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PhoneCall, ExternalLink } from 'lucide-react';
import { SectionHeader } from './shared/SectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  getTelephonyConfig,
  updateTelephonyConfig,
  type TelephonyConfig,
} from '@/lib/api/telephony-config';

export function TelephonySection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['telephony-config'],
    queryFn: getTelephonyConfig,
  });
  const [form, setForm] = useState<TelephonyConfig | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateTelephonyConfig(form ?? {}),
    onSuccess: next => {
      qc.setQueryData(['telephony-config'], next);
      toast.success('PSTN / Twilio settings saved');
    },
    onError: (e: Error) => toast.error(e.message || 'Save failed'),
  });

  if (isLoading || !form) {
    return <div className="text-sm text-muted-foreground py-8">Loading PSTN settings…</div>;
  }

  function set<K extends keyof TelephonyConfig>(k: K, v: TelephonyConfig[K]) {
    setForm(p => (p ? { ...p, [k]: v } : p));
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <SectionHeader
        title="PSTN & Twilio"
        description="Outbound caller ID, SIP trunk, and inbound voice webhook. Kamailio uses these values on the server."
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
        <p className="font-semibold">Twilio Trial checklist</p>
        <ul className="list-disc ps-5 space-y-1 text-xs">
          <li>Voice → Geo permissions → enable destination country (e.g. Pakistan +92)</li>
          <li>Phone Numbers → Verified Caller IDs → add test mobile numbers</li>
          <li>Elastic SIP Trunk → Termination → credential list attached</li>
          <li>
            Active number voice webhook must use{' '}
            <strong>https://app.blinksone.com</strong> (not blinkone.com)
          </li>
        </ul>
        <a
          href="https://console.twilio.com/us1/develop/voice/settings/geo-permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:underline"
        >
          Open Twilio Geo Permissions <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Trunk & caller ID</p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Twilio SIP trunk host</Label>
          <Input
            value={form.twilioTrunkHost}
            onChange={e => set('twilioTrunkHost', e.target.value)}
            placeholder="intelysys.pstn.twilio.com"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Outbound caller ID (E.164)</Label>
          <Input
            value={form.outboundCallerId}
            onChange={e => set('outboundCallerId', e.target.value)}
            placeholder="+19143038893"
          />
          <p className="text-[10px] text-muted-foreground">
            Must be a Twilio number on your trunk (currently +1 914 303 8893).
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Agent SIP WebSocket (WSS)</Label>
          <Input
            value={form.sipWssUrl}
            onChange={e => set('sipWssUrl', e.target.value)}
            placeholder="wss://sip.blinksone.com"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Inbound voice webhook (Twilio number)</Label>
          <Input
            value={form.inboundVoiceWebhook}
            onChange={e => set('inboundVoiceWebhook', e.target.value)}
            placeholder="https://app.blinksone.com/api/ivr/v1/ivr/inbound"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Call status webhook (Twilio number)</Label>
          <Input
            value={form.callStatusWebhook ?? ''}
            onChange={e => set('callStatusWebhook', e.target.value)}
            placeholder="https://app.blinksone.com/api/ivr/v1/ivr/status"
          />
          <p className="text-[10px] text-muted-foreground">
            Twilio Console → Phone Number → Voice → &quot;Call status changes&quot; → paste this URL (HTTP POST).
            Ensures mobile/PSTN leg ends when the browser hangs up.
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ring timeout (seconds)</Label>
          <Input
            type="number"
            min={10}
            max={120}
            value={form.ringTimeoutSec}
            onChange={e => set('ringTimeoutSec', Number(e.target.value) || 30)}
          />
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <div>
            <p className="text-sm font-medium">Sync hangup both legs</p>
            <p className="text-xs text-muted-foreground">
              When agent ends call in browser, also send BYE to PSTN/mobile leg
            </p>
          </div>
          <Switch
            checked={form.syncHangupBothLegs}
            onCheckedChange={v => set('syncHangupBothLegs', v)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Twilio trial account</p>
            <p className="text-xs text-muted-foreground">Show trial verification reminders to agents</p>
          </div>
          <Switch checked={form.trialAccount} onCheckedChange={v => set('trialAccount', v)} />
        </div>

        <Button
          type="button"
          className="bg-brand-primary hover:bg-brand-primary/90"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save PSTN settings'}
        </Button>
      </div>
    </div>
  );
}
