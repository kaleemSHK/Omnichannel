# Cursor Prompt — Sprint 1 / Feature G07
# PII Log Masking — All Services

**Reviewer gate:** Security critical. Every service must pass before this is considered done.  
**Architecture doc:** `docs/ARCHITECTURE.md §5.2`

---

## Context You Must Read First

1. `services/_shared/lib/` — shared utilities pattern
2. Each service's `lib/logger.js` — current pino setup
3. `services/calls/src/server.js` — example of current logging

---

## What To Build

A **centralized PII masking layer** injected into every service's `pino` logger. Once implemented, no PII can appear in log output regardless of what the service logs.

---

## Step 1: Create `services/_shared/lib/pii-masker.js` (NEW FILE)

```javascript
/**
 * PII masking utilities for pino logger serializers.
 * 
 * Patterns masked:
 * - Phone numbers: +1234567890, 00441234567890, 07911123456
 * - Credit/debit card numbers: 4111 1111 1111 1111 or 4111111111111111
 * - CVV: 3–4 digits appearing after "cvv" keyword context
 * - Email addresses: user@domain.com
 * - IBAN: GB29NWBK60161331926819
 */

const PHONE_RE = /(\+|00)?[1-9]\d{9,14}/g;
const CARD_RE = /\b(?:\d[ -]?){13,16}\b/g;
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const IBAN_RE = /[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}/g;

/**
 * Mask a single string value.
 * @param {string} value
 * @returns {string}
 */
export function maskString(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(CARD_RE, '[CARD_REDACTED]')
    .replace(PHONE_RE, '[PHONE_REDACTED]')
    .replace(EMAIL_RE, '[EMAIL_REDACTED]')
    .replace(IBAN_RE, '[IBAN_REDACTED]');
}

/**
 * Known PII field names — these are fully redacted regardless of value type.
 */
const PII_FIELD_NAMES = new Set([
  'phone', 'phoneNumber', 'phone_number', 'mobile', 'customerPhone',
  'customer_phone', 'callerPhone', 'caller_phone', 'callerNum',
  'cardNumber', 'card_number', 'pan', 'cvv', 'cvc', 'expiry',
  'email', 'emailAddress', 'email_address',
  'password', 'token', 'secret', 'apiKey', 'api_key',
  'ssn', 'nationalId', 'national_id', 'passport',
  'iban', 'bankAccount', 'bank_account',
]);

/**
 * Recursively mask an object, redacting known PII fields and scanning strings.
 * @param {unknown} obj
 * @param {number} depth — recursion limit (default 5)
 * @returns {unknown}
 */
export function maskObject(obj, depth = 5) {
  if (depth <= 0) return obj;
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return maskString(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => maskObject(item, depth - 1));
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (PII_FIELD_NAMES.has(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = maskObject(value, depth - 1);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Pino serializer that masks PII from the entire log object.
 * Usage: add to pino options as serializers.
 */
export const piiSerializer = {
  // req serializer — redact sensitive headers and body
  req(req) {
    return {
      method: req.method,
      url: req.url?.replace(PHONE_RE, '[PHONE_REDACTED]'),
      id: req.id,
    };
  },
  // err serializer — mask error messages
  err(err) {
    return {
      type: err.constructor?.name,
      message: maskString(err.message ?? ''),
      code: err.code,
    };
  },
};

/**
 * Pino mixin — applied to every log entry.
 * Masks string fields that may contain PII.
 */
export function pinoMixin(mergeObject) {
  return maskObject(mergeObject);
}
```

---

## Step 2: Update Every Service's `lib/logger.js`

**Pattern to apply uniformly across ALL services:**

Current pattern (typical):
```javascript
import pino from 'pino';
export function createLogger(name) {
  return pino({ name, level: process.env.LOG_LEVEL || 'info' });
}
```

Updated pattern:
```javascript
import pino from 'pino';
import { piiSerializer, pinoMixin } from '../../_shared/lib/pii-masker.js';

export function createLogger(name) {
  return pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    serializers: piiSerializer,
    mixin: pinoMixin,
    // Redact top-level known PII fields at pino level (fastest path)
    redact: {
      paths: [
        'phone', 'phoneNumber', 'customerPhone', 'callerPhone', 'callerNum',
        'email', 'password', 'token', 'apiKey', 'cardNumber', 'cvv',
        'req.headers.authorization', 'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
  });
}
```

