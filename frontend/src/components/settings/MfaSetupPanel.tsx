'use client';

/**
 * MfaSetupPanel — Sprint 2 M01
 *
 * Settings panel for enrolling / disabling TOTP MFA.
 * Shows:
 *   - Current status (enabled / disabled)
 *   - Enroll flow: QR code + manual key + 6-digit confirm input
 *   - Disable option (with confirmation)
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, ShieldCheck, ShieldOff, Copy, CheckCircle, Loader2, QrCode } from 'lucide-react';
import {
  getMfaStatus,
  enrollMfa,
  confirmMfaEnrollment,
  disableMfa,
  type MfaEnrollResponse,
} from '@/lib/api/mfa';

// ─── QR code via Google Charts (no external npm dep) ─────────────────────────

function QrImage({ uri, size = 200 }: { uri: string; size?: number }) {
  const url = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(uri)}&choe=UTF-8`;
  return (
    <img
      src={url}
      alt="TOTP QR code — scan with your authenticator app"
      width={size}
      height={size}
      className="rounded-lg border border-gray-200"
    />
  );
}

// ─── Enroll flow ──────────────────────────────────────────────────────────────

function EnrollFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'scan' | 'verify'>('scan');
  const [enrollment, setEnrollment] = useState<MfaEnrollResponse | null>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();

  const startEnroll = useMutation({
    mutationFn: enrollMfa,
    onSuccess: (data) => {
      setEnrollment(data);
      setStep('scan');
    },
  });

  const confirm = useMutation({
    mutationFn: () => confirmMfaEnrollment(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mfa-status'] });
      onDone();
    },
  });

  function copySecret() {
    if (enrollment?.secret) {
      navigator.clipboard.writeText(enrollment.secret).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!enrollment) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-600 mb-4">
          Use any TOTP authenticator app (Google Authenticator, Authy, 1Password, Bitwarden…)
          to add a second factor to your BlinkOne account.
        </p>
        <button
          onClick={() => startEnroll.mutate()}
          disabled={startEnroll.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {startEnroll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          Generate QR Code
        </button>
        {startEnroll.isError && (
          <p className="text-sm text-red-600 mt-2">
            {(startEnroll.error as Error).message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {step === 'scan' && (
        <>
          <div className="flex flex-col items-center gap-4">
            <QrImage uri={enrollment.uri} />
            <p className="text-sm text-gray-600 text-center">
              Scan this QR code in your authenticator app, then click <strong>Continue</strong>.
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs text-gray-500 mb-1 font-medium">Manual entry key</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm text-gray-800 break-all">
                {enrollment.secret}
              </code>
              <button
                onClick={copySecret}
                className="shrink-0 text-gray-400 hover:text-gray-700"
                aria-label="Copy secret"
              >
                {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Issuer: {enrollment.issuer} · Account: {enrollment.label}
            </p>
          </div>

          <button
            onClick={() => setStep('verify')}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Continue → Verify Code
          </button>
        </>
      )}

      {step === 'verify' && (
        <>
          <p className="text-sm text-gray-600 text-center">
            Enter the 6-digit code currently shown in your authenticator app to confirm setup.
          </p>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full text-center font-mono text-2xl tracking-widest border-2 border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
          />

          {confirm.isError && (
            <p className="text-sm text-red-600 text-center">
              {(confirm.error as Error).message}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setStep('scan'); setCode(''); }}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => confirm.mutate()}
              disabled={code.length !== 6 || confirm.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm & Enable
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function MfaSetupPanel() {
  const qc = useQueryClient();
  const [enrolling, setEnrolling] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: getMfaStatus,
    staleTime: 60_000,
  });

  const disable = useMutation({
    mutationFn: disableMfa,
    onSuccess: () => {
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ['mfa-status'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading MFA status…
      </div>
    );
  }

  const enabled = status?.enabled ?? false;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {enabled ? (
            <ShieldCheck className="h-6 w-6 text-green-500 shrink-0" />
          ) : (
            <Shield className="h-6 w-6 text-gray-400 shrink-0" />
          )}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Two-Factor Authentication (TOTP)
            </h3>
            <p className={`text-xs mt-0.5 ${enabled ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
              {enabled ? '✓ Enabled' : 'Not enabled'}
            </p>
          </div>
        </div>

        {enabled && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <ShieldOff className="h-4 w-4" />
            Disable
          </button>
        )}
      </div>

      {/* Disable confirmation */}
      {confirming && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-3">
          <p className="text-sm text-red-700 font-medium">
            Are you sure you want to disable MFA?
          </p>
          <p className="text-xs text-red-600">
            Your account will be protected by password only. This reduces your security posture.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => disable.mutate()}
              disabled={disable.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {disable.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Disable MFA
            </button>
          </div>
          {disable.isError && (
            <p className="text-xs text-red-600">{(disable.error as Error).message}</p>
          )}
        </div>
      )}

      {/* Enable / Enroll flow */}
      {!enabled && !enrolling && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Add an extra layer of security by requiring a time-based one-time password (TOTP)
            when you sign in.
          </p>
          <button
            onClick={() => setEnrolling(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Shield className="h-4 w-4" />
            Set up Authenticator App
          </button>
        </div>
      )}

      {enrolling && !enabled && (
        <EnrollFlow onDone={() => setEnrolling(false)} />
      )}

      {enabled && !confirming && (
        <p className="text-xs text-gray-500">
          Your account is protected with an authenticator app. Every sign-in requires your
          password plus a 6-digit code from the app.
        </p>
      )}
    </div>
  );
}
