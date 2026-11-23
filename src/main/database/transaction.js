const { AsyncLocalStorage } = require('node:async_hooks');
const logger = require('../logger');

/**
 * Serialized transactions for the single shared SQLite connection.
 *
 * The main process opens exactly one `sqlite` connection and every IPC handler
 * shares it. SQLite transactions are connection-scoped, so two handlers that
 * both run `BEGIN ... COMMIT` concurrently interleave on that one connection:
 *
 *   handler A: BEGIN
 *   handler B: BEGIN        -> "cannot start a transaction within a transaction"
 *   handler A: COMMIT       -> commits B's half-written work too
 *   handler B: COMMIT       -> "cannot commit - no transaction is active"
 *
 * Even without an error the result is data corruption: one logical operation
 * silently absorbs another one's rows. The queue below makes `BEGIN`/`COMMIT`
 * pairs mutually exclusive (FIFO), so a transaction can never overlap another.
 *
 * `BEGIN IMMEDIATE` is used instead of plain `BEGIN` so the write lock is taken
 * up front; with `busy_timeout` already set, a concurrent external writer waits
 * instead of failing halfway through on a lock upgrade.
 */

// FIFO tail. Always resolves: a rejected transaction must not poison the queue.
let queueTail = Promise.resolve();

// Lets a transaction body call another helper that also uses withTransaction
// without deadlocking on itself (the nested call runs inline).
const transactionContext = new AsyncLocalStorage();

/**
 * Runs `fn` inside a serialized transaction and returns its result.
 *
 * @template T
 * @param {{ run: Function, get?: Function, all?: Function }} db
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(db, fn) {
  // Re-entrant call from inside an active transaction: just run inline.
  if (transactionContext.getStore()) {
    return fn();
  }

  const run = async () => {
    await db.run('BEGIN IMMEDIATE TRANSACTION');
    try {
      const result = await transactionContext.run(true, fn);
      await db.run('COMMIT');
      return result;
    } catch (error) {
      try {
        await db.run('ROLLBACK');
      } catch (rollbackError) {
        // The connection may still hold a transaction. Log loudly: the next
        // write would silently join it.
        logger.warn('Rollback failed in withTransaction:', rollbackError.message);
      }
      throw error;
    }
  };

  const result = queueTail.then(run, run);
  queueTail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

/**
 * Runs `fn` after every queued transaction has finished, without opening a
 * transaction itself. Used for maintenance work that must not overlap a
 * transaction (VACUUM INTO, file-level database replacement).
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function runExclusive(fn) {
  const result = queueTail.then(fn, fn);
  queueTail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

module.exports = { withTransaction, runExclusive };
