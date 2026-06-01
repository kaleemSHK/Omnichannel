'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnswerCall, useDeclineCall } from '@/lib/hooks/useCalls';
import { clearIncomingCallUi } from '@/lib/calling/incoming-call-ui';
import { useCallsStore } from '@/lib/store/calls';
import {
  callMatchesConversation,
  resolveCallerName,
  transportLabel,
} from '@/lib/utils/calling';
import { cn } from '@/lib/utils/cn';
import type { CWConversation } from '@/types';

interface Props {
  conversation: CWConversation;
}

export function ConversationIncomingCallBanner({ conversation }: Props) {
  const router = useRouter();
  const incomingCalls = useCallsStore(s => s.incomingCalls);
  const contactCache = useCallsStore(s => s.contactCache);
  const sipControls = useCallsStore(s => s.sipControls);
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const answer = useAnswerCall();
  const decline = useDeclineCall();

  const session = useMemo(() => {
    const ringing = incomingCalls.filter(c => c.status === 'ringing');
    return ringing.find(c => callMatchesConversation(c, conversation)) ?? null;
  }, [incomingCalls, conversation]);

  if (!session) return null;

  const callerName = resolveCallerName(session, contactCache);
  const channel = transportLabel(session.transport);

  const onAnswer = () => {
    if (session.transport === 'pstn') sipControls?.answerCall();
    clearIncomingCallUi(session.id);
    answer.mutate(session.id, {
      onSuccess: s => setActiveCall(s),
      onError: () => setActiveCall(session),
    });
    router.push('/calling');
  };

  const onDecline = () => {
    decline.mutate(session.id);
    clearIncomingCallUi(session.id);
  };

  return (
    <div
      className={cn(
        'mx-4 mt-2 shrink-0 rounded-lg border px-4 py-3 flex flex-wrap items-center gap-3',
        session.transport === 'whatsapp'
          ? 'border-[#0f6e56]/30 bg-[#e1f5ee]'
          : 'border-amber-300/60 bg-amber-50',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-600" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            Incoming {channel} call — {callerName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            Linked to this conversation
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1 bg-green-600 hover:bg-green-700 text-white"
          onClick={onAnswer}
          disabled={answer.isPending}
        >
          <Phone className="w-3.5 h-3.5" aria-hidden />
          Answer
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 border-red-200 text-red-700 hover:bg-red-50"
          onClick={onDecline}
          disabled={decline.isPending}
        >
          <PhoneOff className="w-3.5 h-3.5" aria-hidden />
          Decline
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => router.push('/calling')}
        >
          Open Calling
        </Button>
      </div>
    </div>
  );
}
