/**
 * cashTypes.js
 *
 * The cash register stores a direction, not a sentence. An older build wrote
 * the Turkish UI label ("Nakit Girisi" / "Nakit Cikisi") into the `type`
 * column, which meant the value carrying the meaning was also the value shown
 * in the interface. That breaks every consumer that is not Turkish: reports
 * filtered on 'income' matched nothing, and an English user's export contained
 * Turkish words.
 *
 * `income` and `expense` are now the only values written. `normalizeCashType`
 * keeps old databases, old cloud snapshots and old audit JSON readable until
 * the migration has run, and is safe to call on every read.
 */

const CASH_IN = 'income';
const CASH_OUT = 'expense';

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
function normalizeCashType(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return raw;
  return TO_CANONICAL.get(raw.toLowerCase()) || raw;
}

function isCashIncome(value) {
  return normalizeCashType(value) === CASH_IN;
}

function isCashExpense(value) {
  return normalizeCashType(value) === CASH_OUT;
}

/** Localized name of a stored cash direction, for audit-log sentences. */
function cashTypeLabel(value, isTr) {
  if (isCashIncome(value)) return isTr ? 'Nakit Girişi' : 'Cash in';
  if (isCashExpense(value)) return isTr ? 'Nakit Çıkışı' : 'Cash out';
  return String(value == null ? '' : value);
}

module.exports = {
  CASH_IN,
  CASH_OUT,
  normalizeCashType,
  isCashIncome,
  isCashExpense,
  cashTypeLabel,
};
