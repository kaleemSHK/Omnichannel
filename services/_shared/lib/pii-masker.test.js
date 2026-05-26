/**
 * PII Masker unit tests — Sprint 1 G07
 * Run with: node --experimental-vm-modules services/_shared/lib/pii-masker.test.js
 * Or via: npm test (if package.json has "test": "node ...")
 */

import assert from 'node:assert/strict';
import { maskString, maskObject, piiSerializer, PII_REDACT, CENSOR } from './pii-masker.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ─── maskString ───────────────────────────────────────────────────────────────

console.log('\nmaskString()');

test('passes through non-string values', () => {
  assert.equal(maskString(null), null);
  assert.equal(maskString(42), 42);
  assert.equal(maskString(undefined), undefined);
});

test('passes through empty string', () => {
  assert.equal(maskString(''), '');
});

test('passes through clean string untouched', () => {
  const s = 'Hello, this is a normal log message with no PII.';
  assert.equal(maskString(s), s);
});

test('masks email — preserves first char and domain', () => {
  const result = maskString('Contact user@example.com for support');
  assert.ok(result.includes('u***@example.com'), `got: ${result}`);
  assert.ok(!result.includes('user@'), `should not contain full email, got: ${result}`);
});

test('masks multiple emails in one string', () => {
  const result = maskString('From alice@test.org to bob@other.net');
  assert.ok(result.includes('a***@test.org'), `got: ${result}`);
  assert.ok(result.includes('b***@other.net'), `got: ${result}`);
});

test('masks phone number', () => {
  const result = maskString('Caller: +96890123456');
  assert.ok(!result.includes('96890123456'), `should not contain full phone, got: ${result}`);
  assert.ok(result.includes('****'), `should contain mask, got: ${result}`);
});

test('masks phone without + prefix', () => {
  const result = maskString('Phone is 00968 91234567');
  assert.ok(result.includes('****'), `got: ${result}`);
});

test('masks IBAN', () => {
  const result = maskString('IBAN: GB82WEST12345698765432');
  assert.equal(result, `IBAN: ${CENSOR}`);
});

test('masks card number with spaces', () => {
  const result = maskString('Card: 4111 1111 1111 1111');
  assert.ok(result.includes('1111'), `last 4 should be visible, got: ${result}`);
  assert.ok(!result.includes('4111 1111 1111 1111'), `full card should be masked, got: ${result}`);
});

// ─── maskObject ───────────────────────────────────────────────────────────────

console.log('\nmaskObject()');

test('redacts phone field', () => {
  const result = maskObject({ phone: '+96890123456', name: 'Alice' });
  assert.equal(result.phone, CENSOR);
  assert.equal(result.name, 'Alice');
});

test('redacts email field', () => {
  const result = maskObject({ email: 'user@example.com', id: 1 });
  assert.equal(result.email, CENSOR);
  assert.equal(result.id, 1);
});

test('redacts password field', () => {
  const result = maskObject({ username: 'admin', password: 'secret123' });
  assert.equal(result.password, CENSOR);
  assert.equal(result.username, 'admin');
});

test('redacts token field', () => {
  const result = maskObject({ token: 'eyJhbGciOiJIUzI1NiJ9.payload.sig' });
  assert.equal(result.token, CENSOR);
});

test('redacts nested PII fields', () => {
  const result = maskObject({ user: { phone: '+1234567890', name: 'Bob' } });
  assert.equal(result.user.phone, CENSOR);
  assert.equal(result.user.name, 'Bob');
});

test('redacts fields case-insensitively via lowercase key check', () => {
  const result = maskObject({ PHONE: '+96890123456' });
  // lowercase key check matches 'phone' → CENSOR
  assert.equal(result.PHONE, CENSOR);
});

test('handles null safely', () => {
  assert.equal(maskObject(null), null);
  assert.equal(maskObject(undefined), undefined);
});

test('handles array items', () => {
  const result = maskObject([{ phone: '1234567890' }, { phone: '9876543210' }]);
  assert.equal(result[0].phone, CENSOR);
  assert.equal(result[1].phone, CENSOR);
});

test('depth limit prevents circular explosion', () => {
  const deep = { a: { b: { c: { d: { e: { f: { g: 'deep' } } } } } } };
  // Should not throw, just truncate
  assert.doesNotThrow(() => maskObject(deep, 3));
});

// ─── piiSerializer ────────────────────────────────────────────────────────────

console.log('\npiiSerializer');

test('req serializer masks authorization header', () => {
  const fakeReq = {
    method: 'POST',
    url: '/v1/calls',
    headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
    remoteAddress: '127.0.0.1',
  };
  const result = piiSerializer.req(fakeReq);
  assert.equal(result.headers.authorization, CENSOR);
  assert.equal(result.headers['content-type'], 'application/json');
  assert.equal(result.method, 'POST');
});

test('req serializer masks cookie header', () => {
  const fakeReq = {
    method: 'GET', url: '/v1/me',
    headers: { cookie: 'session=abc123; token=xyz' },
  };
  const result = piiSerializer.req(fakeReq);
  assert.equal(result.headers.cookie, CENSOR);
});

test('err serializer masks PII in error message', () => {
  const err = new Error('Failed to call +96890123456');
  const result = piiSerializer.err(err);
  assert.ok(!result.message.includes('96890123456'), `got: ${result.message}`);
});

test('err serializer returns null as-is', () => {
  assert.equal(piiSerializer.err(null), null);
});

// ─── PII_REDACT config ────────────────────────────────────────────────────────

console.log('\nPII_REDACT config');

test('PII_REDACT has paths array', () => {
  assert.ok(Array.isArray(PII_REDACT.paths));
  assert.ok(PII_REDACT.paths.length > 0);
});

test('PII_REDACT includes phone and email paths', () => {
  assert.ok(PII_REDACT.paths.includes('phone'));
  assert.ok(PII_REDACT.paths.includes('email'));
});

test('PII_REDACT includes req.headers.authorization', () => {
  assert.ok(PII_REDACT.paths.includes('req.headers.authorization'));
});

test('PII_REDACT censor is [REDACTED]', () => {
  assert.equal(PII_REDACT.censor, CENSOR);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
