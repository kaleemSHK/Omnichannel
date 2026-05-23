import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isFeatureEnabled, normalizeFeatureEnabled } from '../../services/_shared/lib/features.js';

describe('feature entitlements', () => {
  it('normalizeFeatureEnabled handles booleans and objects', () => {
    assert.equal(normalizeFeatureEnabled(false), false);
    assert.equal(normalizeFeatureEnabled(true), true);
    assert.equal(normalizeFeatureEnabled({ enabled: false }), false);
    assert.equal(normalizeFeatureEnabled({ enabled: true }), true);
  });

  it('isFeatureEnabled resolves calling.pstn via telephony alias', () => {
    assert.equal(isFeatureEnabled({ telephony: true }, 'calling.pstn'), true);
    assert.equal(isFeatureEnabled({ 'calling.pstn': false, telephony: true }, 'calling.pstn'), false);
    assert.equal(isFeatureEnabled({}, 'sla'), false);
  });
});
