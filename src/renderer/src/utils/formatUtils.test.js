import { describe, it, expect, beforeEach } from 'vitest';
import { getCurrencySymbol, formatCurrencySafe, trLower } from './formatUtils';

beforeEach(() => {
  globalThis.window = {};
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
