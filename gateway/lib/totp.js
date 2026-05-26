/**
 * Pure RFC 6238 TOTP — gateway copy (Sprint 2 M01)
 * Identical algorithm to services/platform/lib/totp.js.
 * Duplicated because gateway and platform run in separate containers.
 */

import { createHmac, randomBytes } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
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

function base32Decode(secret) {
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

function hotp(key, counter, digits = 6) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
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

export function generateSecret() {
  return base32Encode(randomBytes(20));
}

export function verifyTOTP(secret, code, window = 1) {
  const s = String(code ?? '').trim();
  if (!/^\d{6}$/.test(s)) return false;
  const key     = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let d = -window; d <= window; d++) {
    if (hotp(key, counter + d) === s) return true;
  }
  return false;
}