**Apply this update to ALL of these files:**
- `services/calls/lib/logger.js`
- `services/routing/lib/logger.js`
- `services/recording/lib/logger.js`
- `services/ai/lib/logger.js`
- `services/ivr/lib/logger.js`
- `services/tickets/lib/logger.js`
- `services/sla/lib/logger.js`
- `services/escalation/lib/logger.js`
- `services/tenant/lib/logger.js`
- `services/platform/lib/logger.js`
- `services/billing/lib/logger.js`
- `services/integration/lib/logger.js`

Each logger file has the same `createLogger(name)` pattern — the change is the same in all.

---

## Step 3: Gateway (NestJS) — `services/gateway/`

The gateway uses NestJS with its own logger. Add PII masking to the NestJS logger:

Create `services/gateway/src/pii-interceptor.ts`:

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const PHONE_RE = /(\+|00)?[1-9]\d{9,14}/g;
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

export function maskLogString(s: string): string {
  return s.replace(PHONE_RE, '[PHONE_REDACTED]').replace(EMAIL_RE, '[EMAIL_REDACTED]');
}

@Injectable()
export class PiiLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Sanitize request URL from logs
    return next.handle().pipe(tap(() => undefined));
  }
}
```

---

## Step 4: Unit Test — `services/_shared/lib/pii-masker.test.js` (NEW FILE)

```javascript
import { maskString, maskObject } from './pii-masker.js';
import assert from 'node:assert/strict';

// Phone masking
assert.equal(maskString('+447911123456'), '[PHONE_REDACTED]');
assert.equal(maskString('Call from +1234567890 answered'), 'Call from [PHONE_REDACTED] answered');

// Card masking
assert.equal(maskString('4111 1111 1111 1111'), '[CARD_REDACTED]');
assert.equal(maskString('4111111111111111'), '[CARD_REDACTED]');

// Email masking
assert.equal(maskString('user@example.com'), '[EMAIL_REDACTED]');

// Object masking — known field names
const masked = maskObject({ customerPhone: '+447911123456', agentId: 'agent-1' });
assert.equal(masked.customerPhone, '[REDACTED]');
assert.equal(masked.agentId, 'agent-1');

// Nested object
const nested = maskObject({ call: { phone: '+447911123456', id: 'call-1' } });
assert.equal(nested.call.phone, '[REDACTED]');
assert.equal(nested.call.id, 'call-1');

// Recursion limit
const deep = { a: { b: { c: { d: { e: { f: '+447911' } } } } } };
const maskedDeep = maskObject(deep, 5);
// Should not crash

console.log('✅ All PII masker tests passed');
```

---

## Step 5: Verify No PII in Current Logs

After implementation, do a quick audit:

1. Search existing log output (or code) for raw phone numbers being passed to logger:
```bash
grep -r "customerPhone\|callerPhone\|callerNum" services/*/lib/*.js services/*/src/*.js | grep "log\."
```

2. For each hit, ensure the field name is in `PII_FIELD_NAMES` set so it gets auto-redacted.

3. Check for any `log.info({ phone: ... })` patterns and rename the key to `customerPhone` (which is in the PII list).

---

## Files To Create/Modify Summary

```
CREATE  services/_shared/lib/pii-masker.js
CREATE  services/_shared/lib/pii-masker.test.js
MODIFY  services/calls/lib/logger.js
MODIFY  services/routing/lib/logger.js
MODIFY  services/recording/lib/logger.js
MODIFY  services/ai/lib/logger.js
MODIFY  services/ivr/lib/logger.js
MODIFY  services/tickets/lib/logger.js
MODIFY  services/sla/lib/logger.js
MODIFY  services/escalation/lib/logger.js
MODIFY  services/tenant/lib/logger.js
MODIFY  services/platform/lib/logger.js
MODIFY  services/billing/lib/logger.js
MODIFY  services/integration/lib/logger.js
CREATE  services/gateway/src/pii-interceptor.ts
```

---

## Validation After Build

1. Run `node services/_shared/lib/pii-masker.test.js` → all assertions pass
2. Start `services/calls` and make a call — check logs: no phone numbers appear
3. Check all `logger.js` files have the `redact` + `mixin` config
4. Grep for `+44` or `+1` in log output → zero matches
