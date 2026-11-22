/**
 * ledgerTypes.js (renderer)
 *
 * Mirror of `src/main/services/ledgerTypes.js`. The renderer is bundled as ESM
 * while main is CommonJS, so the two cannot share a file; `cashTypes.test.js`
 * asserts that the canonical values match.
 */

export const LEDGER_PAYMENT = 'payment';
export const LEDGER_PROGRESS = 'progress';

const TO_CANONICAL = new Map([
  [LEDGER_PAYMENT, LEDGER_PAYMENT],
  [LEDGER_PROGRESS, LEDGER_PROGRESS],
  ['hakediş', LEDGER_PROGRESS],
  ['hakedis', LEDGER_PROGRESS],
  ['progress', LEDGER_PROGRESS],
  ['ödeme', LEDGER_PAYMENT],
  ['odeme', LEDGER_PAYMENT],
  ['payment', LEDGER_PAYMENT],
]);

/**
 * @param {unknown} value
 * @returns {string} 'payment', 'progress', or the original value when unknown.
 */
export function normalizeLedgerType(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return raw;
  return TO_CANONICAL.get(raw.toLowerCase()) || raw;
}

export function isLedgerPayment(value) {
  return normalizeLedgerType(value) === LEDGER_PAYMENT;
}

export function isLedgerProgress(value) {
  return normalizeLedgerType(value) === LEDGER_PROGRESS;
}
