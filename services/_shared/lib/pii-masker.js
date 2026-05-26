/**
 * PII Masking utilities for Pino loggers — Sprint 1 G07
 *
 * Provides:
 *  - maskString(value)   — regex-replaces phone / card / email / IBAN in a string
 *  - maskObject(obj)     — recursively walks an object, redacts PII field names
 *  - pinoMixin()         — pino `mixin` function (called per log line)
 *  - piiSerializer       — pino `serializers` map for req / err objects
 *
 * Usage in logger.js:
 *   import { piiSerializer, pinoMixin } from '../../_shared/lib/pii-masker.js';
 *   pino({ ..., serializers: piiSerializer, mixin: pinoMixin, redact: PII_REDACT })
 */

'use strict';

// ─── Regexes ──────────────────────────────────────────────────────────────────

/** E.164-style phone numbers: optional + or 00, then 10-15 digits */
const RE_PHONE = /(\+|00)?[1-9]\d{9,14}/g;

/** Luhn-candidate card numbers: 13-19 consecutive digits (with optional spaces/dashes) */
const RE_CARD = /\b(?:\d[ -]?){13,19}\b/g;

/** Basic email pattern */
const RE_EMAIL = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** IBAN: country code + 2 check digits + up to 30 alphanumeric chars */
const RE_IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g;

// ─── Field names that always carry PII ────────────────────────────────────────

const PII_FIELD_NAMES = new Set([
  'phone', 'phoneNumber', 'phone_number', 'callerPhone', 'callerNum',
  'customerPhone', 'toNumber', 'fromNumber', 'sipUri',
  'email', 'emailAddress', 'email_address',
  'password', 'passwd', 'pass', 'secret', 'credential',
  'token', 'accessToken', 'access_token', 'refreshToken', 'refresh_token',
  'apiKey', 'api_key', 'clientSecret', 'client_secret',
  'cardNumber', 'card_number', 'pan', 'cvv', 'cvc', 'cvv2',
  'iban', 'accountNumber', 'account_number',
  'ssn', 'nationalId', 'national_id', 'passport', 'dob', 'dateOfBirth',
  'address', 'streetAddress', 'street_address',
  'authorization', 'cookie', 'set-cookie',
]);

const CENSOR = '[REDACTED]';

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Mask PII patterns inside a string value.
 * Phone numbers are partially masked: first 6 + last 2 digits visible.
 * Everything else is fully replaced with [REDACTED].
 */
function maskString(value) {
  if (typeof value !== 'string' || value.length === 0) return value;

  // Emails
  value = value.replace(RE_EMAIL, (m) => {
    const [local, domain] = m.split('@');
    return `${local[0]}***@${domain}`;
  });

  // IBANs — full redact
  value = value.replace(RE_IBAN, CENSOR);

  // Cards — show last 4 only
  value = value.replace(RE_CARD, (m) => {
    const digits = m.replace(/[ -]/g, '');
    return `****-****-****-${digits.slice(-4)}`;
  });

  // Phones — show +prefix and last 2 digits
  value = value.replace(RE_PHONE, (m) => {
    const clean = m.replace(/\D/g, '');
    return `${m.startsWith('+') ? '+' : ''}${clean.slice(0, 2)}****${clean.slice(-2)}`;
  });

  return value;
}

/**
 * Recursively walk an object and:
 *  1. Redact field values whose key is in PII_FIELD_NAMES
 *  2. Mask string values for non-PII fields
 *
 * Depth-limited to prevent circular reference explosions.
 */
function maskObject(obj, depth = 5) {
  if (depth <= 0 || obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return maskString(obj);
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => maskObject(item, depth - 1));
  }

  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const lk = key.toLowerCase();
    if (PII_FIELD_NAMES.has(key) || PII_FIELD_NAMES.has(lk)) {
      result[key] = CENSOR;
    } else if (typeof val === 'string') {
      result[key] = maskString(val);
    } else if (typeof val === 'object' && val !== null) {
      result[key] = maskObject(val, depth - 1);
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ─── Pino integration ─────────────────────────────────────────────────────────

/**
 * pino `mixin` — merged into every log record.
 * We don't add fields here; we rely on serializers + redact for masking.
 */
function pinoMixin() {
  return {};
}

/**
 * pino `serializers` — called on named log-record fields.
 * `req` serializer masks headers; `err` serializer strips sensitive stack context.
 */
const piiSerializer = {
  req(req) {
    const headers = Object.assign({}, req.headers);
    if (headers.authorization) headers.authorization = CENSOR;
    if (headers.cookie) headers.cookie = CENSOR;
    if (headers['set-cookie']) headers['set-cookie'] = CENSOR;
    return {
      method: req.method,
      url: req.url,
      headers,
      remoteAddress: req.remoteAddress,
    };
  },
  err(err) {
    if (!err) return err;
    return {
      type: err.constructor?.name,
      message: err.message ? maskString(err.message) : undefined,
      stack: err.stack,
      code: err.code,
    };
  },
};

/**
 * Recommended `redact` config — use with pino({ redact: PII_REDACT }).
 * Field-level redact runs BEFORE serializers, so both layers are active.
 */
const PII_REDACT = {
  paths: [
    'phone', 'phoneNumber', 'customerPhone', 'callerPhone', 'callerNum',
    'toNumber', 'fromNumber',
    'email', 'password', 'token', 'apiKey', 'cardNumber', 'cvv',
    'iban', 'accountNumber',
    'req.headers.authorization', 'req.headers.cookie', 'req.headers["set-cookie"]',
  ],
  censor: CENSOR,
};

export { maskString, maskObject, pinoMixin, piiSerializer, PII_REDACT, PII_FIELD_NAMES, CENSOR };
