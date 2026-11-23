const { toUserError, toUserErrorPayload } = require('../utils/errorUtils');
const { isCashIncome, isCashExpense } = require('./cashTypes');

// Report inputs arrive straight from IPC (numbers may be strings, dates may be
// empty or malformed). They are used to build SQL date prefixes, so a bogus
// value silently produced an empty report instead of an error. These helpers
// make every report reject bad input explicitly.
// Built with the non-logging variant: this constant is created at module load,
// and `toUserError` would write a synthetic stack trace to the log on every
// application start.
const INVALID_INPUT = {
  success: false,
  code: 'invalid_input',
  ...toUserErrorPayload('invalid_input')
};

function toYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  return year;
}

function toMonth(value) {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return month;
}

function toId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

// Accepts 'YYYY-MM-DD' (or a Date) and returns the plain date string, so the
// comparison in SQL is a string comparison against the stored ISO dates.
function toDateString(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(trimmed + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime())) return null;
  // Reject impossible dates such as 2024-02-31 (JS would roll them over).
  if (parsed.toISOString().slice(0, 10) !== trimmed) return null;
  return trimmed;
}

// Money is stored as REAL (SQLite double). `earned - advance` on floats can
// yield -1.1368683772161603e-13 instead of 0, which renders as "-0,00 ₺" and
// makes an exactly-settled worker look like they owe money.
// balanceService.calculateWorkerBalance already rounds to 2 decimals; the report
// paths did not, so the dashboard and the report could disagree about the same
// worker's balance. Same rounding, one rule.
function roundMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  // `+ 0` normalises -0 to 0 so the UI never prints a negative zero.
  return Number(num.toFixed(2)) + 0;
}
async function generateWorkerMonthlyReport(db, worker_id, year, month) {
  const workerId = toId(worker_id);
  const reportYear = toYear(year);
  const reportMonth = toMonth(month);
  if (!workerId || !reportYear || !reportMonth) return INVALID_INPUT;

  try {
    const monthStr = String(reportMonth).padStart(2, '0');
    const monthPrefix = `${reportYear}-${monthStr}`;
    const dateThreshold = `${monthPrefix}-01`;

    // 1. Fetch timesheets and transactions for the specified month
    const timesheets = await db.all(
      `SELECT * FROM timesheets WHERE worker_id = ? AND is_deleted = 0 AND work_date LIKE ? ORDER BY work_date ASC`,
      [workerId, `${monthPrefix}%`]
    );

    const transactions = await db.all(
      `SELECT * FROM transactions WHERE worker_id = ? AND is_deleted = 0 AND trans_date LIKE ? ORDER BY trans_date ASC`,
      [workerId, `${monthPrefix}%`]
    );

    let monthEarned = 0;
    timesheets.forEach(ts => monthEarned += ts.earned_amount);

    let monthAdvance = 0;
    transactions.forEach(tr => monthAdvance += tr.amount);

    // 2. Fetch all previous timesheets and transactions (before this month) to calculate devreden bakiye
    const prevTimesheets = await db.all(
      `SELECT SUM(earned_amount) as total FROM timesheets WHERE worker_id = ? AND is_deleted = 0 AND work_date < ?`,
      [workerId, dateThreshold]
    );
    const prevTransactions = await db.all(
      `SELECT SUM(amount) as total FROM transactions WHERE worker_id = ? AND is_deleted = 0 AND trans_date < ?`,
      [workerId, dateThreshold]
    );

    const prevEarned = prevTimesheets[0]?.total || 0;
    const prevAdvance = prevTransactions[0]?.total || 0;
    const devredenBakiye = roundMoney(prevEarned - prevAdvance);

    const aylikNetBakiye = roundMoney(monthEarned - monthAdvance);
    const yeniBakiye = roundMoney(devredenBakiye + aylikNetBakiye);

    // Get worker details
    const worker = await db.get('SELECT * FROM workers WHERE id = ?', [workerId]);

    return {
      success: true,
      worker,
      month: monthPrefix,
      timesheets,
      transactions,
      summary: {
        devredenBakiye,
        monthEarned,
        monthAdvance,
        aylikNetBakiye,
        yeniBakiye
      }
    };
  } catch (error) {
    return { success: false, ...toUserError(error, 'db_error') };
  }
}

