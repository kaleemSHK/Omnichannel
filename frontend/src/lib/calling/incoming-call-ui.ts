import { showIncomingCallToast } from '@/components/calling/IncomingCallToast';
import { searchContacts } from '@/lib/api/contacts';
import { stopIncomingRingtone } from '@/lib/telephony/ringtone';
import { useCallsStore } from '@/lib/store/calls';
import type { CallSession } from '@/types';

const toastedIds = new Set<string>();
// Same call can arrive via SIP INVITE + ActionCable `call.ringing`.
// Those paths may use different call ids, so also dedupe by caller for a short window.
const lastToastByCaller = new Map<string, number>();
const DEDUPE_WINDOW_MS = 12_000;
/** Mobile WebRTC registers as sip:customer@ — ACD rings with CRM phone; one toast only. */
let lastDeskInboundAt = 0;
const DESK_SIP_ALIASES = new Set(['customer', 'desk', 'web', 'blinkone']);

/** Postgres session from ACD / calls service — keyed by caller ANI for SIP correlation. */
const backendSessionByCaller = new Map<
  string,
  { id: string; roomId: string; expiresAt: number }
>();
const BACKEND_SESSION_TTL_MS = 5 * 60_000;

function callerKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10) || phone.trim();
}

export function registerBackendCallSession(session: CallSession): void {
  const metaName = (session.metadata as { callerName?: string } | undefined)?.callerName?.trim();
  const phone = session.customerPhone || '';
  const key = metaName && metaName.length >= 2 ? callerKey(metaName) : callerKey(phone);
  const entry = {
    id: session.id,
    roomId: session.roomId || session.id,
    expiresAt: Date.now() + BACKEND_SESSION_TTL_MS,
  };
  if (key && key.length >= 2) backendSessionByCaller.set(key, entry);
  if (session.roomId) backendSessionByCaller.set(session.roomId, entry);
  backendSessionByCaller.set('customer', entry);
  backendSessionByCaller.set('desk', entry);
  backendSessionByCaller.set('blinkone', entry);
  backendSessionByCaller.set('web', entry);
}

export function resolveBackendCallSessionId(callerPhone: string): string | null {
  const key = callerKey(callerPhone);
  const hit = backendSessionByCaller.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    backendSessionByCaller.delete(key);
    return null;
  }
  return hit.id;
}

export function resolveBackendCallRoomId(callerPhone: string): string | null {
  const key = callerKey(callerPhone);
  const hit = backendSessionByCaller.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    backendSessionByCaller.delete(key);
    return null;
  }
  return hit.roomId;
}

export function clearIncomingCallUi(callId: string) {
  toastedIds.delete(callId);
  useCallsStore.getState().removeIncomingCall(callId);
  stopIncomingRingtone();
}

type IncomingHandlers = {
  onAnswer: () => void;
  onDecline: () => void;
};

export function presentIncomingCall(
  session: CallSession,
  handlers: IncomingHandlers,
) {
  // Always register CRM session before dedupe — SIP From:customer must resolve caller name.
  registerBackendCallSession(session);

  if (toastedIds.has(session.id)) return;

  const metaName = (session.metadata as { callerName?: string } | undefined)?.callerName?.trim();
  const phone = (metaName || session.customerPhone || '').trim();
  const phoneKey = callerKey(phone);
  const isDeskSipAlias = DESK_SIP_ALIASES.has(phone.toLowerCase());
  const now = Date.now();

  if (isDeskSipAlias) {
    if (now - lastDeskInboundAt < DEDUPE_WINDOW_MS) return;
    lastDeskInboundAt = now;
  } else if (phoneKey) {
    const last = lastToastByCaller.get(phoneKey) ?? 0;
    if (now - lastDeskInboundAt < DEDUPE_WINDOW_MS) return;
    if (now - last < DEDUPE_WINDOW_MS) return;
    lastToastByCaller.set(phoneKey, now);
    lastDeskInboundAt = now;
  }

  toastedIds.add(session.id);

  const { addIncomingCall, contactCache, cacheContact } = useCallsStore.getState();
  addIncomingCall(session);

  const cached = contactCache.get(session.customerPhone);
  if (cached) {
    showIncomingCallToast({ ...session, agentLabel: cached }, handlers);
    return;
  }

  void searchContacts(session.customerPhone).then(res => {
    const rows =
      (res as { payload?: { name?: string }[] }).payload ??
      (res as { data?: { name?: string }[] }).data ??
      [];
    const contactName = rows[0]?.name ?? session.customerPhone;
    cacheContact(session.customerPhone, contactName);
    showIncomingCallToast({ ...session, agentLabel: contactName }, handlers);
  });
}

export function normalizeCallEvent(raw: {
  eventType?: string;
  type?: string;
  callId?: string;
  callSession?: CallSession;
}): { eventType: string; session: CallSession | null } {
  const session =
    raw.callSession ??
    (raw.callId
      ? ({
          id: raw.callId,
          roomId: raw.callId,
          channel: 'voice',
          customerPhone: raw.callId,
          status: 'ringing',
          startedAt: new Date().toISOString(),
          transport: 'webrtc',
          direction: 'inbound',
        } as CallSession)
      : null);
  const eventType =
    raw.eventType ??
    (raw.type === 'incoming' || raw.type === 'ringing'
      ? 'call.ringing'
      : raw.type === 'connected' || raw.type === 'answered'
        ? 'call.connected'
        : raw.type === 'ended'
          ? 'call.ended'
          : raw.type === 'missed' || raw.type === 'declined'
            ? 'call.missed'
            : String(raw.type ?? ''));
  return { eventType, session };
}
