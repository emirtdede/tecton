const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const { TABLES_SQL, INDEXES_SQL } = require('../database/schema');

/**
 * Creates the in-memory database used by the service unit tests.
 *
 * The DDL is imported from `database/schema.js` - the same module production
 * uses - instead of being copied by hand. The previous hand-copied schema had
 * drifted seven tables behind production (missing `workers.phone`,
 * `timesheets.work_type_id`, `transactions.created_at`, … while still carrying
 * pre-migration columns), so a query could pass in tests and fail at runtime.
 */
async function setupTestDB() {
  const db = await open({
    filename: ':memory:',
    driver: sqlite3.Database
  });

  await db.exec(TABLES_SQL);
  await db.exec(INDEXES_SQL);

  return db;
}

module.exports = { setupTestDB };
