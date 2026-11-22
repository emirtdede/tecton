const { toUserError } = require('../utils/errorUtils');
const logger = require('../logger');
const { withTransaction } = require('../database/transaction');
const { CASH_OUT } = require('./cashTypes');
const { isAdvance } = require('./transactionTypes');
const { LEDGER_PAYMENT, LEDGER_PROGRESS, normalizeLedgerType, isLedgerPayment } = require('./ledgerTypes');

/**
 * Builds the ` [Şantiye: name]` suffix used in audit log lines.
 * Extracted because the same project-lookup + label logic was duplicated 4 times.
 */
async function getProjectLogPart(db, projectId, isTr) {
  if (!projectId) return '';
  try {
    const project = await db.get('SELECT name FROM projects WHERE id = ?', [projectId]);
    if (project && project.name) {
      const label = isTr ? 'Şantiye' : 'Project';
      return ` [${label}: ${project.name}]`;
    }
  } catch (err) {
    logger.warn('Project name lookup failed for audit log:', err.message);
  }
  return '';
}

async function getLangIsTr(db) {
  const langSetting = await db.get("SELECT setting_value FROM app_settings WHERE setting_key = 'language'");
  return !langSetting || langSetting.setting_value === 'tr';
}

// --- IPC boundary validation -------------------------------------------------
// These functions take payloads straight from `ipcRenderer.invoke`, so nothing
// guarantees a shape. Before this, `createTransactionAndCash(undefined)` threw a
// TypeError (caught, but reported as a generic DB error) and, worse, an amount of
// `NaN` / `-500` was written verbatim into `transactions` and `cash_register`,
// permanently skewing both the worker balance and the cash book.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  // Rejects roll-over dates such as 2026-02-31.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function invalidInput(message, messageKey = 'errors.invalid_input') {
  return { success: false, message, messageKey };
}

function validateTransactionPayload(data, { idField = 'worker_id' } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return invalidInput('Geçersiz işlem verisi.', 'errors.invalid_input');
  }

  const ownerId = Number(data[idField]);
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    return invalidInput('Geçersiz kayıt kimliği.', 'errors.invalid_input');
  }

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return invalidInput('Tutar sıfırdan büyük bir sayı olmalıdır.', 'errors.invalid_amount');
  }

  if (!isValidIsoDate(data.trans_date)) {
    return invalidInput('Geçersiz tarih. Beklenen biçim: YYYY-AA-GG.', 'errors.invalid_date');
  }

  return null;
}

async function deleteTransactionAndCash(transaction_id, db) {
  try {
    return await withTransaction(db, async () => {
      const trans = await db.get('SELECT * FROM transactions WHERE id = ?', [transaction_id]);
      if (!trans) {
        return { success: false, message: 'Transaction not found', messageKey: 'errors.transaction_not_found' };
      }

      // Soft Delete transaction
      await db.run("UPDATE transactions SET is_deleted = 1, deleted_at = datetime('now', 'localtime') WHERE id = ?", [transaction_id]);

      // Audit log
      await db.run(
        'INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, project_id) VALUES (?, ?, ?, ?, ?, ?)',
        ['transactions', transaction_id, 'DELETE', JSON.stringify(trans), JSON.stringify({ is_deleted: 1 }), trans.project_id || null]
      );
      const isTr = await getLangIsTr(db);
      logger.info(`[DB DELETE] [transactions]${await getProjectLogPart(db, trans.project_id, isTr)} Bir avans/işlem iptal edildi. Tutar: ${trans.amount} TL`);

      // If linked to cash register, soft delete that too
      if (trans.linked_cash_id) {
        const cash = await db.get('SELECT * FROM cash_register WHERE id = ?', [trans.linked_cash_id]);
        if (cash) {
          await db.run("UPDATE cash_register SET is_deleted = 1, deleted_at = datetime('now', 'localtime') WHERE id = ?", [trans.linked_cash_id]);
          await db.run(
            'INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, project_id) VALUES (?, ?, ?, ?, ?, ?)',
            ['cash_register', trans.linked_cash_id, 'DELETE', JSON.stringify(cash), JSON.stringify({ is_deleted: 1 }), cash.project_id || null]
          );
          logger.info(`[DB DELETE] [cash_register]${await getProjectLogPart(db, cash.project_id, isTr)} Kasadan bir işlem iptal edildi. Tutar: ${cash.amount} TL (${cash.type})`);
        }
      }

      return { success: true, message: 'İşlem başarıyla iptal edildi.', messageKey: 'errors.transaction_cancelled' };
    });
  } catch (error) {
    return { success: false, ...toUserError(error, 'db_error') };
  }
}

