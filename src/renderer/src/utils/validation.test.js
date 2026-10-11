import { describe, it, expect } from 'vitest';
import { isValidTCKN } from './validation';

describe('isValidTCKN', () => {
  it('accepts empty (optional field)', () => {
    expect(isValidTCKN('')).toBe(true);
    expect(isValidTCKN(null)).toBe(true);
    expect(isValidTCKN(undefined)).toBe(true);
  });

  it('accepts a known-valid TC number', () => {
    expect(isValidTCKN('10000000146')).toBe(true);
  });

  it('rejects wrong length / non-digits / leading zero', () => {
    expect(isValidTCKN('12345')).toBe(false);
    expect(isValidTCKN('abcdefghijk')).toBe(false);
    expect(isValidTCKN('00000000146')).toBe(false);
    expect(isValidTCKN(10000000146)).toBe(false);
  });

  it('rejects bad check digits', () => {
    expect(isValidTCKN('10000000147')).toBe(false);
    expect(isValidTCKN('10000000155')).toBe(false);
  });
});
