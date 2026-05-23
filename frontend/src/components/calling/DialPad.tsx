'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';
import { createSession } from '@/lib/api/calls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useJsSip } from '@/lib/hooks/useJsSip';
import { useAuthStore } from '@/lib/store/auth';
import { useCallsStore } from '@/lib/store/calls';

const KEYS = [
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
  const { makeCall } = useJsSip();
  const { user } = useAuthStore();
  const setActiveCall = useCallsStore(s => s.setActiveCall);

  const transport = transportProp ?? tab;

  async function handleCall() {
    const n = number.trim();
    if (!n) return;
    if (onCall) {
      onCall(n, transport);
      return;
    }
    if (transport === 'pstn') {
      makeCall(n);
      return;
    }
    if (!user) return;
    const session = await createSession({
      roomId: `wa-${Date.now()}`,
      chatwootAccountId: user.chatwootAccountId,
      agentLabel: user.name,
      customerPhone: n,
      transport: 'whatsapp',
      direction: 'outbound',
    });
    setActiveCall(session);
  }

  return (
    <div className="p-4 space-y-4 h-full flex flex-col">
      {!transportProp && (
        <div className="flex border border-gray-200 rounded-md overflow-hidden text-xs">
          {(['pstn', 'whatsapp'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? 'flex-1 py-1.5 bg-blue-50 text-brand-primary font-medium capitalize'
                  : 'flex-1 py-1.5 text-gray-500 capitalize'
              }
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <Input
        value={number}
        onChange={e => setNumber(e.target.value)}
        className="text-center text-lg font-mono"
        placeholder="+968"
        disabled={disabled}
      />
      <div className="grid grid-cols-3 gap-2 flex-1">
        {KEYS.flat().map(key => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => setNumber(n => n + key)}
            className="h-12 rounded-lg bg-muted hover:bg-muted/80 text-base font-medium transition-colors disabled:opacity-50"
          >
            {key}
          </button>
        ))}
      </div>
      <Button
        type="button"
        onClick={() => void handleCall()}
        disabled={!number.trim() || disabled}
        className="w-full bg-green-500 hover:bg-green-600 text-white"
      >
        <Phone className="w-4 h-4 me-2" />
        Call
      </Button>
    </div>
  );
}
