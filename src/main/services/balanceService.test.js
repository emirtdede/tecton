const { setupTestDB } = require('./testDb');
const { calculateWorkerBalance, calculateBalancesForWorkers } = require('./balanceService');

describe('Balance Service (Dinamik Bakiye - SUM Hesaplaması)', () => {
  let db;

  beforeEach(async () => {
    db = await setupTestDB();
    
    await db.run("INSERT INTO workers (id, full_name, daily_wage) VALUES (1, 'Test İşçi', 1000)");
    
    // Add 5 timesheets: 5 * 1000 = 5000 earned
    for (let i = 1; i <= 5; i++) {
      await db.run(
        "INSERT INTO timesheets (worker_id, work_date, applied_wage, applied_multiplier, earned_amount) VALUES (1, '2026-06-11', 1000, 1.0, 1000)"
      );
    }

    // Add 2 transactions (Avans): 2 * 500 = 1000 given.
    // `trans_type` is NOT NULL in the production schema (see database/schema.js);
    // the old hand-copied test schema omitted the constraint, so these inserts
    // passed there but would have failed against a real database.
    await db.run("INSERT INTO transactions (worker_id, trans_date, trans_type, amount) VALUES (1, '2026-06-11', 'Avans', 500)");
    await db.run("INSERT INTO transactions (worker_id, trans_date, trans_type, amount) VALUES (1, '2026-06-12', 'Avans', 500)");
  });

  it('should correctly calculate balance using SUM', async () => {
    const balance = await calculateWorkerBalance(1, db);
    // 5000 earned - 1000 given = 4000
    expect(balance).toBe(4000);
  });

  it('should ignore deleted (is_deleted = 1) records', async () => {
    // Delete one timesheet (-1000 earned)
    await db.run('UPDATE timesheets SET is_deleted = 1 WHERE id = 1');
    
    // Delete one transaction (+500 given reversed)
    await db.run('UPDATE transactions SET is_deleted = 1 WHERE id = 1');

    const balance = await calculateWorkerBalance(1, db);
    // 4000 earned - 500 given = 3500
    expect(balance).toBe(3500);
  });

  it('should return 0 if no records exist', async () => {
    const balance = await calculateWorkerBalance(99, db);
    expect(balance).toBe(0);
  });

  describe('calculateBalancesForWorkers (batched)', () => {
    beforeEach(async () => {
      await db.run("INSERT INTO workers (id, full_name, daily_wage) VALUES (2, 'İkinci İşçi', 800)");
      await db.run(
        "INSERT INTO timesheets (worker_id, work_date, applied_wage, applied_multiplier, earned_amount) VALUES (2, '2026-06-11', 800, 1.0, 800)"
      );
      await db.run(
        "INSERT INTO transactions (worker_id, trans_date, trans_type, amount) VALUES (2, '2026-06-11', 'Avans', 300)"
      );
    });

    it('returns the same values as the per-worker calculation', async () => {
      const batched = await calculateBalancesForWorkers([1, 2], db);

      expect(batched[1]).toBe(await calculateWorkerBalance(1, db));
      expect(batched[2]).toBe(await calculateWorkerBalance(2, db));
      expect(batched[1]).toBe(4000);
      expect(batched[2]).toBe(500);
    });

    it('returns 0 for workers without records and deduplicates ids', async () => {
      const batched = await calculateBalancesForWorkers([1, 1, 99], db);

      expect(batched[1]).toBe(4000);
      expect(batched[99]).toBe(0);
      expect(Object.keys(batched)).toHaveLength(2);
    });

    it('respects soft-deleted rows', async () => {
      await db.run('UPDATE transactions SET is_deleted = 1 WHERE worker_id = 2');

      const batched = await calculateBalancesForWorkers([2], db);
      expect(batched[2]).toBe(800);
    });

    it('returns an empty object for an empty or invalid id list', async () => {
      expect(await calculateBalancesForWorkers([], db)).toEqual({});
      expect(await calculateBalancesForWorkers(null, db)).toEqual({});
    });
  });
});
