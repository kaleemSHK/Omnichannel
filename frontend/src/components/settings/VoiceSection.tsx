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
import { Mic2, Languages, Bot, Phone, Volume2 } from 'lucide-react';
import { getVoiceConfig, updateVoiceConfig, type VoiceConfig } from '@/lib/api/platform-settings';
import { useTenantId } from '@/lib/hooks/useTenantScope';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Card wrapper ──────────────────────────────────────────────────────────────

const TTS_VOICES: Record<string, string[]> = {
  'ar-OM': ['ar-OM-Wavenet-A', 'ar-OM-Wavenet-B', 'ar-OM-Standard-A'],
  'ar-SA': ['ar-XA-Wavenet-A', 'ar-XA-Wavenet-B', 'ar-XA-Standard-A'],
  'en-US': ['en-US-Wavenet-D', 'en-US-Wavenet-F', 'en-US-Neural2-A'],
  'en-GB': ['en-GB-Wavenet-A', 'en-GB-Wavenet-B', 'en-GB-Neural2-A'],
};

const LANGUAGES = [
  { value: 'ar-OM', label: 'Arabic (Oman)' },
  { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
  { value: 'ar-AE', label: 'Arabic (UAE)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'ur-PK', label: 'Urdu' },
];

// ─── Card wrapper ──────────────────────────────────────────────────────────────

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
      <div className="flex items-center gap-2 mb-1">
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────────

export function VoiceSection() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['voice-config', tenantId],
    queryFn: getVoiceConfig,
  });
  const [cfg, setCfg] = useState<VoiceConfig | null>(null);

  useEffect(() => {
    if (data) setCfg(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => updateVoiceConfig(cfg ?? {}),
    onSuccess: next => {
      qc.setQueryData(['voice-config', tenantId], next);
      setCfg(next);
      toast.success('Voice & language settings saved');
    },
    onError: (e: Error) => toast.error(e.message || 'Save failed'),
  });

  function set<K extends keyof VoiceConfig>(k: K, v: VoiceConfig[K]) {
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

  const voices = TTS_VOICES[cfg.ttsLanguage] ?? [];

  return (
    <div className="space-y-5 max-w-2xl">
      <SectionHeader
        title="Voice & Language"
        description="Configure TTS, STT, AI NLU model, hold music, and default caller ID for all IVR flows."
      />

      {/* TTS */}
      <Card icon={Volume2} title="Text-to-Speech (TTS)" description="Voice used to read IVR prompts to callers">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Row label="TTS provider">
            <Select value={cfg.ttsProvider} onValueChange={v => set('ttsProvider', v as VoiceConfig['ttsProvider'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Cloud TTS</SelectItem>
                <SelectItem value="azure">Azure Cognitive Speech</SelectItem>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                <SelectItem value="openai">OpenAI TTS</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Language">
            <Select value={cfg.ttsLanguage} onValueChange={v => {
              set('ttsLanguage', v);
              set('ttsVoice', TTS_VOICES[v]?.[0] ?? '');
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Voice">
            <Select value={cfg.ttsVoice} onValueChange={v => set('ttsVoice', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(voices.length ? voices : [cfg.ttsVoice]).map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label={`Speech speed: ${cfg.ttsSpeed.toFixed(1)}×`}>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-muted-foreground">0.5×</span>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={cfg.ttsSpeed}
                onChange={e => set('ttsSpeed', Number(e.target.value))}
                className="flex-1 accent-brand-primary"
              />
              <span className="text-[11px] text-muted-foreground">2×</span>
            </div>
          </Row>
        </div>
      </Card>

      {/* STT */}
      <Card icon={Mic2} title="Speech-to-Text (STT)" description="Transcribes caller voice for voicebot and call recording">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Row label="STT provider">
            <Select value={cfg.sttProvider} onValueChange={v => set('sttProvider', v as VoiceConfig['sttProvider'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Speech-to-Text</SelectItem>
                <SelectItem value="azure">Azure Speech</SelectItem>
                <SelectItem value="whisper">OpenAI Whisper</SelectItem>
                <SelectItem value="deepgram">Deepgram Nova</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Recognition language">
            <Select value={cfg.sttLanguage} onValueChange={v => set('sttLanguage', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Hotwords / boost phrases (comma-separated)</Label>
            <Input
              value={cfg.sttHotwords}
              onChange={e => set('sttHotwords', e.target.value)}
              placeholder="BlinkOne, LABBIK, دعم فني"
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Improves recognition accuracy for product / brand names</p>
          </div>
        </div>
      </Card>

      {/* AI NLU */}
      <Card icon={Bot} title="AI Voice Bot (NLU)" description="Language model powering intent recognition in voice bot IVR nodes">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Row label="NLU provider">
            <Select value={cfg.aiNluProvider} onValueChange={v => set('aiNluProvider', v as VoiceConfig['aiNluProvider'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="azure">Azure OpenAI</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Model">
            <Select value={cfg.aiNluModel} onValueChange={v => set('aiNluModel', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini (faster)</SelectItem>
                <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
                <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label={`Confidence threshold: ${cfg.nluConfidenceThreshold.toFixed(2)}`}>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-muted-foreground">0.5</span>
              <input
                type="range"
                min={0.5}
                max={0.99}
                step={0.01}
                value={cfg.nluConfidenceThreshold}
                onChange={e => set('nluConfidenceThreshold', Number(e.target.value))}
                className="flex-1 accent-brand-primary"
              />
              <span className="text-[11px] text-muted-foreground">0.99</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Below this threshold, the bot falls back to the human escalation path
            </p>
          </Row>
        </div>
      </Card>

      {/* Hold Music */}
      <Card icon={Languages} title="Hold music & DTMF">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable hold music</p>
              <p className="text-xs text-muted-foreground">Play audio while callers wait in queue</p>
            </div>
            <Switch checked={cfg.holdMusicEnabled} onCheckedChange={v => set('holdMusicEnabled', v)} />
          </div>
          {cfg.holdMusicEnabled && (
            <Row label="Music on hold URL (.mp3 or .wav)">
              <Input
                value={cfg.holdMusicUrl}
                onChange={e => set('holdMusicUrl', e.target.value)}
                placeholder="https://cdn.example.com/hold.mp3"
              />
            </Row>
          )}
          <Row label={`DTMF input timeout: ${cfg.dtmfTimeout}s`}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={15}
                value={cfg.dtmfTimeout}
                onChange={e => set('dtmfTimeout', Number(e.target.value))}
                className="flex-1 accent-brand-primary"
              />
              <span className="text-xs text-muted-foreground">{cfg.dtmfTimeout}s</span>
            </div>
          </Row>
        </div>
      </Card>

      {/* Caller ID */}
      <Card icon={Phone} title="Outbound caller ID" description="Default number shown to recipients of outbound calls">
        <Row label="Default outbound caller ID">
          <Input
            value={cfg.defaultOutboundCallerId}
            onChange={e => set('defaultOutboundCallerId', e.target.value)}
            placeholder="+96824001234"
            className="font-mono"
          />
        </Row>
        <p className="text-[11px] text-muted-foreground">
          Individual queues and agents can override this with their own caller ID.
        </p>
      </Card>

      <div className="flex justify-end">
        <Button
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save voice settings'}
        </Button>
      </div>
    </div>
  );
}
