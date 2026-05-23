import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Unit tests for event-handler helpers (no DB).
 * Integration paths are covered in tests/acceptance/tr-23-sla-escalation.mjs.
 */

describe('working-time warning', async () => {
  const { warningAt, addBusinessMinutes } = await import('../lib/working-time.js');

  it('warningAt is before dueAt', () => {
    const cal = {
      weekdayHours: {
        monday: [{ start: '09:00', end: '17:00' }],
        tuesday: [{ start: '09:00', end: '17:00' }],
        wednesday: [{ start: '09:00', end: '17:00' }],
        thursday: [{ start: '09:00', end: '17:00' }],
        friday: [{ start: '09:00', end: '17:00' }],
      },
      holidays: [],
    };
    const started = '2026-05-18T09:00:00.000Z';
    const due = addBusinessMinutes(started, 60, cal);
    const warn = warningAt(due, started, 80, cal);
    assert.ok(new Date(warn) < new Date(due));
  });
});
