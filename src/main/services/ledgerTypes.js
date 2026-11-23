/**
 * ledgerTypes.js
 *
 * `subcontractor_transactions.type` used to store the Turkish label that was
 * also the text shown in the interface ("Hakedis" / "Odeme"). Stored data must
 * not depend on the display language: an English user's export contained
 * Turkish words, and any consumer filtering for a payment had to know Turkish.
 *
 * New rows store `payment` or `progress`. `normalizeLedgerType` keeps databases
 * written by earlier versions readable, so the migration is a convenience, not
 * a prerequisite.
 */

const LEDGER_PAYMENT = 'payment';
const LEDGER_PROGRESS = 'progress';

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
function normalizeLedgerType(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return raw;
  return TO_CANONICAL.get(raw.toLowerCase()) || raw;
}

function isLedgerPayment(value) {
  return normalizeLedgerType(value) === LEDGER_PAYMENT;
}

function isLedgerProgress(value) {
  return normalizeLedgerType(value) === LEDGER_PROGRESS;
}

/** Localized name of a stored ledger type, for audit-log sentences. */
function ledgerTypeLabel(value, isTr) {
  if (isLedgerPayment(value)) return isTr ? 'Ödeme' : 'Payment';
  if (isLedgerProgress(value)) return isTr ? 'Hakediş' : 'Progress billing';
  return String(value == null ? '' : value);
}

module.exports = {
  LEDGER_PAYMENT,
  LEDGER_PROGRESS,
  normalizeLedgerType,
  isLedgerPayment,
  isLedgerProgress,
  ledgerTypeLabel,
};
