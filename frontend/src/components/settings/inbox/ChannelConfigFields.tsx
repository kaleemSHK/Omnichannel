'use client';

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
        <div className="space-y-3">
          <Field
            label="Email address *"
            id="email"
            type="email"
            placeholder="support@company.com"
            value={values.email ?? ''}
            onChange={v => onChange('email', v)}
          />
          <ToggleRow
            label="Configure IMAP/SMTP now"
            checked={values.imap_enabled === 'true'}
            onCheckedChange={v => onChange('imap_enabled', v ? 'true' : 'false')}
          />
          {values.imap_enabled === 'true' && (
            <>
              <Field
                label="IMAP server"
                id="imap_address"
                placeholder="imap.gmail.com"
                value={values.imap_address ?? ''}
                onChange={v => onChange('imap_address', v)}
              />
              <Field
                label="IMAP port"
                id="imap_port"
                placeholder="993"
                value={values.imap_port ?? '993'}
                onChange={v => onChange('imap_port', v)}
              />
              <Field
                label="IMAP password"
                id="imap_password"
                type="password"
                value={values.imap_password ?? ''}
                onChange={v => onChange('imap_password', v)}
              />
              <ToggleRow
                label="Enable SMTP (outbound)"
                checked={values.smtp_enabled === 'true'}
                onCheckedChange={v => onChange('smtp_enabled', v ? 'true' : 'false')}
              />
              {values.smtp_enabled === 'true' && (
                <>
                  <Field
                    label="SMTP server"
                    id="smtp_address"
                    placeholder="smtp.gmail.com"
                    value={values.smtp_address ?? ''}
                    onChange={v => onChange('smtp_address', v)}
                  />
                  <Field
                    label="SMTP port"
                    id="smtp_port"
                    placeholder="587"
                    value={values.smtp_port ?? '587'}
                    onChange={v => onChange('smtp_port', v)}
                  />
                  <Field
                    label="SMTP password"
                    id="smtp_password"
                    type="password"
                    value={values.smtp_password ?? ''}
                    onChange={v => onChange('smtp_password', v)}
                  />
                </>
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Without IMAP/SMTP, Chatwoot creates a forward-to address after setup (shown on completion).
          </p>
        </div>
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
        </div>
      );
    case 'Channel::Whatsapp':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Provider</Label>
            <Select
              value={values.provider ?? 'whatsapp_cloud'}
              onValueChange={v => onChange('provider', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp_cloud">WhatsApp Cloud API</SelectItem>
                <SelectItem value="360dialog">360dialog</SelectItem>
                <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field
            label="Phone number (E.164)"
            id="wa_phone"
            type="tel"
            placeholder="+96891234567"
            value={values.phone_number ?? ''}
            onChange={v => onChange('phone_number', v)}
          />
          <Field
            label="API key / access token"
            id="wakey"
            type="password"
            placeholder="Provider API key"
            value={values.whatsapp_api_key ?? ''}
            onChange={v => onChange('whatsapp_api_key', v)}
          />
        </div>
      );
    case 'Channel::Telegram':
      return (
        <div className="space-y-3">
          <Field
            label="Bot token *"
            id="tg_token"
            type="password"
            placeholder="123456:ABC-DEF..."
            value={values.bot_token ?? ''}
            onChange={v => onChange('bot_token', v)}
          />
          <p className="text-xs text-muted-foreground">
            Create a bot via @BotFather on Telegram and paste the token here.
          </p>
        </div>
      );
    case 'Channel::Line':
      return (
        <div className="space-y-3">
          <Field
            label="Channel ID *"
            id="line_id"
            value={values.line_channel_id ?? ''}
            onChange={v => onChange('line_channel_id', v)}
          />
          <Field
            label="Channel secret *"
            id="line_secret"
            type="password"
            value={values.line_channel_secret ?? ''}
            onChange={v => onChange('line_channel_secret', v)}
          />
          <Field
            label="Channel access token *"
            id="line_token"
            type="password"
            value={values.line_channel_token ?? ''}
            onChange={v => onChange('line_channel_token', v)}
          />
        </div>
      );
    case 'Channel::WebWidget':
      return (
        <div className="space-y-3">
          <Field
            label="Website URL *"
            id="wurl"
            type="url"
            placeholder="https://www.yourcompany.com"
            value={values.website_url ?? ''}
            onChange={v => onChange('website_url', v)}
          />
          <Field
            label="Widget title"
            id="wtitle"
            placeholder="Chat with us"
            value={values.welcome_title ?? ''}
            onChange={v => onChange('welcome_title', v)}
          />
          <Field
            label="Tagline"
            id="wtagline"
            placeholder="We typically reply in a few minutes"
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
            Voice uses BlinkOne telephony. This creates an API inbox for call events — configure SIP in
            PSTN settings.
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
        <Field
          label="Webhook URL (optional)"
          id="apihook"
          type="url"
          placeholder="https://your-server.com/webhooks/inbox"
          value={values.webhook_url ?? ''}
          onChange={v => onChange('webhook_url', v)}
        />
      );
    default:
      return null;
  }
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
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
