'use client';

/**
 * MfaVerifyModal — Sprint 2 M01
 *
 * Shown on the login page when the gateway returns { mfa_required: true }.
 * The user enters their 6-digit TOTP code; on success the full JWT is returned
 * to the parent via onSuccess().
 */

import React, { useEffect, useRef, useState } from 'react';
import { Shield, Loader2, X } from 'lucide-react';
import { verifyMfaLogin } from '@/lib/api/mfa';

interface Props {
  mfaToken: string;
  onSuccess: (token: string, expiresIn: number) => void;
  onCancel: () => void;
}

export function MfaVerifyModal({ mfaToken, onSuccess, onCancel }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const code = digits.join('');

  async function submit() {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await verifyMfaLogin(mfaToken, code);
      onSuccess(result.token, result.expiresIn);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect code');
      setDigits(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  function handleChange(index: number, value: string) {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    setError('');
    if (v && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 digits entered
    if (next.every((d) => d !== '') && next.join('').length === 6) {
      // use a microtask so state is flushed before we read code
      setTimeout(() => submit(), 0);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') submit();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      setTimeout(() => submit(), 0);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-8 relative">
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Cancel"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>
        </div>

        {/* OTP input row */}
        <div className="flex gap-2 justify-center mb-4" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="\d"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-10 h-12 text-center text-xl font-mono font-semibold rounded-lg border-2 outline-none transition-colors
                ${error ? 'border-red-400 bg-red-50' : d ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
                focus:border-blue-600`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-center text-sm text-red-600 mb-4">{error}</p>
        )}

        {/* Verify button */}
        <button
          onClick={submit}
          disabled={code.length !== 6 || loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            'Verify'
          )}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          Open Google Authenticator, Authy, or any TOTP app to find your code.
        </p>
      </div>
    </div>
  );
}
