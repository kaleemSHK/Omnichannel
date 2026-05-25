'use client';

import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChannelConfigFields } from './ChannelConfigFields';
import { CHANNEL_META } from './InboxCard';
import { useCreateInbox } from '@/hooks/useInboxAdmin';
import type { ChannelType } from '@/lib/api/inboxes';

const CHANNEL_TYPES: ChannelType[] = [
  'Channel::Whatsapp',
  'Channel::Email',
  'Channel::WebWidget',
  'Channel::TwilioSms',
  'Channel::Voice',
  'Channel::Api',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InboxCreateWizard({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [channelType, setChannelType] = useState<ChannelType | null>(null);
  const [name, setName] = useState('');
  const [channelValues, setChannelValues] = useState<Record<string, string>>({});
  const { mutate: createInbox, isPending } = useCreateInbox();

  function reset() {
    setStep(1);
    setChannelType(null);
    setName('');
    setChannelValues({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleCreate() {
    if (!channelType || !name.trim()) return;
    createInbox(
      {
        name: name.trim(),
        channel: { type: channelType, ...channelValues },
      },
      { onSuccess: handleClose },
    );
  }

  const STEPS = ['Channel', 'Details', 'Review'];

  return (
    <Sheet open={open} onClose={handleClose} title="New inbox">
      <p className="text-xs text-muted-foreground -mt-2 mb-4">Connect a new channel to BlinkOne</p>

      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={cn(
                'w-6 h-6 rounded-full text-xs font-medium flex items-center justify-center transition-colors',
                step > i + 1
                  ? 'bg-brand-primary text-white'
                  : step === i + 1
                    ? 'bg-brand-primary text-white ring-2 ring-brand-primary/30'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                'text-xs',
                step === i + 1 ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Select a channel type</p>
          <div className="grid grid-cols-2 gap-2">
            {CHANNEL_TYPES.map(ct => {
              const { label, Icon, color } = CHANNEL_META[ct] ?? {
                label: ct,
                Icon: () => null,
                color: 'bg-gray-50 text-gray-600',
              };
              return (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setChannelType(ct)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-sm font-medium',
                    channelType === ct
                      ? 'border-brand-primary bg-brand-primary/5'
                      : 'border-border hover:border-brand-primary/40 hover:bg-muted/30',
                  )}
                  aria-pressed={channelType === ct}
                >
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
                    <Icon size={20} aria-hidden />
                  </div>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end pt-2">
            <Button
              disabled={!channelType}
              onClick={() => setStep(2)}
              className="bg-brand-primary hover:bg-brand-primary/90"
            >
              Next <ChevronRight size={15} className="ms-1" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && channelType && (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="new-inbox-name" className="text-xs">
              Inbox name *
            </Label>
            <Input
              id="new-inbox-name"
              placeholder={`e.g. ${CHANNEL_META[channelType]?.label ?? 'My'} Support`}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Channel configuration
            </p>
            <ChannelConfigFields
              channelType={channelType}
              values={channelValues}
              onChange={(k, v) => setChannelValues(prev => ({ ...prev, [k]: v }))}
            />
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft size={15} className="me-1" aria-hidden /> Back
            </Button>
            <Button
              disabled={!name.trim()}
              onClick={() => setStep(3)}
              className="bg-brand-primary hover:bg-brand-primary/90"
            >
              Next <ChevronRight size={15} className="ms-1" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && channelType && (
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</p>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center',
                  CHANNEL_META[channelType]?.color,
                )}
              >
                {(() => {
                  const Icon = CHANNEL_META[channelType]?.Icon;
                  return Icon ? <Icon size={16} aria-hidden /> : null;
                })()}
              </div>
              <div>
                <p className="font-medium text-sm">{name}</p>
                <p className="text-xs text-muted-foreground">{CHANNEL_META[channelType]?.label}</p>
              </div>
            </div>
            {Object.entries(channelValues)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <span className="text-muted-foreground capitalize w-28 shrink-0">
                    {k.replace(/_/g, ' ')}
                  </span>
                  <span className="truncate">{k.includes('key') ? '••••••••' : v}</span>
                </div>
              ))}
          </div>
          <p className="text-xs text-muted-foreground">
            You can assign agents and configure working hours after creation.
          </p>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft size={15} className="me-1" aria-hidden /> Back
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending}
              className="bg-brand-primary hover:bg-brand-primary/90"
            >
              {isPending ? 'Creating…' : 'Create inbox'}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
