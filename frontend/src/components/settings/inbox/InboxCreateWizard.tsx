'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChannelConfigFields } from './ChannelConfigFields';
import { CHANNEL_META } from './InboxCard';
import { MetaFacebookConnect } from './MetaFacebookConnect';
import { MetaInstagramConnect } from './MetaInstagramConnect';
import { InboxWizardAgentPicker } from './InboxWizardAgentPicker';
import { InboxWidgetEmbed } from './InboxWidgetEmbed';
import { useCreateInbox } from '@/hooks/useInboxAdmin';
import * as InboxAPI from '@/lib/api/inboxes';
import { validateCreateInboxPayload, type ChannelType, type InboxDetail } from '@/lib/api/inboxes';

const CHANNEL_TYPES: ChannelType[] = [
  'Channel::WebWidget',
  'Channel::Email',
  'Channel::Whatsapp',
  'Channel::TwilioSms',
  'Channel::Telegram',
  'Channel::Line',
  'Channel::FacebookPage',
  'Channel::Instagram',
  'Channel::Api',
  'Channel::Voice',
];

const META_OAUTH_CHANNELS: ChannelType[] = ['Channel::FacebookPage', 'Channel::Instagram'];

const STEPS = ['Channel', 'Configure', 'Agents', 'Review'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InboxCreateWizard({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [channelType, setChannelType] = useState<ChannelType | null>(null);
  const [name, setName] = useState('');
  const [channelValues, setChannelValues] = useState<Record<string, string>>({});
  const [agentIds, setAgentIds] = useState<number[]>([]);
  const [created, setCreated] = useState<InboxDetail | null>(null);
  const { mutateAsync: createInbox, isPending } = useCreateInbox();

  function reset() {
    setStep(1);
    setChannelType(null);
    setName('');
    setChannelValues({});
    setAgentIds([]);
    setCreated(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function isMetaOAuthChannel(type: ChannelType | null): boolean {
    return !!type && META_OAUTH_CHANNELS.includes(type);
  }

  function canProceedFromConfigure(): boolean {
    if (isMetaOAuthChannel(channelType)) return false;
    if (!name.trim()) return false;
    if (channelType === 'Channel::TwilioSms') {
      return !!(channelValues.account_sid && channelValues.auth_token && channelValues.phone_number);
    }
    if (channelType === 'Channel::Email') {
      return !!channelValues.email;
    }
    if (channelType === 'Channel::Telegram') {
      return !!channelValues.bot_token;
    }
    if (channelType === 'Channel::Line') {
      return !!(
        channelValues.line_channel_id &&
        channelValues.line_channel_secret &&
        channelValues.line_channel_token
      );
    }
    return true;
  }

  async function handleCreate() {
    if (!channelType || !name.trim()) return;
    const payload = {
      name: name.trim(),
      channel: { type: channelType, ...channelValues },
    };
    const validationError = validateCreateInboxPayload(payload);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    try {
      let inbox = await createInbox(payload);
      if (agentIds.length) {
        await InboxAPI.updateInboxMembers(inbox.id, agentIds);
      }
      if (channelType === 'Channel::WebWidget' && !inbox.website_token) {
        inbox = await InboxAPI.getInbox(inbox.id);
      }
      setCreated(inbox);
      setStep(5);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create inbox');
    }
  }

  const showSuccess = step === 5 && created;

  return (
    <Sheet open={open} onClose={handleClose} title={showSuccess ? 'Inbox created' : 'New inbox'}>
      {!showSuccess && (
        <>
          <p className="text-xs text-muted-foreground -mt-2 mb-4">
            Connect a channel — same flow as Chatwoot Settings → Inboxes → Add inbox
          </p>
          <div className="flex items-center gap-1 mb-6 flex-wrap">
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
        </>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Choose a channel</p>
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
          {channelType === 'Channel::FacebookPage' ? (
            <MetaFacebookConnect
              defaultInboxName={name}
              onConnected={async inbox => {
                try {
                  const detail = await InboxAPI.getInbox(inbox.id);
                  if (agentIds.length) {
                    await InboxAPI.updateInboxMembers(detail.id, agentIds);
                  }
                  setCreated(detail);
                  setStep(5);
                } catch {
                  setCreated({
                    id: inbox.id,
                    name: inbox.name,
                    channel_type: 'Channel::FacebookPage',
                    working_hours_enabled: false,
                  });
                  setStep(5);
                }
              }}
            />
          ) : channelType === 'Channel::Instagram' ? (
            <MetaInstagramConnect />
          ) : (
            <>
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
            </>
          )}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft size={15} className="me-1" aria-hidden /> Back
            </Button>
            {!isMetaOAuthChannel(channelType) && (
              <Button
                disabled={!canProceedFromConfigure()}
                onClick={() => setStep(3)}
                className="bg-brand-primary hover:bg-brand-primary/90"
              >
                Next <ChevronRight size={15} className="ms-1" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}

      {step === 3 && channelType && (
        <div className="space-y-4">
          <InboxWizardAgentPicker selected={agentIds} onChange={setAgentIds} />
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft size={15} className="me-1" aria-hidden /> Back
            </Button>
            <Button onClick={() => setStep(4)} className="bg-brand-primary hover:bg-brand-primary/90">
              Next <ChevronRight size={15} className="ms-1" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {step === 4 && channelType && (
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
            <p className="text-xs text-muted-foreground">
              {agentIds.length} agent{agentIds.length !== 1 ? 's' : ''} will be assigned
            </p>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(3)}>
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

      {showSuccess && created && (
        <div className="space-y-5">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <p className="font-medium">{created.name}</p>
            <p className="text-xs mt-1">Inbox is ready. Agents can now receive conversations.</p>
          </div>
          {created.channel_type === 'Channel::WebWidget' && created.website_token && (
            <InboxWidgetEmbed websiteToken={created.website_token} inboxName={created.name} />
          )}
          {created.channel_type === 'Channel::Email' && created.forward_to_email && (
            <div className="text-xs text-muted-foreground border rounded-lg p-3">
              Forward emails to:{' '}
              <strong className="text-foreground">{created.forward_to_email}</strong>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleClose} className="bg-brand-primary hover:bg-brand-primary/90">
              Done
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
