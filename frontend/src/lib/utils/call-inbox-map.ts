import type { CWInbox } from '@/types';

export type CallTransport = 'pstn' | 'whatsapp' | 'webrtc';

const TRANSPORT_INBOX: Record<
  CallTransport,
  { channelType: string; nameHints: string[]; label: string }
> = {
  pstn: {
    channelType: 'Channel::TwilioSms',
    nameHints: ['sms', 'text', 'alert'],
    label: 'SMS inbox',
  },
  webrtc: {
    channelType: 'Channel::Api',
    nameHints: ['mobile', 'mobileapp', 'app support', 'support'],
    label: 'MobileApp Support inbox',
  },
  whatsapp: {
    channelType: 'Channel::Whatsapp',
    nameHints: ['whatsapp', 'wa '],
    label: 'WhatsApp inbox',
  },
};

function scoreInbox(inbox: CWInbox, hints: string[]): number {
  const name = inbox.name.toLowerCase();
  let score = 0;
  for (const h of hints) {
    if (name.includes(h)) score += 10;
  }
  return score;
}

/** Resolve Chatwoot inbox for a call transport (PSTN → SMS, WebRTC → MobileApp API, etc.). */
export function resolveInboxForTransport(
  inboxes: CWInbox[],
  transport: CallTransport,
): CWInbox | null {
  const spec = TRANSPORT_INBOX[transport];
  const sameChannel = inboxes.filter(i => i.channel_type === spec.channelType);
  if (!sameChannel.length) return null;
  const ranked = [...sameChannel].sort(
    (a, b) => scoreInbox(b, spec.nameHints) - scoreInbox(a, spec.nameHints),
  );
  return ranked[0] ?? null;
}

export function inboxLabelForTransport(transport: CallTransport): string {
  return TRANSPORT_INBOX[transport]?.label ?? 'Inbox';
}

/** SIP junk / peer extension — not a real CRM phone number. */
export function isJunkCallPhone(phone: string | null | undefined): boolean {
  const p = String(phone ?? '').trim();
  if (!p) return true;
  if (/^[0-9a-f-]{36}$/i.test(p)) return true;
  if (/^\d{1,8}$/.test(p)) return true;
  return ['customer', 'desk', 'web', 'blinkone', 'unknown'].includes(p.toLowerCase());
}
