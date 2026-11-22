import { describe, it, expect } from 'vitest';

import * as mainCash from './cashTypes';
import * as rendererCash from '../../renderer/src/utils/cashTypes';
import * as mainLedger from './ledgerTypes';
import * as rendererLedger from '../../renderer/src/utils/ledgerTypes';
import { isAdvance, WORKER_ADVANCE } from './transactionTypes';

// Stored enums must not depend on the display language, and the main process
// and renderer cannot share a module (CommonJS vs ESM). These tests pin the
// canonical values and assert that the two copies cannot drift apart.

describe('cash direction', () => {
  it('normalizes legacy Turkish labels to canonical values', () => {
    expect(mainCash.normalizeCashType('Nakit Girişi')).toBe('income');
    expect(mainCash.normalizeCashType('Nakit Çıkışı')).toBe('expense');
    expect(mainCash.normalizeCashType('GELIR')).toBe('income');
    expect(mainCash.normalizeCashType(' income ')).toBe('income');
  });

  it('leaves an unknown value unchanged instead of guessing', () => {
    expect(mainCash.normalizeCashType('transfer')).toBe('transfer');
    expect(mainCash.normalizeCashType(null)).toBe('');
  });

  it('matches the renderer copy', () => {
    expect(rendererCash.CASH_IN).toBe(mainCash.CASH_IN);
    expect(rendererCash.CASH_OUT).toBe(mainCash.CASH_OUT);
    for (const value of ['income', 'expense', 'Nakit Girişi', 'nakit çıkışı', 'x']) {
      expect(rendererCash.normalizeCashType(value)).toBe(mainCash.normalizeCashType(value));
    }
  });
});

describe('subcontractor ledger type', () => {
  it('normalizes legacy Turkish labels', () => {
    expect(mainLedger.normalizeLedgerType('Hakediş')).toBe('progress');
    expect(mainLedger.normalizeLedgerType('Ödeme')).toBe('payment');
  });

  it('matches the renderer copy', () => {
    expect(rendererLedger.LEDGER_PAYMENT).toBe(mainLedger.LEDGER_PAYMENT);
    expect(rendererLedger.LEDGER_PROGRESS).toBe(mainLedger.LEDGER_PROGRESS);
    for (const value of ['payment', 'progress', 'Hakediş', 'ödeme', 'x']) {
      expect(rendererLedger.normalizeLedgerType(value)).toBe(mainLedger.normalizeLedgerType(value));
    }
  });
});

describe('worker ledger type', () => {
  it('uses a canonical value and still recognises Avans', () => {
    expect(WORKER_ADVANCE).toBe('advance');
    expect(isAdvance('advance')).toBe(true);
    expect(isAdvance('Avans')).toBe(true);
    expect(isAdvance('Earnings')).toBe(false);
  });
});
