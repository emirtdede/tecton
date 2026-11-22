import { describe, it, expect } from 'vitest';
import { daysUntil } from './dateRangeUtils';
import { parseLocalDate, toLocalDateString, localToday } from './formatUtils';

/**
 * These assertions are timezone-independent on purpose: the test process may run
 * in any TZ. The bug they guard against was only visible west of UTC, where
 * `new Date('YYYY-MM-DD')` (UTC midnight) + `setHours(0,0,0,0)` landed on the
 * previous local day and every count came back one short.
 */
describe('daysUntil', () => {
  it('returns 0 for the local today in any timezone', () => {
    expect(daysUntil(localToday())).toBe(0);
  });

  it('returns 1 for tomorrow and 7 for a week ahead', () => {
    const plus = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return toLocalDateString(d);
    };
    expect(daysUntil(plus(1))).toBe(1);
    expect(daysUntil(plus(7))).toBe(7);
  });

  it('returns a negative count for past dates', () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    expect(daysUntil(toLocalDateString(d))).toBe(-3);
  });

  it('returns null for empty or unparseable input', () => {
    expect(daysUntil('')).toBeNull();
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
    expect(daysUntil('not-a-date')).toBeNull();
    expect(daysUntil('2026-02-31')).toBeNull();
  });

  it('spans a DST transition without drifting a day', () => {
    // Pick a date 120 days ahead: most timezones cross a DST boundary in that
    // window. A ms-based ceil() over a 23h or 25h day would round differently.
    const d = new Date();
    d.setDate(d.getDate() + 120);
    expect(daysUntil(toLocalDateString(d))).toBe(120);
  });
});

describe('parseLocalDate', () => {
  it('keeps the calendar day the user typed', () => {
    const d = parseLocalDate('2026-11-01');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10); // November, 0-based
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it('rejects rollover dates instead of silently shifting them', () => {
    expect(parseLocalDate('2026-02-30')).toBeNull();
    expect(parseLocalDate('2026-13-01')).toBeNull();
  });

  it('rejects non-ISO and non-string input', () => {
    expect(parseLocalDate('01.11.2026')).toBeNull();
    expect(parseLocalDate('2026-11-01T10:00:00Z')).toBeNull();
    expect(parseLocalDate(20261101)).toBeNull();
    expect(parseLocalDate(null)).toBeNull();
  });
});

describe('toLocalDateString', () => {
  it('formats a local Date without a UTC shift', () => {
    // Local midnight on the 1st must stay the 1st (this was the §5.15 bug).
    expect(toLocalDateString(new Date(2026, 10, 1))).toBe('2026-11-01');
    expect(toLocalDateString(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toLocalDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('returns an empty string for an invalid Date', () => {
    expect(toLocalDateString(new Date('nope'))).toBe('');
  });
});
