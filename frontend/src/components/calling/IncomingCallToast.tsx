'use client';

import { Phone, PhoneOff } from 'lucide-react';
import { toast } from 'sonner';
import { demoCallerName } from '@/lib/demo/callsFixture';
import type { CallSession } from '@/types';

export function showIncomingCallToast(
  call: CallSession,
  handlers: { onAnswer: () => void; onDecline: () => void },
) {
  const name = demoCallerName(call);

  toast.custom(
    id => (
      <div className="bg-white border rounded-xl shadow-xl p-4 w-72 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm">{name}</p>
            <p className="text-xs text-muted-foreground">{call.customerPhone}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              handlers.onAnswer();
              toast.dismiss(id);
            }}
            className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium"
          >
            <span className="inline-flex items-center justify-center gap-1">
              <Phone className="w-4 h-4" /> Answer
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              handlers.onDecline();
              toast.dismiss(id);
            }}
            className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium"
          >
            <span className="inline-flex items-center justify-center gap-1">
              <PhoneOff className="w-4 h-4" /> Decline
            </span>
          </button>
        </div>
      </div>
    ),
    { duration: 30_000 },
  );
}
