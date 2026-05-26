import { showIncomingCallToast } from '@/components/calling/IncomingCallToast';
import { searchContacts } from '@/lib/api/contacts';
import { stopIncomingRingtone } from '@/lib/telephony/ringtone';
import { useCallsStore } from '@/lib/store/calls';
import type { CallSession } from '@/types';

const toastedIds = new Set<string>();

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
  if (toastedIds.has(session.id)) return;
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
          transport: 'pstn',
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
