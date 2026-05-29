'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck, QrCode, CheckCircle } from 'lucide-react';
import { bnFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface TotpSetup {
  secret: string;
  otpauth_url: string;
  qr_data_url: string;
}

async function setupTotp(userId: string): Promise<TotpSetup> {
  const res = await bnFetch<{ data: TotpSetup }>('platform', '/v1/totp/setup', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  return res.data;
}

async function enableTotp(userId: string, token: string): Promise<void> {
  await bnFetch<void>('platform', '/v1/totp/enable', {
    method: 'POST',
    body: JSON.stringify({ userId, token }),
  });
}

async function disableTotp(userId: string): Promise<void> {
  await bnFetch<void>('platform', `/v1/totp/${userId}`, { method: 'DELETE' });
}

export function MfaTotpSection() {
  const user = useAuthStore(s => s.user);
  const userId = String(user?.id ?? '');

  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'done'>('idle');
  const [qrData, setQrData] = useState<TotpSetup | null>(null);
  const [token, setToken] = useState('');

  const setup = useMutation({
    mutationFn: () => setupTotp(userId),
    onSuccess: data => { setQrData(data); setStep('setup'); },
    onError: () => toast.error('Failed to generate TOTP secret'),
  });

  const enable = useMutation({
    mutationFn: () => enableTotp(userId, token),
    onSuccess: () => { setStep('done'); toast.success('2FA enabled successfully'); },
    onError: () => toast.error('Invalid code — please try again'),
  });

  const disable = useMutation({
    mutationFn: () => disableTotp(userId),
    onSuccess: () => { setStep('idle'); setQrData(null); toast.success('2FA disabled'); },
  });

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-brand-primary" />
        <h3 className="text-sm font-semibold">Two-Factor Authentication (TOTP)</h3>
      </div>

      {step === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add an extra layer of security with a time-based one-time password using Google Authenticator or Authy.
          </p>
          <Button size="sm" onClick={() => setup.mutate()} disabled={setup.isPending}>
            <QrCode className="w-4 h-4 me-1" />
            {setup.isPending ? 'Generating…' : 'Set up 2FA'}
          </Button>
        </div>
      )}

      {step === 'setup' && qrData && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app, then enter the 6-digit code below.
          </p>
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrData.qr_data_url} alt="TOTP QR Code" className="w-40 h-40 rounded border" />
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Manual code: <code className="font-mono bg-muted px-1 rounded">{qrData.secret}</code>
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter 6-digit code"
              value={token}
              onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center font-mono tracking-widest"
            />
            <Button onClick={() => enable.mutate()} disabled={token.length !== 6 || enable.isPending}>
              {enable.isPending ? 'Verifying…' : 'Enable'}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <p className="text-sm font-medium">2FA is enabled</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => disable.mutate()} disabled={disable.isPending}>
            {disable.isPending ? 'Disabling…' : 'Disable 2FA'}
          </Button>
        </div>
      )}
    </div>
  );
}
