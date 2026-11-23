/**
 * transactionTypes.js (renderer)
 *
 * Mirror of the canonical worker-ledger type in `src/main/services/transactionTypes.js`.
 */

export const WORKER_ADVANCE = 'advance';

export function isAdvance(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  return raw === WORKER_ADVANCE || raw === 'avans' || raw === 'ödeme' || raw === 'odeme';
}
