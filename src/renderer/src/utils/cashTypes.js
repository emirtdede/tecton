/**
 * cashTypes.js (renderer)
 *
 * Mirror of `src/main/services/cashTypes.js`. The two processes cannot share a
 * module: main is CommonJS, the renderer is bundled as ESM by Vite. The values
 * are asserted to be identical by `cashTypes.test.js`, so a change in one file
 * cannot silently drift from the other.
 */

export const CASH_IN = 'income';
export const CASH_OUT = 'expense';

const TO_CANONICAL = new Map([
  [CASH_IN, CASH_IN],
  [CASH_OUT, CASH_OUT],
  ['nakit girişi', CASH_IN],
  ['nakit girisi', CASH_IN],
  ['gelir', CASH_IN],
  ['tahsilat', CASH_IN],
  ['nakit çıkışı', CASH_OUT],
  ['nakit cikisi', CASH_OUT],
  ['gider', CASH_OUT],
  ['ödeme', CASH_OUT],
  ['odeme', CASH_OUT],
]);

/**
 * @param {unknown} value
 * @returns {string} 'income', 'expense', or the original value when unknown.
 */
export function normalizeCashType(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return raw;
  return TO_CANONICAL.get(raw.toLowerCase()) || raw;
}

export function isCashIncome(value) {
  return normalizeCashType(value) === CASH_IN;
}

export function isCashExpense(value) {
  return normalizeCashType(value) === CASH_OUT;
}
