'use client';

import { useCallback, useState } from 'react';
import { Delete, Phone } from 'lucide-react';
import { createSession } from '@/lib/api/calls';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store/auth';
import { useCallsStore } from '@/lib/store/calls';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { cn } from '@/lib/utils/cn';

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

interface Props {
  transport?: 'pstn' | 'whatsapp';
  onCall?: (number: string, transport: 'pstn' | 'whatsapp') => void;
  disabled?: boolean;
}

export function DialPad({ transport: transportProp, onCall, disabled }: Props) {
  const [number, setNumber] = useState('');
  const [tab, setTab] = useState<'pstn' | 'whatsapp'>('pstn');
  const [calling, setCalling] = useState(false);

  const makeCall = useCallsStore(s => s.makeCall);
  const sipControls = useCallsStore(s => s.sipControls);
  const { user } = useAuthStore();
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const activeCall = useCallsStore(s => s.activeCall);

  const transport = transportProp ?? tab;
  const isInCall = !!activeCall && activeCall.status === 'connected';

  const pressKey = useCallback(
    (key: string) => {
      if (isInCall && transport === 'pstn') {
        sipControls?.sendDTMF(key);
        return;
      }
      setNumber(n => n + key);
    },
    [isInCall, transport, sipControls],
  );

  async function handleCall() {
    const n = number.trim();
    if (!n || calling) return;

    if (onCall) {
      onCall(n, transport);
      setNumber('');
      return;
    }

    setCalling(true);
    try {
      if (transport === 'pstn') {
        makeCall?.(n);
        setNumber('');
      } else {
        if (!user) return;
        if (isDemoDataEnabled()) {
          setActiveCall({
            id: `wa-${Date.now()}`,
            tenantId: user.tenantId,
            roomId: `wa-${Date.now()}`,
            channel: 'whatsapp',
            agentLabel: user.name,
            customerPhone: n,
            status: 'ringing',
            transport: 'whatsapp',
            direction: 'outbound',
            startedAt: new Date().toISOString(),
          });
          setNumber('');
        } else {
          const session = await createSession({
            roomId: `wa-${Date.now()}`,
            chatwootAccountId: user.chatwootAccountId,
            agentLabel: user.name,
            customerPhone: n,
            transport: 'whatsapp',
            direction: 'outbound',
          });
          setActiveCall(session);
          setNumber('');
        }
      }
    } finally {
      setCalling(false);
    }
  }

  return (
    <div className="p-4 space-y-3 h-full flex flex-col">
      {!transportProp && (
        <div className="flex border border-gray-200 rounded-md overflow-hidden text-xs">
          {(['pstn', 'whatsapp'] as const).map(t => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-1.5 capitalize font-medium transition-colors',
                tab === t ? 'bg-blue-50 text-brand-primary' : 'text-gray-500 hover:bg-gray-50',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="tel"
          value={number}
          onChange={e => setNumber(e.target.value)}
          placeholder="+968"
          disabled={disabled || isInCall}
          aria-label="Phone number to dial"
          className="w-full text-center text-lg font-mono border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
        />
        {number && !isInCall && (
          <button
            type="button"
            aria-label="Clear last digit"
            onClick={() => setNumber(n => n.slice(0, -1))}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Delete size={16} />
          </button>
        )}
      </div>

      {isInCall && (
        <p className="text-center text-xs text-muted-foreground">Tap keys to send DTMF tones</p>
      )}

      <div className="grid grid-cols-3 gap-2 flex-1">
        {KEYPAD_ROWS.flat().map(key => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={`Dial ${key}`}
            onClick={() => pressKey(key)}
            className="h-12 rounded-lg bg-muted hover:bg-muted/70 active:scale-95 text-base font-medium transition-all disabled:opacity-50"
          >
            {key}
          </button>
        ))}
      </div>

      <Button
        type="button"
        onClick={() => void handleCall()}
        disabled={!number.trim() || disabled || calling || isInCall}
        aria-label={`Call ${number || 'number'} via ${transport}`}
        className="w-full bg-green-500 hover:bg-green-600 text-white"
      >
        <Phone className="w-4 h-4 me-2" aria-hidden />
        {calling ? 'Calling…' : 'Call'}
      </Button>
    </div>
  );
}
