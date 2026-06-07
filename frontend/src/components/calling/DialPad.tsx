'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, Phone } from 'lucide-react';
import { createSession } from '@/lib/api/calls';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store/auth';
import { useCallsStore } from '@/lib/store/calls';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

/** Strip characters that aren't valid in a phone number */
function sanitizePhone(raw: string): string {
  return raw.replace(/[^\d+\-\s()]/g, '');
}

interface Props {
  transport?: 'pstn' | 'whatsapp' | 'webrtc';
  onCall?: (number: string, transport: 'pstn' | 'whatsapp' | 'webrtc') => void;
  disabled?: boolean;
  className?: string;
  /** Pre-fill dial pad (e.g. /calling?dial=+968...) */
  initialNumber?: string;
}

export function DialPad({ transport: transportProp, onCall, disabled, className, initialNumber }: Props) {
  const [number, setNumber] = useState(initialNumber ?? '');
  const [tab, setTab] = useState<'pstn' | 'whatsapp' | 'webrtc'>('pstn');
  const [calling, setCalling] = useState(false);
  const [dtmfFlash, setDtmfFlash] = useState<string | null>(null);
  const dtmfTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const makeCall = useCallsStore(s => s.makeCall);
  const sipControls = useCallsStore(s => s.sipControls);
  const sipRegistered = useCallsStore(s => s.sipRegistered);
  const { user } = useAuthStore();
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const activeCall = useCallsStore(s => s.activeCall);

  const transport = transportProp ?? tab;
  const isInCall = !!activeCall && activeCall.status === 'connected';

  const pressKey = useCallback(
    (key: string) => {
      if (isInCall && (transport === 'pstn' || transport === 'webrtc')) {
        sipControls?.sendDTMF(key);
        // Visual flash feedback
        if (dtmfTimer.current) clearTimeout(dtmfTimer.current);
        setDtmfFlash(key);
        dtmfTimer.current = setTimeout(() => setDtmfFlash(null), 350);
        return;
      }
      setNumber(n => n + key);
    },
    [isInCall, transport, sipControls],
  );

  // Cleanup dtmf timer on unmount
  useEffect(() => () => { if (dtmfTimer.current) clearTimeout(dtmfTimer.current); }, []);

  useEffect(() => {
    if (initialNumber?.trim()) setNumber(sanitizePhone(initialNumber.trim()));
  }, [initialNumber]);

  const handleCall = useCallback(async () => {
    const n = number.trim();
    if (!n || calling) return;

    if (onCall) {
      onCall(n, transport);
      setNumber('');
      return;
    }

    setCalling(true);
    try {
      if (transport === 'pstn' || transport === 'webrtc') {
        if (!makeCall || !sipRegistered) {
          toast.error('Softphone not connected — wait for the green "Softphone connected" status.');
          return;
        }
        makeCall(n);
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
  }, [number, calling, onCall, transport, makeCall, sipRegistered, user, setActiveCall, isDemoDataEnabled]);

  // Global keyboard handler: digit keys feed the pad, Enter calls, Backspace deletes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (/^[0-9*#]$/.test(e.key)) {
        e.preventDefault();
        pressKey(e.key);
      } else if (e.key === 'Backspace' && !isInCall) {
        e.preventDefault();
        setNumber(n => n.slice(0, -1));
      } else if (e.key === 'Enter' && !isInCall) {
        e.preventDefault();
        void handleCall();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, isInCall, pressKey, handleCall]);

  const callDisabled =
    !number.trim() || disabled || calling || isInCall ||
    ((transport === 'pstn' || transport === 'webrtc') && !sipRegistered);

  return (
    <div className={cn('p-4 flex flex-col gap-2', className)}>
      {/* Transport tab (only when not controlled by parent) */}
      {!transportProp && (
        <div className="flex border border-gray-200 rounded-md overflow-hidden text-xs">
          {(
            [
              { key: 'pstn' as const, label: 'PSTN' },
              { key: 'whatsapp' as const, label: 'WhatsApp' },
              { key: 'webrtc' as const, label: 'WebRTC' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 py-1.5 font-medium transition-colors',
                tab === key ? 'bg-blue-50 text-brand-primary' : 'text-gray-500 hover:bg-gray-50',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Number input */}
      <div className="relative">
        <input
          type="tel"
          value={number}
          onChange={e => setNumber(sanitizePhone(e.target.value))}
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
        <p className="text-center text-xs text-muted-foreground">
          Tap keys to send DTMF tones
        </p>
      )}

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-2">
        {KEYPAD_ROWS.flat().map(key => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={isInCall ? `Send DTMF ${key}` : `Dial ${key}`}
            onClick={() => pressKey(key)}
            className={cn(
              'h-12 rounded-lg text-base font-medium transition-all disabled:opacity-50',
              dtmfFlash === key
                ? 'bg-brand-primary/20 text-brand-primary scale-95'
                : 'bg-muted hover:bg-muted/70 active:scale-95',
            )}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Call button — sits directly under keypad */}
      <Button
        type="button"
        onClick={() => void handleCall()}
        disabled={callDisabled}
        aria-label={`Call ${number || 'number'} via ${transport}`}
        className="w-full mt-1 bg-green-500 hover:bg-green-600 text-white shrink-0"
      >
        <Phone className="w-4 h-4 me-2" aria-hidden />
        {calling ? 'Calling…' : 'Call'}
      </Button>

      {/* Hint when SIP not connected */}
      {(transport === 'pstn' || transport === 'webrtc') && !sipRegistered && !isInCall && (
        <p className="text-center text-[11px] text-amber-700">
          Waiting for softphone registration…
        </p>
      )}
    </div>
  );
}
