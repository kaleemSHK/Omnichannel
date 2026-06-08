'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SectionHeader } from './shared/SectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-radix';
import { Mic, ShieldCheck, HardDrive, Volume2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  getRecordingConfig,
  updateRecordingConfig,
  type RecordingConfig,
} from '@/lib/api/platform-settings';
import { useTenantId } from '@/lib/hooks/useTenantScope';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Section card ──────────────────────────────────────────────────────────────

function Card({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────────

export function RecordingSection() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['recording-config', tenantId],
    queryFn: getRecordingConfig,
  });
  const [cfg, setCfg] = useState<RecordingConfig | null>(null);

  useEffect(() => {
    if (data) setCfg(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => updateRecordingConfig(cfg ?? {}),
    onSuccess: next => {
      qc.setQueryData(['recording-config', tenantId], next);
      setCfg(next);
      toast.success('Recording settings saved');
    },
    onError: (e: Error) => toast.error(e.message || 'Save failed'),
  });

  function set<K extends keyof RecordingConfig>(k: K, v: RecordingConfig[K]) {
    setCfg(p => (p ? { ...p, [k]: v } : p));
  }

  if (isLoading || !cfg) {
    return (
      <div className="space-y-3 max-w-2xl">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const anyCloudStorage = cfg.storageBackend !== 'local';

  return (
    <div className="space-y-5 max-w-2xl">
      <SectionHeader
        title="Recording & Compliance"
        description="Control call recording, PCI DSS compliance pausing, storage, and data retention."
      />

      {/* Channels */}
      <Card icon={Mic} title="Recording channels" description="Enable recording per communication channel">
        <div className="space-y-2 divide-y divide-gray-50">
          {(
            [
              { key: 'pstn' as const,      label: 'PSTN / SIP calls',    description: 'Traditional telephone calls' },
              { key: 'webrtc' as const,     label: 'WebRTC (browser)',    description: 'Agent browser softphone calls' },
              { key: 'whatsapp' as const,   label: 'WhatsApp voice',      description: 'Voice notes and calls via WhatsApp' },
            ]
          ).map(({ key, label, description }) => (
            <div key={key} className="pt-2 first:pt-0">
              <ToggleRow
                label={label}
                description={description}
                checked={cfg.enabledChannels[key]}
                onCheckedChange={v => set('enabledChannels', { ...cfg.enabledChannels, [key]: v })}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Announcement */}
      <Card icon={Volume2} title="Call announcement" description="Play a legal disclaimer before recording starts">
        <ToggleRow
          label="Play recording announcement"
          description="Required by law in many jurisdictions"
          checked={cfg.announcementEnabled}
          onCheckedChange={v => set('announcementEnabled', v)}
        />
        {cfg.announcementEnabled && (
          <div className="space-y-1 mt-1">
            <Label className="text-xs text-muted-foreground">Announcement text (TTS)</Label>
            <textarea
              value={cfg.announcementText}
              onChange={e => set('announcementText', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand-primary h-16"
            />
          </div>
        )}
      </Card>

      {/* PCI DSS */}
      <Card
        icon={ShieldCheck}
        title="PCI DSS compliance"
        description="Automatically pause recording during payment card data collection (PCI DSS §3.2)"
      >
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-start gap-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Pausing recording during card collection is mandatory for PCI DSS Level 1 compliance.
          The pause/resume API is called automatically by the agent softphone.
        </div>
        <div className="space-y-2 divide-y divide-gray-50">
          <ToggleRow
            label="Auto-pause on payment collection"
            description="Pause when agent triggers PCI mode in the call UI"
            checked={cfg.pciAutoPause}
            onCheckedChange={v => set('pciAutoPause', v)}
          />
          <div className="pt-2">
            <ToggleRow
              label="Auto-resume on hangup"
              description="Resume recording automatically when the call ends"
              checked={cfg.pciResumeOnHangup}
              onCheckedChange={v => set('pciResumeOnHangup', v)}
            />
          </div>
        </div>
      </Card>

      {/* Storage */}
      <Card icon={HardDrive} title="Storage & retention" description="Where recordings are saved and how long they are kept">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Storage backend</Label>
            <Select
              value={cfg.storageBackend}
              onValueChange={v => set('storageBackend', v as RecordingConfig['storageBackend'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local disk (MinIO)</SelectItem>
                <SelectItem value="s3">AWS S3</SelectItem>
                <SelectItem value="azure">Azure Blob</SelectItem>
                <SelectItem value="gcs">Google Cloud Storage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {anyCloudStorage && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bucket / container name</Label>
              <Input
                value={cfg.storageBucket}
                onChange={e => set('storageBucket', e.target.value)}
                placeholder="blinkone-recordings"
                className="font-mono text-sm"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Retention period (days)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={7}
                max={3650}
                value={cfg.retentionDays}
                onChange={e => set('retentionDays', Number(e.target.value))}
                className="w-24 h-8 text-sm"
              />
              <input
                type="range"
                min={7}
                max={365}
                value={Math.min(365, cfg.retentionDays)}
                onChange={e => set('retentionDays', Number(e.target.value))}
                className="flex-1 accent-brand-primary"
              />
              <span className="text-xs text-muted-foreground w-12">{cfg.retentionDays}d</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Who can access recordings</Label>
            <Select
              value={cfg.accessRestriction}
              onValueChange={v => set('accessRestriction', v as RecordingConfig['accessRestriction'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_agents">All agents</SelectItem>
                <SelectItem value="supervisors_only">Supervisors & admins only</SelectItem>
                <SelectItem value="admins_only">Admins only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ToggleRow
          label="Encrypt recordings at rest"
          description="AES-256 encryption before writing to storage"
          checked={cfg.encryptAtRest}
          onCheckedChange={v => set('encryptAtRest', v)}
        />
      </Card>

      <div className="flex justify-end">
        <Button
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save recording settings'}
        </Button>
      </div>
    </div>
  );
}
