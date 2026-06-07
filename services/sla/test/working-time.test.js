import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessMinutes, businessMinutesBetween, isHoliday } from '../lib/working-time.js';

const weekday = {
  monday: [{ start: '09:00', end: '17:00' }],
  tuesday: [{ start: '09:00', end: '17:00' }],
  wednesday: [{ start: '09:00', end: '17:00' }],
  thursday: [{ start: '09:00', end: '17:00' }],
  friday: [{ start: '09:00', end: '17:00' }],
};

describe('WorkingTime', () => {
  it('adds minutes inside same business day', () => {
    const start = '2026-05-18T09:00:00.000Z'; // Monday
    const due = addBusinessMinutes(start, 60, { weekdayHours: weekday, holidays: [] });
    assert.equal(businessMinutesBetween(start, due, { weekdayHours: weekday }), 60);
  });

  it('skips weekend when adding across Friday evening', () => {
    const start = '2026-05-22T16:00:00.000Z'; // Friday 16:00 UTC
    const due = addBusinessMinutes(start, 120, { weekdayHours: weekday, holidays: [] });
    const mins = businessMinutesBetween(start, due, { weekdayHours: weekday });
    assert.equal(mins, 120);
    assert.ok(new Date(due).getUTCDay() === 1); // lands Monday
  });

  it('skips holidays', () => {
    const cal = {
      weekdayHours: weekday,
      holidays: ['2026-05-18'],
    };
    assert.ok(isHoliday(new Date('2026-05-18T10:00:00Z'), cal.holidays));
    const start = '2026-05-18T09:00:00.000Z';
    const due = addBusinessMinutes(start, 30, cal);
    assert.ok(new Date(due) > new Date('2026-05-18T23:59:59Z'));
  });

  it('falls back to wall-clock when no business hours configured', () => {
    const start = '2026-05-18T09:00:00.000Z';
    const due = addBusinessMinutes(start, 60, {});
    assert.equal(new Date(due).getTime() - new Date(start).getTime(), 60 * 60_000);
  });
});