async function generateWorkerStatement(db, worker_id, start_date, end_date) {
  const workerId = toId(worker_id);
  let rangeStart = toDateString(start_date);
  let rangeEnd = toDateString(end_date);
  if (!workerId || !rangeStart || !rangeEnd) return INVALID_INPUT;

  if (rangeStart > rangeEnd) {
    const temp = rangeStart;
    rangeStart = rangeEnd;
    rangeEnd = temp;
  }

  try {
    // 1. Fetch timesheets and transactions within the date range
    const timesheets = await db.all(
      `SELECT * FROM timesheets WHERE worker_id = ? AND is_deleted = 0 AND work_date >= ? AND work_date <= ? ORDER BY work_date ASC`,
      [workerId, rangeStart, rangeEnd]
    );

    const transactions = await db.all(
      `SELECT * FROM transactions WHERE worker_id = ? AND is_deleted = 0 AND trans_date >= ? AND trans_date <= ? ORDER BY trans_date ASC`,
      [workerId, rangeStart, rangeEnd]
    );

    let periodEarned = 0;
    timesheets.forEach(ts => periodEarned += ts.earned_amount);

    let periodAdvance = 0;
    transactions.forEach(tr => periodAdvance += tr.amount);

    // 2. Fetch previous balance (before start_date)
    const prevTimesheets = await db.all(
      `SELECT SUM(earned_amount) as total FROM timesheets WHERE worker_id = ? AND is_deleted = 0 AND work_date < ?`,
      [workerId, rangeStart]
    );
    const prevTransactions = await db.all(
      `SELECT SUM(amount) as total FROM transactions WHERE worker_id = ? AND is_deleted = 0 AND trans_date < ?`,
      [workerId, rangeStart]
    );

    const prevEarned = prevTimesheets[0]?.total || 0;
    const prevAdvance = prevTransactions[0]?.total || 0;
    const previous_balance = roundMoney(prevEarned - prevAdvance);

    const netPeriodBalance = roundMoney(periodEarned - periodAdvance);
    const new_balance = roundMoney(previous_balance + netPeriodBalance);

    const worker = await db.get('SELECT * FROM workers WHERE id = ?', [workerId]);

    return {
      success: true,
      worker,
      start_date: rangeStart,
      end_date: rangeEnd,
      timesheets,
      transactions,
      summary: {
        previous_balance,
        periodEarned,
        periodAdvance,
        netPeriodBalance,
        new_balance
      }
    };
  } catch (error) {
    return { success: false, ...toUserError(error, 'db_error') };
  }
}

async function generateCompanyFinancialSummary(db, year, month, project_id) {
  const reportYear = toYear(year);
  const reportMonth = toMonth(month);
  if (!reportYear || !reportMonth) return INVALID_INPUT;

  // `Number(project_id)` turned garbage into NaN, which sqlite binds as NULL:
  // the report silently came back with zeros instead of telling the caller the
  // filter was invalid. Validate it the same way generateGroupStatement does.
  let projectFilter = null;
  if (project_id && project_id !== 'all') {
    if (project_id === 'merkez') {
      projectFilter = 'merkez';
    } else {
      projectFilter = toId(project_id);
      if (!projectFilter) return INVALID_INPUT;
    }
  }

  try {
    const monthStr = String(reportMonth).padStart(2, '0');
    const monthPrefix = `${reportYear}-${monthStr}`;

    // 1. Total wages earned by ALL workers in this month
    let timesheetsQuery = `SELECT SUM(earned_amount) as total FROM timesheets WHERE is_deleted = 0 AND work_date LIKE ?`;
    const timesheetsParams = [`${monthPrefix}%`];
    if (projectFilter === 'merkez') {
      timesheetsQuery += ` AND project_id IS NULL`;
    } else if (projectFilter) {
      timesheetsQuery += ` AND project_id = ?`;
      timesheetsParams.push(projectFilter);
    }
    const timesheets = await db.all(timesheetsQuery, timesheetsParams);
    const totalWageCost = timesheets[0]?.total || 0;

    // 2. Total Cash Inflows and Outflows in this month
    let cashQuery = `SELECT type, SUM(amount) as total FROM cash_register WHERE is_deleted = 0 AND trans_date LIKE ?`;
    const cashParams = [`${monthPrefix}%`];
    if (projectFilter === 'merkez') {
      cashQuery += ` AND project_id IS NULL`;
    } else if (projectFilter) {
      cashQuery += ` AND project_id = ?`;
      cashParams.push(projectFilter);
    }
    cashQuery += ` GROUP BY type`;

    const cashRegister = await db.all(cashQuery, cashParams);

    let totalCashIn = 0;
    let totalCashOut = 0;

    cashRegister.forEach(c => {
      if (isCashIncome(c.type)) totalCashIn += c.total;
      else if (isCashExpense(c.type)) totalCashOut += c.total;
    });

    const netCashFlow = totalCashIn - totalCashOut;

    return {
      success: true,
      month: monthPrefix,
      summary: {
        totalWageCost,
        totalCashIn,
        totalCashOut,
        netCashFlow
      }
    };
  } catch (error) {
    return { success: false, ...toUserError(error, 'db_error') };
  }
}

