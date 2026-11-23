import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatTime,
  formatDate,
  formatCurrencySafe,
  setRegionalSettings,
  getCurrencySymbol,
  trLower,
} from './formatUtils';

beforeEach(() => {
  // Reset to the default ("auto") formatting so tests do not depend on order.
  globalThis.window = {};
  setRegionalSettings({ language: 'tr', dateFormat: 'auto', timeFormat: 'auto', currency: 'auto' });
});

describe('formatTime - time-only values', () => {
  it('formats a bare HH:MM instead of returning "Invalid Date"', () => {
    // Regression: `new Date('14:30')` is Invalid Date and setHours() on an
    // invalid Date stays NaN, so the UI rendered the literal "Invalid Date".
    expect(formatTime('14:30')).toBe('14:30');
    expect(formatTime('09:05')).toBe('09:05');
    expect(formatTime('23:59')).toBe('23:59');
    expect(formatTime('00:00')).toBe('00:00');
  });

  it('never produces the string "Invalid Date"', () => {
    for (const value of ['14:30', '09:05', '23:59', '00:00', '2026-06-11 15:30:00', '2026-06-11T15:30:00']) {
      expect(formatTime(value)).not.toMatch(/Invalid/i);
    }
  });

  it('extracts the time from a full date-time string', () => {
    expect(formatTime('2026-06-11 15:30:00')).toBe('15:30');
    expect(formatTime('2026-06-11T15:30:00')).toBe('15:30');
  });

  it('returns "-" for empty values', () => {
    expect(formatTime('')).toBe('-');
    expect(formatTime(null)).toBe('-');
    expect(formatTime(undefined)).toBe('-');
  });

  it('passes unparseable text through unchanged', () => {
    expect(formatTime('abc')).toBe('abc');
    expect(formatTime('not:a:time')).toBe('not:a:time');
  });

  it('honours the explicit 24h and 12h regional settings', () => {
    setRegionalSettings({ timeFormat: '24h' });
    expect(formatTime('14:30')).toBe('14:30');

    setRegionalSettings({ timeFormat: '12h' });
    expect(formatTime('14:30')).toBe('02:30 PM');
    expect(formatTime('09:05')).toBe('09:05 AM');
    expect(formatTime('00:05')).toBe('12:05 AM');
  });
});

describe('formatDate - date-only values', () => {
  it('does not shift the day for YYYY-MM-DD (timezone-safe)', () => {
    setRegionalSettings({ dateFormat: 'YYYY-MM-DD' });
    expect(formatDate('2026-01-01')).toBe('2026-01-01');
    expect(formatDate('2026-12-31')).toBe('2026-12-31');
  });

  it('formats in each explicit regional pattern', () => {
    const value = '2026-03-09';
    const expected = {
      'DD.MM.YYYY': '09.03.2026',
      'YYYY-MM-DD': '2026-03-09',
      'MM/DD/YYYY': '03/09/2026',
      'DD/MM/YYYY': '09/03/2026',
      'DD-MM-YYYY': '09-03-2026',
      'YYYY/MM/DD': '2026/03/09',
      'YYYY.MM.DD': '2026.03.09',
    };
    for (const [mode, want] of Object.entries(expected)) {
      setRegionalSettings({ dateFormat: mode });
      expect(formatDate(value)).toBe(want);
    }
  });

  it('returns "-" for empty and echoes unparseable values', () => {
    expect(formatDate('')).toBe('-');
    expect(formatDate(null)).toBe('-');
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatCurrencySafe', () => {
  it('never renders NaN for a non-numeric value', () => {
    for (const value of [null, undefined, '', 'abc', NaN]) {
      const out = formatCurrencySafe(value, 'tr');
      expect(out).not.toMatch(/NaN/);
    }
  });

  it('formats real numbers', () => {
    expect(formatCurrencySafe(0, 'tr')).toContain('0');
    expect(formatCurrencySafe(1250.5, 'tr')).not.toMatch(/NaN/);
  });
});

describe('formatUtils', () => {
  it('maps locale to currency symbol', () => {
    expect(getCurrencySymbol('tr')).toBe('₺');
    expect(getCurrencySymbol('en')).toBe('$');
    expect(getCurrencySymbol('ja')).toBe('¥');
  });

  it('respects regionalSettings override', () => {
    globalThis.window = { regionalSettings: { currency: 'EUR' } };
    expect(getCurrencySymbol('tr')).toBe('€');
  });

  it('formatCurrencySafe handles null and numbers', () => {
    expect(formatCurrencySafe(null)).toBe('0,00 TRY');
    expect(formatCurrencySafe(51937.5, 'ja')).toContain('JPY');
  });

  it('trLower handles Turkish dotted/dotless I', () => {
    expect(trLower('İSTANBUL')).toBe('istanbul');
    expect(trLower('IĞDIR')).toBe('ığdır');
    expect(trLower('')).toBe('');
  });
});
