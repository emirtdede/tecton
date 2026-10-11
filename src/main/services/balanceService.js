async function calculateWorkerBalance(worker_id, db) {
  // 1. Earned amounts from timesheets (Alacaklar)
  const timesheets = await db.get(
    'SELECT SUM(earned_amount) as total_earned FROM timesheets WHERE worker_id = ? AND is_deleted = 0',
    [worker_id]
  );
  // 2. Given amounts from transactions (Borçlar/Avanslar)
  const transactions = await db.get(
    'SELECT SUM(amount) as total_given FROM transactions WHERE worker_id = ? AND is_deleted = 0',
    [worker_id]
  );
  
  const earned = timesheets.total_earned || 0;
  const given = transactions.total_given || 0;

  return Number((earned - given).toFixed(2));
}

// Bulk variant: one round-trip for N workers (N+1 fix for App.jsx fetchWorkers).
// Returns { [worker_id]: balance }. Unknown/empty ids yield {}.
async function calculateBulkBalances(worker_ids, db) {
  if (!Array.isArray(worker_ids) || worker_ids.length === 0) return {};
  const ids = worker_ids.filter((v) => Number.isInteger(v));
  if (ids.length === 0) return {};
  const placeholders = ids.map(() => '?').join(', ');
  const earnedRows = await db.all(
    `SELECT worker_id, SUM(earned_amount) as total FROM timesheets WHERE worker_id IN (${placeholders}) AND is_deleted = 0 GROUP BY worker_id`,
    ids
  );
  const givenRows = await db.all(
    `SELECT worker_id, SUM(amount) as total FROM transactions WHERE worker_id IN (${placeholders}) AND is_deleted = 0 GROUP BY worker_id`,
    ids
  );
  const earned = {}, given = {};
  for (const r of earnedRows) earned[r.worker_id] = r.total || 0;
  for (const r of givenRows) given[r.worker_id] = r.total || 0;
  const out = {};
  for (const id of ids) out[id] = Number(((earned[id] || 0) - (given[id] || 0)).toFixed(2));
  return out;
}

module.exports = { calculateWorkerBalance, calculateBulkBalances };
