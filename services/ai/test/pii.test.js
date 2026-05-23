import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redact } from '../lib/pii/redactor.js';

describe('PiiRedactor', () => {
  it('redacts Omani phone numbers', () => {
    const s = redact('Call me +968 9123 4567 or 091234567');
    assert.ok(!s.includes('9123'));
    assert.ok(s.includes('REDACTED_PHONE'));
  });

  it('redacts IBAN', () => {
    const s = redact('IBAN OM12 3456 7890 1234 5678 9012 34');
    assert.ok(!s.includes('OM12'));
  });

  it('redacts email', () => {
    const s = redact('Email ahmed@example.om please');
    assert.ok(!s.includes('ahmed@'));
  });
});
