'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ChannelType } from '@/lib/api/inboxes';

interface Props {
  channelType: ChannelType;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function ChannelConfigFields({ channelType, values, onChange }: Props) {
  switch (channelType) {
    case 'Channel::Email':
      return (
        <Field
          label="Email address"
          id="email"
          type="email"
          placeholder="support@company.com"
          value={values.email ?? ''}
          onChange={v => onChange('email', v)}
        />
      );
    case 'Channel::TwilioSms':
      return (
        <div className="space-y-3">
          <Field
            label="Twilio Account SID *"
            id="twilio_sid"
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={values.account_sid ?? ''}
            onChange={v => onChange('account_sid', v)}
          />
          <Field
            label="Twilio Auth Token *"
            id="twilio_token"
            type="password"
            placeholder="Your Twilio auth token"
            value={values.auth_token ?? ''}
            onChange={v => onChange('auth_token', v)}
          />
          <Field
            label="Twilio phone number (E.164) *"
            id="phone"
            type="tel"
            placeholder="+96891234567"
            value={values.phone_number ?? ''}
            onChange={v => onChange('phone_number', v)}
          />
          <Field
            label="Messaging Service SID (optional)"
            id="twilio_mss"
            placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={values.messaging_service_sid ?? ''}
            onChange={v => onChange('messaging_service_sid', v)}
          />
          <p className="text-xs text-muted-foreground">
            Get these from the Twilio Console. Chatwoot validates credentials when creating the inbox.
          </p>
        </div>
      );
    case 'Channel::Whatsapp':
      return (
        <Field
          label="WhatsApp API key"
          id="wakey"
          type="password"
          placeholder="Enter API key"
          value={values.whatsapp_api_key ?? ''}
          onChange={v => onChange('whatsapp_api_key', v)}
        />
      );
    case 'Channel::WebWidget':
      return (
        <div className="space-y-3">
          <Field
            label="Website URL *"
            id="wurl"
            type="url"
            placeholder="https://app.blinksone.com"
            value={values.website_url ?? ''}
            onChange={v => onChange('website_url', v)}
          />
          <Field
            label="Widget title"
            id="wtitle"
            placeholder="Our Support Team"
            value={values.welcome_title ?? ''}
            onChange={v => onChange('welcome_title', v)}
          />
          <Field
            label="Tagline"
            id="wtagline"
            placeholder="We reply within minutes"
            value={values.welcome_tagline ?? ''}
            onChange={v => onChange('welcome_tagline', v)}
          />
          <div className="space-y-1">
            <Label htmlFor="wcolor" className="text-xs">
              Widget color
            </Label>
            <div className="flex items-center gap-2">
              <input
                id="wcolor"
                type="color"
                className="w-10 h-9 rounded border p-1 cursor-pointer"
                value={values.widget_color ?? '#3B82F6'}
                onChange={e => onChange('widget_color', e.target.value)}
              />
              <span className="text-xs text-muted-foreground">{values.widget_color ?? '#3B82F6'}</span>
            </div>
          </div>
        </div>
      );
    case 'Channel::Voice':
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Voice routing uses BlinkOne telephony. This creates an API inbox for programmatic call
            events (configure SIP in Calling settings).
          </p>
          <Field
            label="Webhook URL (optional)"
            id="voicehook"
            type="url"
            placeholder="https://app.blinksone.com/api/calls/..."
            value={values.webhook_url ?? ''}
            onChange={v => onChange('webhook_url', v)}
          />
        </div>
      );
    case 'Channel::Api':
      return (
        <p className="text-xs text-muted-foreground italic">
          No additional configuration required for API channel.
        </p>
      );
    default:
      return null;
  }
}

function Field({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
}: {
  label: string;
  id: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
