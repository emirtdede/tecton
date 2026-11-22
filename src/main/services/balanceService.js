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

/**
 * Calculates the net balance of many workers in a constant number of queries.
 *
 * The dashboard used to call `calculateWorkerBalance` once per worker over IPC,
 * which is 2 round-trips into SQLite per row (200 queries for 100 workers) and
 * was the slowest part of the initial load. Two grouped queries return the same
 * numbers; workers with no rows are simply absent from the maps and resolve to
 * 0, which matches `calculateWorkerBalance` for that case.
 */
async function calculateBalancesForWorkers(workerIds, db) {
  const ids = Array.isArray(workerIds)
    ? [...new Set(workerIds.filter(id => id !== null && id !== undefined))]
    : [];

  if (ids.length === 0) return {};

  const placeholders = ids.map(() => '?').join(', ');

  const earnedRows = await db.all(
    `SELECT worker_id, SUM(earned_amount) as total_earned
       FROM timesheets
      WHERE is_deleted = 0 AND worker_id IN (${placeholders})
      GROUP BY worker_id`,
    ids
  );

  const givenRows = await db.all(
    `SELECT worker_id, SUM(amount) as total_given
       FROM transactions
      WHERE is_deleted = 0 AND worker_id IN (${placeholders})
      GROUP BY worker_id`,
    ids
  );

  const earnedMap = {};
  for (const row of earnedRows) earnedMap[row.worker_id] = row.total_earned || 0;

  const givenMap = {};
  for (const row of givenRows) givenMap[row.worker_id] = row.total_given || 0;

  const balances = {};
  for (const id of ids) {
    const earned = earnedMap[id] || 0;
    const given = givenMap[id] || 0;
    balances[id] = Number((earned - given).toFixed(2));
  }

  return balances;
}

module.exports = { calculateWorkerBalance, calculateBalancesForWorkers };
