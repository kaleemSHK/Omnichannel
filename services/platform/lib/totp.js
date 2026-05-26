/**
 * Pure RFC 6238 TOTP implementation — Sprint 2 M01
 * Zero external dependencies. Uses only Node built-in crypto.
 *
 * RFC 4226 (HOTP) + RFC 6238 (TOTP time extension).
 * Algorithm: HMAC-SHA1, 6 digits, 30-second window.
 */

import { createHmac, randomBytes } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ─── Base-32 helpers (RFC 4648) ───────────────────────────────────────────────

export function base32Encode(buf) {
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32[(value << (5 - bits)) & 31];
  return result;
}

export function base32Decode(secret) {
  const s = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes = [];
  let bits = 0;
  let value = 0;
  for (const ch of s) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ─── Secret generation ────────────────────────────────────────────────────────

/** Generate a 20-byte (160-bit) random secret, base32-encoded. */
export function generateSecret() {
  return base32Encode(randomBytes(20));
}

// ─── HOTP core ────────────────────────────────────────────────────────────────

function hotp(key, counter, digits = 6) {
  const buf = Buffer.alloc(8);
  // Write 64-bit big-endian counter
  const hi = Math.floor(counter / 0x100000000);
  const lo = counter >>> 0;
  buf.writeUInt32BE(hi, 0);
  buf.writeUInt32BE(lo, 4);

  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[19] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    10 ** digits;
  return String(code).padStart(digits, '0');
}

// ─── TOTP ─────────────────────────────────────────────────────────────────────

const TIMESTEP = 30; // seconds
const DIGITS   = 6;

/**
 * Generate a TOTP code for the given base32 secret.
 * @param {string} secret  base32-encoded TOTP secret
 * @param {number} [atMs]  optional timestamp in milliseconds (defaults to now)
 */
export function generateTOTP(secret, atMs) {
  const key     = base32Decode(secret);
  const counter = Math.floor((atMs ?? Date.now()) / 1000 / TIMESTEP);
  return hotp(key, counter, DIGITS);
}

/**
 * Verify a TOTP code, allowing ±1 window (90-second tolerance for clock skew).
 * Returns true if the code matches any window.
 * @param {string} secret   base32-encoded TOTP secret
 * @param {string|number} code   6-digit code from the user
 * @param {number} [window] number of timesteps to check either side (default 1)
 */
export function verifyTOTP(secret, code, window = 1) {
  const s = String(code ?? '').trim();
  if (!/^\d{6}$/.test(s)) return false;
  const key     = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / TIMESTEP);
  for (let delta = -window; delta <= window; delta++) {
    if (hotp(key, counter + delta, DIGITS) === s) return true;
  }
  return false;
}

/**
 * Build an otpauth:// URI for QR code generation.
 * @param {string} secret   base32 secret
 * @param {string} label    account label shown in authenticator app (e.g. "user@example.com")
 * @param {string} [issuer] service name shown in authenticator (default "BlinkOne")
 */
export function totpUri(secret, label, issuer = 'BlinkOne') {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits:    String(DIGITS),
    period:    String(TIMESTEP),
  });
  const encodedLabel  = encodeURIComponent(label ?? '');
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedIssuer}:${encodedLabel}?${params.toString()}`;
}