async function generateGroupStatement(db, start_date, end_date, project_id) {
  let rangeStart = toDateString(start_date);
  let rangeEnd = toDateString(end_date);
  if (!rangeStart || !rangeEnd) return INVALID_INPUT;

  if (rangeStart > rangeEnd) {
    const temp = rangeStart;
    rangeStart = rangeEnd;
    rangeEnd = temp;
  }

  // 'all' / empty means "every project"; anything else must be a real id.
  const projectId = project_id && project_id !== 'all' ? toId(project_id) : null;
  if (project_id && project_id !== 'all' && !projectId) return INVALID_INPUT;

  try {
    // Soft-deleted groups must not appear in a statement: filtering only the
    // workers left an empty "deleted group" section in the report.
    const groups = await db.all('SELECT * FROM worker_groups WHERE is_deleted = 0');

    let workersQuery = 'SELECT * FROM workers WHERE is_deleted = 0';
    const params = [];
    if (projectId) {
      workersQuery += ' AND project_id = ?';
      params.push(projectId);
    }
    const workers = await db.all(workersQuery, params);

    // Batch aggregation instead of per-worker queries (avoids the N+1 pattern).
    // 4 aggregate queries total, regardless of the number of workers.
    const projectClause = projectId ? ' AND (project_id = ? OR project_id IS NULL)' : '';
    const projectParams = projectId ? [projectId] : [];

    const toMap = (rows) => {
      const map = new Map();
      for (const r of rows) map.set(r.worker_id, r.total || 0);
      return map;
    };

    const periodTimesheets = toMap(await db.all(
      `SELECT worker_id, SUM(earned_amount) as total FROM timesheets
       WHERE is_deleted = 0 AND work_date >= ? AND work_date <= ?${projectClause}
       GROUP BY worker_id`,
      [rangeStart, rangeEnd, ...projectParams]
    ));

    const periodTransactions = toMap(await db.all(
      `SELECT worker_id, SUM(amount) as total FROM transactions
       WHERE is_deleted = 0 AND trans_date >= ? AND trans_date <= ?${projectClause}
       GROUP BY worker_id`,
      [rangeStart, rangeEnd, ...projectParams]
    ));

    const prevTimesheets = toMap(await db.all(
      `SELECT worker_id, SUM(earned_amount) as total FROM timesheets
       WHERE is_deleted = 0 AND work_date < ?${projectClause}
       GROUP BY worker_id`,
      [rangeStart, ...projectParams]
    ));

    const prevTransactions = toMap(await db.all(
      `SELECT worker_id, SUM(amount) as total FROM transactions
       WHERE is_deleted = 0 AND trans_date < ?${projectClause}
       GROUP BY worker_id`,
      [rangeStart, ...projectParams]
    ));

    const allTimesheets = toMap(await db.all(
      `SELECT worker_id, SUM(earned_amount) as total FROM timesheets
       WHERE is_deleted = 0${projectClause}
       GROUP BY worker_id`,
      [...projectParams]
    ));

    const allTransactions = toMap(await db.all(
      `SELECT worker_id, SUM(amount) as total FROM transactions
       WHERE is_deleted = 0${projectClause}
       GROUP BY worker_id`,
      [...projectParams]
    ));

    const groupSummaries = [];
    const allGroups = [...groups, { id: null, name: 'Grupsuz Personeller' }];

    for (const group of allGroups) {
      const groupWorkers = workers.filter(w => w.group_id === group.id);

      let periodEarned = 0;
      let periodAdvance = 0;
      let previousBalance = 0;
      let absoluteBalance = 0;

      for (const w of groupWorkers) {
        periodEarned += periodTimesheets.get(w.id) || 0;
        periodAdvance += periodTransactions.get(w.id) || 0;
        previousBalance += (prevTimesheets.get(w.id) || 0) - (prevTransactions.get(w.id) || 0);
        absoluteBalance += (allTimesheets.get(w.id) || 0) - (allTransactions.get(w.id) || 0);
      }

      const netPeriodBalance = roundMoney(periodEarned - periodAdvance);
      const newBalance = roundMoney(previousBalance + netPeriodBalance);
      previousBalance = roundMoney(previousBalance);
      absoluteBalance = roundMoney(absoluteBalance);

      if (groupWorkers.length > 0 || periodEarned > 0 || periodAdvance > 0 || absoluteBalance !== 0) {
        groupSummaries.push({
          group_id: group.id,
          group_name: group.name,
          worker_count: groupWorkers.length,
          period_earned: periodEarned,
          period_advance: periodAdvance,
          previous_balance: previousBalance,
          net_period_balance: netPeriodBalance,
          new_balance: newBalance,
          absolute_balance: absoluteBalance
        });
      }
    }

    return {
      success: true,
      start_date: rangeStart,
      end_date: rangeEnd,
      groups: groupSummaries
    };

  } catch (error) {
    return { success: false, ...toUserError(error, 'db_error') };
  }
}

module.exports = {
  generateWorkerMonthlyReport,
  generateWorkerStatement,
  generateCompanyFinancialSummary,
  generateGroupStatement
};
