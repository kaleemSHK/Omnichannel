/** Business-hours minute arithmetic (Prompt 6). */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseHHMM(value) {
  const [h, m] = String(value).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

export function isHoliday(d, holidays = []) {
  const key = dateKey(d);
  return holidays.some((h) => (typeof h === 'string' ? h : h?.date) === key);
}

function windowsForDay(d, weekdayHours = {}) {
  const name = WEEKDAYS[d.getUTCDay()];
  return weekdayHours[name] || [];
}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/**
 * Add N business minutes from start using calendar weekday_hours + holidays.
 * Uses UTC date parts (timezone refinement in later pass).
 */
export function addBusinessMinutes(startIso, minutes, calendar = {}) {
  if (!minutes || minutes <= 0) return new Date(startIso).toISOString();

  const weekdayHours = calendar.weekdayHours || calendar.weekday_hours || {};
  const holidays = calendar.holidays || [];
  let remaining = minutes;
  let cur = new Date(startIso);
  let guard = 0;

  while (remaining > 0 && guard++ < 525_600) {
    if (isHoliday(cur, holidays)) {
      cur = addUtcDays(startOfUtcDay(cur), 1);
      continue;
    }
    const windows = windowsForDay(cur, weekdayHours);
    if (!windows.length) {
      cur = addUtcDays(startOfUtcDay(cur), 1);
      continue;
    }

    const dayStart = startOfUtcDay(cur);
    const curMin = (cur.getTime() - dayStart.getTime()) / 60_000;

    for (const w of windows) {
      const wStart = parseHHMM(w.start);
      const wEnd = parseHHMM(w.end);
      if (wEnd <= wStart) continue;
      if (curMin >= wEnd) continue;

      const effectiveStart = Math.max(curMin, wStart);
      const available = wEnd - effectiveStart;
      if (available <= 0) continue;

      const use = Math.min(remaining, available);
      remaining -= use;
      cur = new Date(dayStart.getTime() + (effectiveStart + use) * 60_000);
      if (remaining <= 0) break;
    }

    if (remaining > 0) {
      cur = addUtcDays(startOfUtcDay(cur), 1);
    }
  }

  return cur.toISOString();
}

/** Elapsed business minutes between two instants. */
export function businessMinutesBetween(startIso, endIso, calendar = {}) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (end <= start) return 0;

  let total = 0;
  let cur = new Date(startIso);
  let guard = 0;

  while (cur.getTime() < end && guard++ < 525_600) {
    if (isHoliday(cur, calendar.holidays)) {
      cur = addUtcDays(startOfUtcDay(cur), 1);
      continue;
    }
    const windows = windowsForDay(cur, calendar.weekdayHours || calendar.weekday_hours || {});
    if (!windows.length) {
      cur = addUtcDays(startOfUtcDay(cur), 1);
      continue;
    }
    const dayStart = startOfUtcDay(cur);
    const dayEnd = addUtcDays(dayStart, 1);
    const sliceEnd = new Date(Math.min(end, dayEnd.getTime()));
    const curMin = (cur.getTime() - dayStart.getTime()) / 60_000;
    const endMin = (sliceEnd.getTime() - dayStart.getTime()) / 60_000;

    for (const w of windows) {
      const wStart = parseHHMM(w.start);
      const wEnd = parseHHMM(w.end);
      const from = Math.max(curMin, wStart);
      const to = Math.min(endMin, wEnd);
      if (to > from) total += to - from;
    }
    cur = dayEnd;
  }
  return Math.floor(total);
}

export function warningAt(dueAtIso, startedAtIso, warningPct, calendar) {
  const total = businessMinutesBetween(startedAtIso, dueAtIso, calendar);
  const warnMinutes = Math.floor((total * warningPct) / 100);
  return addBusinessMinutes(startedAtIso, warnMinutes, calendar);
}