async function createTransactionAndCash(db, data) {
  const invalid = validateTransactionPayload(data);
  if (invalid) return invalid;

  try {
    return await withTransaction(db, async () => {
      const { worker_id, trans_date, trans_type, amount, notes, project_id } = data;

      // Only an advance moves money out of the cash register. `isAdvance`
      // accepts both the canonical value and the Turkish word written by
      // earlier versions, so an old record still links correctly.
      let linked_cash_id = null;
      const isTr = await getLangIsTr(db);
      const cashLogPart = `${await getProjectLogPart(db, project_id, isTr)}`;

      if (isAdvance(trans_type)) {
        // 1. Create cash_register record
        const cashQuery = `INSERT INTO cash_register (trans_date, type, amount, description, project_id) VALUES (?, ?, ?, ?, ?)`;
        const defaultNote = isTr ? 'Personel Avansı' : 'Personnel advance';
        const cashResult = await db.run(cashQuery, [trans_date, CASH_OUT, amount, notes || defaultNote, project_id || null]);
        linked_cash_id = cashResult.lastID;

        // Audit log for cash_register
        await db.run(
          'INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, project_id) VALUES (?, ?, ?, ?, ?, ?)',
          ['cash_register', linked_cash_id, 'CREATE', null, JSON.stringify({ trans_date, type: CASH_OUT, amount, description: notes || defaultNote, project_id }), project_id || null]
        );
        logger.info(`[DB CREATE] [cash_register]${cashLogPart} Kasaya yeni işlem girildi. Tutar: ${amount} TL (Nakit Çıkışı)`);
      }

      // 2. Create transactions record
      const transQuery = `INSERT INTO transactions (worker_id, trans_date, trans_type, amount, notes, linked_cash_id, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const transResult = await db.run(transQuery, [worker_id, trans_date, trans_type, amount, notes, linked_cash_id, project_id || null]);
      const transaction_id = transResult.lastID;

      // Audit log for transactions
      await db.run(
        'INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, project_id) VALUES (?, ?, ?, ?, ?, ?)',
        ['transactions', transaction_id, 'CREATE', null, JSON.stringify({ worker_id, trans_date, trans_type, amount, notes, linked_cash_id, project_id }), project_id || null]
      );
      logger.info(`[DB CREATE] [transactions]${cashLogPart} Yeni avans/işlem eklendi. Tutar: ${amount} TL`);

      return { success: true, id: transaction_id, linked_cash_id, message: 'İşlem başarıyla eklendi.', messageKey: 'errors.transaction_added' };
    });
  } catch (error) {
    return { success: false, ...toUserError(error, 'db_error') };
  }
}

/**
 * Deletes a subcontractor transaction and its linked cash-register record atomically.
 *
 * The renderer used to issue two independent `db.delete` calls. If the second one
 * failed (or the window closed in between), the cash entry stayed alive while the
 * subcontractor ledger entry was already gone, leaving the project cash balance
 * permanently wrong. Both soft-deletes now share one transaction.
 */
async function deleteSubcontractorTransactionAndCash(transaction_id, db) {
  try {
    return await withTransaction(db, async () => {
      const trans = await db.get('SELECT * FROM subcontractor_transactions WHERE id = ?', [transaction_id]);
      if (!trans) {
        return { success: false, message: 'Transaction not found', messageKey: 'errors.transaction_not_found' };
      }

      await db.run(
        "UPDATE subcontractor_transactions SET is_deleted = 1, deleted_at = datetime('now', 'localtime') WHERE id = ?",
        [transaction_id]
      );
      await db.run(
        'INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, project_id) VALUES (?, ?, ?, ?, ?, ?)',
        ['subcontractor_transactions', transaction_id, 'DELETE', JSON.stringify(trans), JSON.stringify({ is_deleted: 1 }), trans.project_id || null]
      );

      if (trans.linked_cash_id) {
        const cash = await db.get('SELECT * FROM cash_register WHERE id = ?', [trans.linked_cash_id]);
        if (cash) {
          await db.run(
            "UPDATE cash_register SET is_deleted = 1, deleted_at = datetime('now', 'localtime') WHERE id = ?",
            [trans.linked_cash_id]
          );
          await db.run(
            'INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, project_id) VALUES (?, ?, ?, ?, ?, ?)',
            ['cash_register', trans.linked_cash_id, 'DELETE', JSON.stringify(cash), JSON.stringify({ is_deleted: 1 }), cash.project_id || null]
          );
        }
      }

      return { success: true, message: 'İşlem başarıyla silindi.', messageKey: 'errors.transaction_deleted' };
    });
  } catch (error) {
    return { success: false, ...toUserError(error, 'db_error') };
  }
}

/**
 * Creates a subcontractor payment and its linked cash-register record atomically.
 *
 * Mirrors deleteSubcontractorTransactionAndCash: previously the renderer created
 * the cash row first and the subcontractor row afterwards with two separate IPC
 * calls. A failure on the second call left an orphaned cash-out row, inflating
 * project expenses with no matching ledger entry.
 */
async function createSubcontractorTransactionAndCash(db, data) {
  const invalid = validateTransactionPayload(data, { idField: 'subcontractor_id' });
  if (invalid) return invalid;

  try {
    return await withTransaction(db, async () => {
      const {
        subcontractor_id, trans_date, type, amount, description, project_id, tags
      } = data;

      // The stored ledger type is language-neutral. `normalizeLedgerType`
      // accepts the Turkish words written by earlier versions, so an old
      // renderer (or an old MCP call) keeps working during the upgrade.
      const ledgerType = normalizeLedgerType(type);
      if (ledgerType !== LEDGER_PAYMENT && ledgerType !== LEDGER_PROGRESS) {
        return invalidInput('Geçersiz işlem türü.', 'errors.invalid_transaction_type');
      }

      let linked_cash_id = null;

      // Only payments move money out of the register; progress billing is an
      // accrual and must not touch the cash balance.
      if (isLedgerPayment(ledgerType)) {
        const cashResult = await db.run(
          'INSERT INTO cash_register (trans_date, type, amount, description, project_id, tags) VALUES (?, ?, ?, ?, ?, ?)',
          [trans_date, CASH_OUT, amount, description || '', project_id || null, tags || null]
        );
        linked_cash_id = cashResult.lastID;

        await db.run(
          'INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, project_id) VALUES (?, ?, ?, ?, ?, ?)',
          ['cash_register', linked_cash_id, 'CREATE', null, JSON.stringify({ trans_date, type: CASH_OUT, amount, description, project_id }), project_id || null]
        );
      }

      const result = await db.run(
        'INSERT INTO subcontractor_transactions (subcontractor_id, trans_date, type, amount, description, project_id, linked_cash_id, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [subcontractor_id, trans_date, ledgerType, amount, description || null, project_id || null, linked_cash_id, tags || null]
      );

      await db.run(
        'INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, project_id) VALUES (?, ?, ?, ?, ?, ?)',
        ['subcontractor_transactions', result.lastID, 'CREATE', null, JSON.stringify({ subcontractor_id, trans_date, type: ledgerType, amount, description, project_id, linked_cash_id }), project_id || null]
      );

      return { success: true, id: result.lastID, linked_cash_id };
    });
  } catch (error) {
    return { success: false, ...toUserError(error, 'db_error') };
  }
}

module.exports = {
  deleteTransactionAndCash,
  createTransactionAndCash,
  deleteSubcontractorTransactionAndCash,
  createSubcontractorTransactionAndCash
};
