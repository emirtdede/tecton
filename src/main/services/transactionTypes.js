/**
 * transactionTypes.js
 *
 * The worker ledger used to store the Turkish word "Avans" (advance) as the
 * value of `transactions.trans_type`, so the stored data carried a display
 * language. New rows use `advance`; `isAdvance()` still recognises the old
 * value so a database written by an earlier version keeps working.
 */

const WORKER_ADVANCE = 'advance';

function isAdvance(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  return raw === WORKER_ADVANCE || raw === 'avans' || raw === 'ödeme' || raw === 'odeme';
}

module.exports = { WORKER_ADVANCE, isAdvance };
