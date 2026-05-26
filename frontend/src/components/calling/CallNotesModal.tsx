'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/Dialog';
import { addCallNotes } from '@/lib/api/calls';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useCallsStore } from '@/lib/store/calls';
import { resolveCallerName } from '@/lib/utils/calling';
import { cn } from '@/lib/utils/cn';

const DISPOSITIONS = [
  { value: 'resolved', label: 'Resolved' },
  { value: 'follow_up', label: 'Follow-up Required' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'technical', label: 'Technical Issue' },
];

export function CallNotesModal() {
  const acwCall = useCallsStore(s => s.acwCall);
  const setAcwCall = useCallsStore(s => s.setAcwCall);
  const contactCache = useCallsStore(s => s.contactCache);

  const [disposition, setDisposition] = useState('resolved');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!acwCall) return null;

  const contactName = resolveCallerName(acwCall, contactCache);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (!isDemoDataEnabled()) {
        await addCallNotes(acwCall.id, { outcome: disposition, notes });
      }
      toast.success('Call notes saved');
    } catch {
      toast.error('Failed to save notes — please try again');
    } finally {
      setSaving(false);
      reset();
    }
  };

  function reset() {
    setNotes('');
    setDisposition('resolved');
    setAcwCall(null);
  }

  return (
    <Dialog open onClose={reset} title="After-call notes" className="sm:max-w-md">
      {/* Caller summary */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-full bg-blue-50 text-brand-primary flex items-center justify-center font-semibold text-sm shrink-0">
          {contactName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{contactName}</p>
          <p className="text-xs text-muted-foreground">
            {acwCall.customerPhone} ·{' '}
            <span
              className={cn(
                'font-medium',
                acwCall.direction === 'inbound' ? 'text-blue-600' : 'text-green-700',
              )}
            >
              {acwCall.direction}
            </span>
          </p>
        </div>
        <span className="ms-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">
          Wrap-up
        </span>
      </div>

      <div className="space-y-4">
        {/* Disposition chips */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            Call outcome
          </label>
          <div className="flex flex-wrap gap-2">
            {DISPOSITIONS.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDisposition(d.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  disposition === d.value
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes textarea */}
        <div>
          <label
            htmlFor="acw-notes"
            className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
          >
            Notes{' '}
            <span className="text-gray-400 font-normal normal-case">(optional)</span>
          </label>
          <textarea
            id="acw-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Summarise the call, follow-up actions, customer request…"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none placeholder:text-gray-400"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
            Skip
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="bg-brand-primary hover:bg-brand-primary/90"
          >
            <CheckCircle className="w-3.5 h-3.5 me-1.5" aria-hidden />
            {saving ? 'Saving…' : 'Save notes'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
