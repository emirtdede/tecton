const { ipcMain, dialog, app, BrowserWindow } = require('electron');
const { getDB, createSnapshot, restoreSnapshot, resetConnection } = require('./database/db');
const { withTransaction } = require('./database/transaction');
const logger = require('./logger');
const { toUserError, toUserErrorPayload } = require('./utils/errorUtils');
const { getDialogString } = require('./utils/mainI18n');
const { getMediaBaseDir, safePathSegment } = require('./utils/mediaPaths');
const fs = require('fs');
const path = require('path');
const cloudRuntime = require('./services/cloudRuntime');
const platform = require('./services/platform');
const updater = require('./services/updater');
const integrationRuntime = require('./services/integrationRuntime');

// Environment is read once: six handlers repeated the same NODE_ENV check and
// the same dev/prod path pair, which drifted easily whenever one copy was
// edited. These helpers are the single source of truth for those paths.
const IS_DEV = process.env.NODE_ENV === 'development';

/** Absolute path to the SQLite database for the current environment. */
function resolveDbPath() {
  return IS_DEV
    ? path.join(__dirname, '../../.tecton-dev-data/database.sqlite')
    : path.join(app.getPath('userData'), 'elektronik-yevmiye.sqlite');
}

/** Absolute path to the media root for the current environment. */
const resolveMediaDir = getMediaBaseDir;

// Initialize Handlers
async function setupHandlers() {
  const db = await getDB();

  // Local API, MCP, CLI and webhooks share one runtime. Handlers are registered
  // after the database exists so a status call can never race the first query.
  integrationRuntime.configure();
  integrationRuntime.registerHandlers();

  // Helper function to log audit
  async function logAudit(table_name, record_id, action, old_values = null, new_values = null) {
    try {
      await db.run(
        'INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values) VALUES (?, ?, ?, ?, ?)',
        [
          table_name, 
          record_id, 
          action, 
          old_values ? JSON.stringify(old_values) : null, 
          new_values ? JSON.stringify(new_values) : null
        ]
      );
    } catch (e) {
      logger.error('Audit log error:', e);
    }
  }

  // --- GENERIC REST-LIKE API ---
  const { readRecord, createRecord, updateRecord, deleteRecord, createBulkRecord, isKnownTable } = require('./services/crudService');

  // 1. READ (SELECT with is_deleted = 0)
  ipcMain.handle('db:read', async (_, { table, conditions = {} }) => {
    try {
      return await readRecord(db, table, conditions);
    } catch (error) {
      logger.error(`Error reading from ${table}:`, error);
      return [];
    }
  });

  // 2. CREATE (INSERT)
  ipcMain.handle('db:create', async (_, { table, data } = {}) => {
    try {
      const result = await createRecord(db, table, data);
      if (!result || result.success !== false) {
        cloudRuntime.scheduleSync();
        integrationRuntime.notify(table, 'create', result?.id);
      }
      return result;
    } catch (error) {
      logger.error(`Error creating record in ${table}:`, error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // 2b. CREATE BULK
  ipcMain.handle('db:create-bulk', async (_, { table, dataList, logMessage } = {}) => {
    try {
      const result = await createBulkRecord(db, table, dataList, logMessage);
      if (!result || result.success !== false) {
        cloudRuntime.scheduleSync();
        integrationRuntime.notify(table, 'create', null);
      }
      return result;
    } catch (error) {
      logger.error(`Error creating bulk records in ${table}:`, error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // 3. UPDATE (UPDATE)
  ipcMain.handle('db:update', async (_, { table, id, data } = {}) => {
    try {
      const result = await updateRecord(db, table, id, data);
      if (!result || result.success !== false) {
        cloudRuntime.scheduleSync();
        integrationRuntime.notify(table, 'update', id);
      }
      return result;
    } catch (error) {
      logger.error(`Error updating record in ${table}:`, error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // 4. DELETE (SOFT DELETE)
  ipcMain.handle('db:delete', async (_, { table, id } = {}) => {
    try {
      const result = await deleteRecord(db, table, id);
      if (!result || result.success !== false) {
        cloudRuntime.scheduleSync();
        integrationRuntime.notify(table, 'delete', id);
      }
      return result;
    } catch (error) {
      logger.error(`Error deleting record in ${table}:`, error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // --- RECYCLE BIN / UNDO API ---
  ipcMain.handle('db:read-deleted', async () => {
    try {
      const rows = await db.all(`
        SELECT r.*, p.name as project_name
        FROM recycle_bin r
        LEFT JOIN projects p ON r.project_id = p.id
        ORDER BY r.deleted_at DESC
      `);
      return rows.map(r => ({
        id: r.id, // recycle_bin id
        table: r.table_name,
        original_id: r.record_id,
        title: r.title,
        deleted_at: r.deleted_at,
        is_deleted: r.is_restored ? 0 : 1, // map to is_deleted for frontend compatibility
        project_id: r.project_id,
        project_name: r.project_name
      }));
    } catch (error) {
      logger.error('Error in db:read-deleted:', error);
      return [];
    }
  });

  // Deliberately unfiltered: the recycle bin needs soft-deleted projects to
  // appear alongside active ones. Every other project query filters
  // is_deleted = 0; do not "fix" this one without checking RecycleBin usage.
  ipcMain.handle('db:read-all-projects', async () => {
    try {
      return await db.all("SELECT * FROM projects ORDER BY sort_order ASC, name ASC");
    } catch (error) {
      logger.error('Error in db:read-all-projects:', error);
      return [];
    }
  });

  ipcMain.handle('db:restore', async (_, { table, id } = {}) => {
    // Everything runs in one transaction: restoring a project touches a dozen
    // child tables, and a failure halfway used to leave the project visible
    // while its workers/timesheets stayed soft-deleted.
    try {
      // id is the recycle_bin.id
      const binItem = await db.get('SELECT * FROM recycle_bin WHERE id = ?', [id]);
      if (!binItem) {
        return { success: false, message: '\u00c7\u00f6p kutusu kayd\u0131 bulunamad\u0131.', messageKey: 'errors.recycle_item_missing' };
      }
      if (!isKnownTable(binItem.table_name) || binItem.table_name === 'audit_logs') {
        return { success: false, message: 'Ge\u00e7ersiz tablo ad\u0131.', messageKey: 'errors.invalid_table' };
      }

      await withTransaction(db, async () => {
        // 1. Mark as restored in recycle_bin table
        await db.run("UPDATE recycle_bin SET is_restored = 1, restored_at = datetime('now', 'localtime') WHERE id = ?", [id]);

        // 2. Set is_deleted = 0 in the original table
        await db.run(`UPDATE ${binItem.table_name} SET is_deleted = 0 WHERE id = ?`, [binItem.record_id]);

        // Cascade restore if transaction has linked cash
        if (binItem.table_name === 'transactions') {
          const trans = await db.get('SELECT * FROM transactions WHERE id = ?', [binItem.record_id]);
          if (trans && trans.linked_cash_id) {
            await db.run('UPDATE cash_register SET is_deleted = 0 WHERE id = ?', [trans.linked_cash_id]);
          }
        }

        // Cascade restore if a subcontractor transaction has linked cash
        if (binItem.table_name === 'subcontractor_transactions') {
          const trans = await db.get('SELECT * FROM subcontractor_transactions WHERE id = ?', [binItem.record_id]);
          if (trans && trans.linked_cash_id) {
            await db.run('UPDATE cash_register SET is_deleted = 0 WHERE id = ?', [trans.linked_cash_id]);
          }
        }

        // If the restored item is a project, cascade restore all related records.
        // This list must stay in sync with the cascade list in crudService.deleteRecord,
        // otherwise a deleted project comes back missing some of its rows.
        if (binItem.table_name === 'projects') {
          const childTables = [
            'workers', 'timesheets', 'transactions', 'cash_register',
            'production_records', 'materials', 'daily_journals',
            'quality_reports', 'subcontractor_ledgers',
            'subcontractor_transactions', 'worker_leaves'
          ];
          for (const t of childTables) {
            await db.run(`UPDATE ${t} SET is_deleted = 0 WHERE project_id = ? AND is_deleted = 1`, [binItem.record_id]);
          }
        }
      });

      return { success: true, message: 'Kay\u0131t ba\u015far\u0131yla geri y\u00fcklendi.', messageKey: 'errors.record_restored' };
    } catch (error) {
      logger.error(`Error restoring record via recycle bin item ${id}:`, error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // --- FINANCE API ---
  const { deleteTransactionAndCash, createTransactionAndCash, deleteSubcontractorTransactionAndCash, createSubcontractorTransactionAndCash } = require('./services/financialService');

  ipcMain.handle('finance:delete-transaction', async (_, { id } = {}) => {
    try {
      return await deleteTransactionAndCash(id, db);
    } catch (error) {
      logger.error('Error deleting transaction:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('subcontractor:delete-transaction', async (_, { id } = {}) => {
    try {
      return await deleteSubcontractorTransactionAndCash(id, db);
    } catch (error) {
      logger.error('Error deleting subcontractor transaction:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('subcontractor:create-transaction', async (_, { data } = {}) => {
    try {
      return await createSubcontractorTransactionAndCash(db, data);
    } catch (error) {
      logger.error('Error creating subcontractor transaction:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('finance:create-advance', async (_, { data } = {}) => {
    try {
      return await createTransactionAndCash(db, data);
    } catch (error) {
      logger.error('Error creating advance:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // --- FINANCE API ---
  const { calculateWage } = require('./services/wageService');
  const { calculateWorkerBalance, calculateBalancesForWorkers } = require('./services/balanceService');

  ipcMain.handle('finance:get-balance', async (_, { worker_id } = {}) => {
    try {
      const balance = await calculateWorkerBalance(worker_id, db);
      return { success: true, balance };
    } catch (error) {
      logger.error('Error getting balance:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // Batched variant used by the dashboard: one IPC call and two grouped SQL
  // queries instead of two round-trips per worker.
  ipcMain.handle('finance:get-balances', async (_, { worker_ids } = {}) => {
    try {
      if (!Array.isArray(worker_ids)) {
        return { success: false, messageKey: 'errors.invalid_payload' };
      }
      const balances = await calculateBalancesForWorkers(worker_ids, db);
      return { success: true, balances };
    } catch (error) {
      logger.error('Error getting balances:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('finance:calculate-wage', async (_, { daily_wage, multiplier, overtime_hours = 0 } = {}) => {
    try {
      // Get settings from DB
      const settings = await db.all('SELECT setting_key, setting_value FROM app_settings');
      const settingsMap = {};
      settings.forEach(s => { settingsMap[s.setting_key] = s.setting_value });

      const standard_hours = Number(settingsMap['standard_daily_hours']) || 8;
      const overtime_multiplier = Number(settingsMap['overtime_multiplier']) || 1.5;

      if (standard_hours <= 0) {
        return { success: false, message: 'Çalışma saati 0 veya daha küçük olamaz.', messageKey: 'errors.hours_must_be_positive' };
      }

      const wage = calculateWage({
        daily_wage,
        multiplier,
        overtime_hours,
        overtime_multiplier,
        standard_hours
      });

      return { success: true, wage };
    } catch (error) {
      logger.error('Error calculating wage:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // --- REPORTING API ---
  const { generateWorkerStatement, generateCompanyFinancialSummary, generateGroupStatement } = require('./services/reportService');

  ipcMain.handle('finance:worker-statement', async (_, { worker_id, start_date, end_date } = {}) => {
    try {
      return await generateWorkerStatement(db, worker_id, start_date, end_date);
    } catch (error) {
      logger.error('Error generating worker statement:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('finance:company-report', async (_, { year, month, projectId } = {}) => {
    try {
      return await generateCompanyFinancialSummary(db, year, month, projectId);
    } catch (error) {
      logger.error('Error generating company report:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('finance:group-statement', async (_, { start_date, end_date, project_id } = {}) => {
    try {
      return await generateGroupStatement(db, start_date, end_date, project_id);
    } catch (error) {
      logger.error('Error generating group statement:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // --- SYSTEM API ---
  ipcMain.handle('system:backup-db', async (event) => {
    try {
      const dbPath = resolveDbPath();

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: await getDialogString(db, 'backup_title'),
        defaultPath: 'elektronik-yevmiye-backup.sqlite',
        filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }]
      });

      if (canceled || !filePath) {
        return { success: false, message: 'İşlem iptal edildi', messageKey: 'errors.operation_cancelled' };
      }

      // A raw copy of a live WAL-mode database can miss everything still in the
      // `-wal` file (the newest commits). VACUUM INTO produces a consistent,
      // fully checkpointed copy without stopping the app.
      const tempPath = `${filePath}.tmp-${Date.now()}`;
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        await db.run('VACUUM INTO ?', [tempPath]);
        fs.renameSync(tempPath, filePath);
      } finally {
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch (cleanupErr) {
            logger.warn('Backup temp file cleanup failed:', cleanupErr.message);
          }
        }
      }
      return { success: true, message: 'Yedekleme başarıyla tamamlandı!', messageKey: 'errors.backup_completed' };
    } catch (error) {
      logger.error('Backup error:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // `= {}` so a call with no payload (or `undefined`) does not throw a raw
  // "Cannot destructure property 'startDate' of 'undefined'" TypeError *outside*
  // the try block, which would reject the invoke with an internal error string.
  ipcMain.handle('system:read-logs', async (event, { startDate, endDate } = {}) => {
    try {
      const logs = [];
      const logsDir = path.join(app.getPath('documents'), 'TectonBackups', 'SystemLogs-Backups');

      // Hard caps: an unbounded recursive read can pull gigabytes into the main
      // process heap and freeze/crash the whole app. 20 MB / 200k lines is far
      // more than the log viewer can usefully render.
      const MAX_BYTES = 20 * 1024 * 1024;
      const MAX_LINES = 200000;
      const budget = { remainingBytes: MAX_BYTES, remainingLines: MAX_LINES };

      const readLogLines = async (logPath) => {
        if (budget.remainingBytes <= 0 || budget.remainingLines <= 0) return [];
        const stat = await fs.promises.stat(logPath);
        if (!stat.isFile() || stat.size > budget.remainingBytes) return [];
        const content = await fs.promises.readFile(logPath, 'utf8');
        budget.remainingBytes -= stat.size;
        const lines = content.split('\n').filter(l => l.trim() !== '');
        const sliced = lines.slice(0, budget.remainingLines);
        budget.remainingLines -= sliced.length;
        return sliced;
      };

      const getAllLogFiles = async (dir) => {
        let results = [];
        let entries;
        try {
          entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch (err) {
          if (err.code === 'ENOENT') return results;
          throw err;
        }
        for (const entry of entries) {
          const filePath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results = results.concat(await getAllLogFiles(filePath));
          } else if (entry.name.endsWith('.log')) {
            results.push(filePath);
          }
        }
        return results;
      };

      if (!startDate || !endDate) {
        // Read all logs recursively
        const logFiles = await getAllLogFiles(logsDir);
        // Sort files chronologically (by filename)
        logFiles.sort();

        for (const logPath of logFiles) {
          logs.push(...(await readLogLines(logPath)));
          if (budget.remainingBytes <= 0 || budget.remainingLines <= 0) break;
        }
      } else {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          // Expected user input rejection: no error log / stack trace.
          return { success: false, ...toUserErrorPayload('invalid_input'), logs: [] };
        }
        if (start > end) {
          return { success: false, ...toUserErrorPayload('invalid_input'), logs: [] };
        }
        // Guard against a typo like 1900-01-01 producing a 45,000-iteration loop.
        if ((end - start) / 86400000 > 366) {
          return { success: false, ...toUserErrorPayload('invalid_input'), logs: [] };
        }

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const year = d.getFullYear().toString();
          const month = (d.getMonth() + 1).toString().padStart(2, '0');
          const day = d.getDate().toString().padStart(2, '0');

          // db.js archives audit logs as `audit-YYYY-MM-DD.log`; the old code
          // only looked for `YYYY-MM-DD.log`, so a date-filtered read always
          // came back empty even though the files existed.
          const candidates = [
            path.join(logsDir, year, month, `audit-${year}-${month}-${day}.log`),
            path.join(logsDir, year, month, `${year}-${month}-${day}.log`)
          ];
          for (const logPath of candidates) {
            try {
              logs.push(...(await readLogLines(logPath)));
            } catch (err) {
              if (err.code !== 'ENOENT') throw err;
            }
          }
          if (budget.remainingBytes <= 0 || budget.remainingLines <= 0) break;
        }
      }
      return { success: true, logs, truncated: budget.remainingBytes <= 0 || budget.remainingLines <= 0 };
    } catch (error) {
      logger.error('Read logs error:', error);
      return { success: false, ...toUserError(error, 'file_error'), logs: [] };
    }
  });

  ipcMain.handle('system:create-snapshot', async () => {
    try {
      return createSnapshot('restore-point');
    } catch (error) {
      logger.error('system:create-snapshot error:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('system:restore-snapshot', async () => {
    try {
      const result = await restoreSnapshot('restore-point');
      if (result.success) {
        // The restore closed the shared connection; every handler still holds
        // that closed handle, so restart after the IPC reply is delivered.
        setTimeout(() => {
          app.relaunch();
          app.exit(0);
        }, 400);
      }
      return result;
    } catch (error) {
      logger.error('system:restore-snapshot error:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('system:vacuum-db', async () => {
    try {
      await db.run('VACUUM');
      return { success: true };
    } catch (error) {
      logger.error('Vacuum error:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('system:set-cloud-folder', async () => {
    try {
      const existing = await db.get("SELECT id, setting_value FROM app_settings WHERE setting_key = 'cloud_sync_folder'");
      const defaultPath = existing && existing.setting_value ? existing.setting_value : app.getPath('documents');

      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: await getDialogString(db, 'cloud_folder_title'),
        defaultPath: defaultPath,
        properties: ['openDirectory']
      });

      if (canceled || filePaths.length === 0) {
        return { success: false, message: 'İşlem iptal edildi', messageKey: 'errors.operation_cancelled' };
      }

      const folderPath = filePaths[0];

      // Upsert into app_settings
      if (existing) {
        await db.run("UPDATE app_settings SET setting_value = ? WHERE id = ?", [folderPath, existing.id]);
      } else {
        await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", 
          ['cloud_sync_folder', folderPath, 'Sessiz Bulut Yedekleme Klasörü']);
      }

      return { success: true, folderPath };
    } catch (error) {
      logger.error('Set cloud folder error:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // --- NEW WEATHER AND MEDIA IPC HANDLERS ---
  ipcMain.handle('system:get-weather', async (_, { location, lang, date } = {}) => {
    try {
      if (!location) {
        return { success: false, message: 'Lokasyon belirtilmedi.', messageKey: 'errors.location_required' };
      }
      
      const apiKeySetting = await db.get("SELECT setting_value FROM app_settings WHERE setting_key = 'weather_api_key'");
      const apiKey = (apiKeySetting && apiKeySetting.setting_value) || process.env.OPENWEATHER_API_KEY || '';
      if (!apiKey) {
        return {
          success: false,
          errorType: 'unauthorized',
          message: lang === 'tr'
            ? 'Hava durumu API anahtarı tanımlı değil. Lütfen Ayarlar sayfasından girin.'
            : 'Weather API key is not configured. Please set it in Settings.'
        };
      }
      
      const openWeatherLangMap = {
        ar: 'ar',
        cs: 'cz',
        da: 'da',
        de: 'de',
        es: 'es',
        fr: 'fr',
        hi: 'hi',
        it: 'it',
        ja: 'ja',
        ko: 'kr',
        nl: 'nl',
        no: 'no',
        pl: 'pl',
        pt: 'pt',
        ru: 'ru',
        sv: 'sv',
        zh: 'zh_cn',
        tr: 'tr',
        en: 'en'
      };
      const apiLang = openWeatherLangMap[lang] || 'tr';

      let response;
      try {
        response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&lang=${apiLang}`
        );
      } catch (networkError) {
        return {
          success: false,
          errorType: 'offline',
          message: lang === 'tr'
            ? 'İnternet bağlantısı yok veya hava durumu servisine ulaşılamıyor.'
            : lang === 'hi'
            ? 'इंटरनेट कनेक्शन नहीं है या मौसम सेवा तक नहीं पहुंचा जा सकता है।'
            : lang === 'ar'
            ? 'لا يوجد اتصال بالإنترنت أو لا يمكن الوصول إلى خدمة الطقس.'
            : 'No internet connection or weather service is unreachable.'
        };
      }

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            errorType: 'unauthorized',
            message: lang === 'tr'
              ? 'Hava durumu API anahtarı (API Key) geçersiz veya süresi dolmuş. Lütfen Ayarlar sayfasından güncelleyin.'
              : lang === 'hi'
              ? 'मौसम API कुंजी अमान्य है या समाप्त हो गई है। कृपया इसे सेटिंग्स में अपडेट करें।'
              : lang === 'ar'
              ? 'مفتاح API للطقس غير صالح أو منتهي الصلاحية. يرجى تحديثه في الإعدادات.'
              : 'Weather API key is invalid or expired. Please update it in Settings.'
          };
        }
        if (response.status === 404) {
          return {
            success: false,
            errorType: 'not_found',
            message: lang === 'tr'
              ? `Belirtilen konum bulunamadı: "${location}".`
              : lang === 'hi'
              ? `निर्दिष्ट स्थान नहीं मिला: "${location}".`
              : lang === 'ar'
              ? `لم يتم العثور على الموقع المحدد: "${location}".`
              : `Specified location not found: "${location}".`
          };
        }
        return {
          success: false,
          errorType: 'api_error',
          message: lang === 'tr'
            ? `Hava durumu servisi hata döndürdü (Kod: ${response.status}).`
            : lang === 'hi'
            ? `मौसम सेवा ने एक त्रुटि दी (कोड: ${response.status}).`
            : lang === 'ar'
            ? `أرجعت خدمة الطقس خطأ (الرمز: ${response.status}).`
            : `Weather service returned an error (Code: ${response.status}).`
        };
      }

      const weatherData = await response.json();

      // OpenWeather returns `{ weather: [] }` for some coordinates and omits
      // `main` on partial responses. Indexing [0] unconditionally threw a
      // TypeError that surfaced to the user as a generic "db_error".
      const condition = Array.isArray(weatherData.weather) ? weatherData.weather[0] : null;
      const tempC = weatherData?.main?.temp;
      if (!condition || typeof tempC !== 'number' || !Number.isFinite(tempC)) {
        return {
          success: false,
          errorType: 'not_found',
          message: lang === 'tr'
            ? `Belirtilen konum için hava durumu verisi bulunamadı: "${location}".`
            : lang === 'hi'
            ? `निर्दिष्ट स्थान के लिए मौसम डेटा नहीं मिला: "${location}".`
            : lang === 'ar'
            ? `لم يتم العثور على بيانات الطقس للموقع المحدد: "${location}".`
            : `No weather data found for the specified location: "${location}".`
        };
      }

      return {
        success: true,
        temp: Math.round(tempC),
        desc: condition.description || '',
        icon: condition.icon || '',
        simulated: false
      };
    } catch (error) {
      logger.error('Weather fetching error:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('media:save-photo-base64', async (_, { projectId, base64Data } = {}) => {
    try {
      if (!base64Data) return { success: false, message: 'Veri boş', messageKey: 'errors.empty_data' };
      const safeProjectId = safePathSegment(projectId);

      const baseDir = resolveMediaDir();

      const projectDir = path.join(baseDir, `project_${safeProjectId}`);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      // base64Data: "data:image/webp;base64,..."
      const commaIdx = base64Data.indexOf(',');
      const cleanBase64 = commaIdx !== -1 ? base64Data.slice(commaIdx + 1) : base64Data;

      // Reject oversized payloads BEFORE decoding. Buffer.from() materialises the
      // whole string as bytes, so checking buffer.length afterwards lets a caller
      // force a large allocation (and a synchronous stall in the main process)
      // just by sending a big string. Base64 is ~4/3 of the decoded size.
      const MAX_BYTES = 20 * 1024 * 1024;
      const MAX_BASE64_CHARS = Math.ceil(MAX_BYTES * 4 / 3) + 4;
      if (cleanBase64.length > MAX_BASE64_CHARS) {
        return { success: false, message: 'Dosya boyutu çok büyük (maks. 20MB)', messageKey: 'errors.file_too_large' };
      }

      const buffer = Buffer.from(cleanBase64, 'base64');
      if (buffer.length > MAX_BYTES) {
        return { success: false, message: 'Dosya boyutu çok büyük (maks. 20MB)', messageKey: 'errors.file_too_large' };
      }

      const uniqueName = `${Date.now()}_${Math.floor(Math.random() * 10000)}.webp`;
      const destPath = path.join(projectDir, uniqueName);

      fs.writeFileSync(destPath, buffer);

      return { success: true, relativePath: `project_${safeProjectId}/${uniqueName}` };
    } catch (error) {
      logger.error('Save photo base64 error:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('media:read-photo', async (_, { relativePath } = {}) => {
    try {
      if (!relativePath) return { success: false, message: 'Dosya belirtilmedi', messageKey: 'errors.file_not_specified' };
      
      const baseDir = resolveMediaDir();
      
      const filePath = path.resolve(baseDir, relativePath);
      const relative = path.relative(baseDir, filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return { success: false, message: 'Geçersiz dosya yolu', messageKey: 'errors.invalid_path' };
      }
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'base64');
        const ext = path.extname(filePath).toLowerCase();
        let mime = 'image/jpeg';
        if (ext === '.png') mime = 'image/png';
        return { success: true, base64: `data:${mime};base64,${content}` };
      }
      return { success: false, message: 'Dosya bulunamadı', messageKey: 'errors.file_not_found' };
    } catch (error) {
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // --- LAN MOBILE UPLOAD & DB RESTORE HANDLERS ---
  const { startLANServer, stopLANServer } = require('./services/lanServer');
  const QRCode = require('qrcode');

  ipcMain.handle('system:start-lan-server', async (event, { projectId, projectName, lang } = {}) => {
    try {
      const webContents = event.sender;
      const window = BrowserWindow.fromWebContents(webContents);
      
      const result = await startLANServer(window, lang);
      if (result.success) {
        const url = `http://${result.ip}:${result.port}?projectId=${encodeURIComponent(projectId || '')}&projectName=${encodeURIComponent(projectName || 'Genel')}&token=${encodeURIComponent(result.token || '')}`;
        const qrCodeDataUrl = await QRCode.toDataURL(url);
        return { success: true, url, qrCodeDataUrl };
      }
      return { success: false, message: 'Sunucu başlatılamadı.', messageKey: 'errors.server_start_failed' };
    } catch (error) {
      logger.error('Start LAN server error:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('system:stop-lan-server', async () => {
    try {
      stopLANServer();
      return { success: true };
    } catch (error) {
      logger.error('Stop LAN server error:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('system:restore-db-file', async (_, { filePath } = {}) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, message: 'Geçersiz dosya yolu.', messageKey: 'errors.invalid_path' };
      }
      
      const dbPath = resolveDbPath();

      // Verify new backup integrity BEFORE touching current DB
      const sqlite3 = require('sqlite3');
      const checkDB = new Promise((resolve) => {
        const tempDb = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
          if (err) return resolve(false);
          tempDb.get('PRAGMA integrity_check', (err, row) => {
            tempDb.close();
            if (err || row.integrity_check !== 'ok') resolve(false);
            else resolve(true);
          });
        });
      });

      const isValid = await checkDB;
      if (!isValid) {
        return { success: false, message: 'RESTORE_CORRUPTED' };
      }

      // Snapshot the current database. A raw copy of a live WAL database can
      // miss committed data still sitting in `-wal`, so use VACUUM INTO.
      const oldBackupsDir = path.join(app.getPath('userData'), 'old_backups');
      if (!fs.existsSync(oldBackupsDir)) {
        fs.mkdirSync(oldBackupsDir, { recursive: true });
      }
      const now = new Date();
      const dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + '-' + String(now.getMinutes()).padStart(2,'0') + '-' + String(now.getSeconds()).padStart(2,'0');
      const backupPath = path.join(oldBackupsDir, `backup_before_restore_${dateStr}.sqlite`);
      const tempBackupPath = `${backupPath}.tmp`;
      try {
        if (fs.existsSync(tempBackupPath)) fs.unlinkSync(tempBackupPath);
        await db.run('VACUUM INTO ?', [tempBackupPath]);
        fs.renameSync(tempBackupPath, backupPath);
      } catch (snapshotErr) {
        if (fs.existsSync(tempBackupPath)) {
          try { fs.unlinkSync(tempBackupPath); } catch (cleanupErr) { /* ignore */ }
        }
        logger.error('Pre-restore snapshot failed:', snapshotErr);
        return { success: false, ...toUserError(snapshotErr, 'db_error') };
      }

      // WAL sidecars belong to the OLD database. If they survive the file swap
      // SQLite can replay them onto the restored file, mixing old rows into the
      // new database or corrupting it outright.
      const removeSqliteSidecars = () => {
        for (const suffix of ['-wal', '-shm', '-journal']) {
          const sidecar = `${dbPath}${suffix}`;
          try {
            if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
          } catch (err) {
            logger.warn(`Failed to remove ${suffix} after DB swap:`, err.message);
          }
        }
      };

      if (db && typeof db.close === 'function') {
        await db.close();
      }

      try {
        removeSqliteSidecars();
        fs.copyFileSync(filePath, dbPath);
      } catch (copyErr) {
        // Roll back to the consistent snapshot and restart: the connection is
        // already closed, so the running process can no longer query the DB.
        try {
          removeSqliteSidecars();
          fs.copyFileSync(backupPath, dbPath);
        } catch (rollbackErr) {
          logger.error('DB restore rollback failed:', rollbackErr);
        }
        resetConnection();
        // Give the IPC reply time to reach the renderer, then relaunch so every
        // handler gets a fresh connection instead of the closed handle.
        setTimeout(() => {
          app.relaunch();
          app.exit(0);
        }, 400);
        return { success: false, message: 'RESTORE_CORRUPTED' };
      }

      // Same restart rule on success: all IPC handlers captured the old `db`
      // handle, which is closed now.
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 400);

      return { success: true };
    } catch (error) {
      logger.error('DB Restore error:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // --- WINDOW CONTROLS ---
  ipcMain.handle('window:minimize', (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) window.minimize();
      return { success: true };
    } catch (err) {
      logger.error('window:minimize error:', err);
      return { success: false, ...toUserError(err, 'unknown_error') };
    }
  });

  ipcMain.handle('window:maximize', (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        if (window.isMaximized()) {
          window.unmaximize();
        } else {
          window.maximize();
        }
        return { success: true, maximized: window.isMaximized() };
      }
      return { success: false };
    } catch (err) {
      logger.error('window:maximize error:', err);
      return { success: false, ...toUserError(err, 'unknown_error') };
    }
  });

  ipcMain.handle('window:close', (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) window.close();
      return { success: true };
    } catch (err) {
      logger.error('window:close error:', err);
      return { success: false, ...toUserError(err, 'unknown_error') };
    }
  });

  ipcMain.handle('window:set-zoom', (event, { factor } = {}) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) return { success: false };
      const numeric = Number(factor);
      const clamped = Number.isFinite(numeric) ? Math.min(1.6, Math.max(0.8, numeric)) : 1;
      window.webContents.setZoomFactor(clamped);
      return { success: true, zoom: clamped };
    } catch (err) {
      logger.error('window:set-zoom error:', err);
      return { success: false, ...toUserError(err, 'unknown_error') };
    }
  });

  ipcMain.handle('system:info-report', async () => {
    try {
      const os = require('os');
      const { getDB } = require('./database/db');
      const database = await getDB();
      const isDev = process.env.NODE_ENV === 'development';
      const dbPath = isDev
        ? path.join(__dirname, '../../.tecton-dev-data/database.sqlite')
        : path.join(app.getPath('userData'), 'elektronik-yevmiye.sqlite');

      let dbSize = 0;
      try {
        dbSize = fs.statSync(dbPath).size;
      } catch {
        dbSize = 0;
      }

      let cloud = 'not connected';
      try {
        const row = await database.get("SELECT setting_value FROM app_settings WHERE setting_key = 'cloud_sync_folder'");
        const provider = await database.get("SELECT setting_value FROM app_settings WHERE setting_key = 'cloud_provider'");
        if (row && row.setting_value) {
          cloud = `${(provider && provider.setting_value) || 'custom'} (${row.setting_value})`;
        }
      } catch {
        cloud = 'unknown';
      }

      const lines = [
        'Tecton support report',
        `Generated: ${new Date().toISOString()}`,
        `Version: ${app.getVersion()}`,
        `Packaged: ${app.isPackaged}`,
        `Platform: ${process.platform} ${process.arch}`,
        `Windows: ${os.release()}`,
        `Locale: ${app.getLocale()}`,
        `Installer language: ${platform.readInstallerLanguage() || 'not set'}`,
        `Electron: ${process.versions.electron}`,
        `Chromium: ${process.versions.chrome}`,
        `Node: ${process.versions.node}`,
        `Database: ${dbPath} (${Math.round(dbSize / 1024)} KB)`,
        `Cloud backup: ${cloud}`,
        `User data: ${app.getPath('userData')}`,
      ];
      return { success: true, report: lines.join('\r\n') };
    } catch (error) {
      logger.error('system:info-report error:', error);
      return { success: false, ...toUserError(error, 'unknown_error') };
    }
  });

  // --- SYSTEM UTILS ---
  ipcMain.handle('system:open-old-backups-folder', () => {
    try {
      const { shell } = require('electron');
      const oldBackupsDir = path.join(app.getPath('userData'), 'old_backups');
      if (!fs.existsSync(oldBackupsDir)) {
        fs.mkdirSync(oldBackupsDir, { recursive: true });
      }
      shell.showItemInFolder(oldBackupsDir);
      return { success: true };
    } catch (error) {
      logger.error('Open old backups folder error:', error);
      return { success: false, ...toUserError(error, 'file_error') };
    }
  });

  ipcMain.handle('system:open-logs-folder', () => {
    try {
      const { shell } = require('electron');
      const logsDir = path.join(app.getPath('documents'), 'TectonBackups', 'SystemLogs-Backups');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      shell.openPath(logsDir);
      return { success: true };
    } catch (error) {
      logger.error('Open logs folder error:', error);
      return { success: false, ...toUserError(error, 'file_error') };
    }
  });

  ipcMain.handle('system:change-desktop-icon', async (_, { theme } = {}) => {
    try {
      const { exec } = require('child_process');
      const iconName = theme === 'dark' ? 'tecton-tray-dark.ico' : 'tecton-tray-light.ico';
      const sourceIconPath = IS_DEV
        ? path.join(__dirname, '../../tecton_assets', iconName)
        : path.join(app.getAppPath(), 'tecton_assets', iconName);
      
      if (!fs.existsSync(sourceIconPath)) {
        return { success: false, message: 'İkon dosyası bulunamadı.', messageKey: 'errors.icon_not_found' };
      }

      const userDataPath = app.getPath('userData');
      const realIconPath = path.join(userDataPath, iconName);
      fs.copyFileSync(sourceIconPath, realIconPath);

      const desktopPath = app.getPath('desktop');
      const shortcutPath = path.join(desktopPath, 'Tecton.lnk');

      if (fs.existsSync(shortcutPath)) {
        const { shell } = require('electron');
        const updateSuccess = shell.writeShortcutLink(shortcutPath, 'update', {
          icon: realIconPath,
          iconIndex: 0
        });
        
        if (updateSuccess) {
          exec('ie4uinit.exe -show');
          return { success: true };
        } else {
          return { success: false, message: 'Kısayol güncellenemedi.', messageKey: 'errors.shortcut_update_failed' };
        }
      } else {
        return { success: false, message: 'Masaüstü kısayolu bulunamadı (Tecton.lnk).', messageKey: 'errors.shortcut_missing' };
      }
    } catch (err) {
      return { success: false, ...toUserError(err, 'file_error') };
    }
  });

  // --- CLOUD SYNC (serverless folder sync) ---
  ipcMain.handle('cloud:status', async () => {
    try {
      return await cloudRuntime.status();
    } catch (error) {
      logger.error('cloud:status error:', error);
      return { ok: false, ...toUserError(error, 'unknown_error') };
    }
  });

  ipcMain.handle('cloud:connect', async (_, { provider, folder } = {}) => {
    try {
      return await cloudRuntime.connect(provider, folder);
    } catch (error) {
      logger.error('cloud:connect error:', error);
      return { ok: false, ...toUserError(error, 'file_error') };
    }
  });

  ipcMain.handle('cloud:disconnect', async () => {
    try {
      return await cloudRuntime.disconnect();
    } catch (error) {
      logger.error('cloud:disconnect error:', error);
      return { ok: false, ...toUserError(error, 'unknown_error') };
    }
  });

  ipcMain.handle('cloud:sync-now', async () => {
    try {
      return await cloudRuntime.syncNow();
    } catch (error) {
      logger.error('cloud:sync-now error:', error);
      return { ok: false, ...toUserError(error, 'file_error') };
    }
  });

  ipcMain.handle('cloud:restore', async () => {
    try {
      return await cloudRuntime.restore();
    } catch (error) {
      logger.error('cloud:restore error:', error);
      return { ok: false, ...toUserError(error, 'db_error') };
    }
  });

  ipcMain.handle('cloud:open-folder', async () => {
    try {
      const { shell } = require('electron');
      const row = await db.get("SELECT setting_value FROM app_settings WHERE setting_key = 'cloud_sync_folder'");
      const folder = row && row.setting_value;
      if (!folder) return { success: false, messageKey: 'cloud.connect_failed' };
      const opened = await shell.openPath(folder);
      return opened ? { success: false, ...toUserError(new Error(opened), 'file_error') } : { success: true };
    } catch (error) {
      logger.error('cloud:open-folder error:', error);
      return { success: false, ...toUserError(error, 'file_error') };
    }
  });

  ipcMain.handle('cloud:choose-folder', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: await getDialogString(db, 'cloud_folder_title'),
        properties: ['openDirectory', 'createDirectory'],
      });
      if (canceled || !filePaths.length) return { success: false, cancelled: true };
      return { success: true, folder: filePaths[0] };
    } catch (error) {
      logger.error('cloud:choose-folder error:', error);
      return { success: false, ...toUserError(error, 'file_error') };
    }
  });

  ipcMain.handle('cloud:set-auto-sync', async (_, { enabled } = {}) => {
    try {
      await db.run(
        "UPDATE app_settings SET setting_value = ? WHERE setting_key = 'cloud_auto_sync'",
        [enabled ? 'true' : 'false']
      );
      return { success: true };
    } catch (error) {
      logger.error('cloud:set-auto-sync error:', error);
      return { success: false, ...toUserError(error, 'db_error') };
    }
  });

  // --- PLATFORM (Windows integration) ---
  ipcMain.handle('platform:info', async () => {
    const read = async (key, fallback) => {
      const row = await db.get('SELECT setting_value FROM app_settings WHERE setting_key = ?', [key]);
      return row && row.setting_value !== undefined ? row.setting_value : fallback;
    };
    return {
      platform: process.platform,
      isPackaged: app.isPackaged,
      version: app.getVersion(),
      hotkey: platform.HOTKEY,
      installerLanguage: platform.readInstallerLanguage(),
      systemLocale: (() => {
        try {
          return app.getLocale();
        } catch {
          return null;
        }
      })(),
      autostart: (await read('autostart', 'false')) === 'true',
      closeToTray: (await read('close_to_tray', 'true')) === 'true',
      startMinimized: (await read('start_minimized', 'false')) === 'true',
      appIcon: await read('app_icon', 'auto'),
    };
  });

  ipcMain.handle('platform:set-start-with-windows', async (_, { enabled } = {}) => {
    try {
      platform.applyLoginItem(enabled);
      await db.run("UPDATE app_settings SET setting_value = ? WHERE setting_key = 'autostart'", [enabled ? 'true' : 'false']);
      await platform.refreshTrayMenu();
      return { success: true };
    } catch (error) {
      logger.error('platform:set-start-with-windows error:', error);
      return { success: false, ...toUserError(error, 'unknown_error') };
    }
  });

  ipcMain.handle('platform:apply-icon', async (_, { surface } = {}) => {
    try {
      platform.setSurface(surface);
      const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
      if (win && typeof win.setIcon === 'function') {
        const { nativeImage } = require('electron');
        const image = nativeImage.createFromPath(platform.iconPath(surface, 'ico'));
        if (!image.isEmpty()) win.setIcon(image);
      }
      return { success: true };
    } catch (error) {
      logger.error('platform:apply-icon error:', error);
      return { success: false, ...toUserError(error, 'unknown_error') };
    }
  });

  ipcMain.handle('platform:show-window', () => {
    platform.showWindow();
    return { success: true };
  });

  ipcMain.handle('platform:launch-route', () => {
    const arg = process.argv.find((item) => item.startsWith('--route='));
    return arg ? arg.slice('--route='.length) : null;
  });

  // --- UPDATES ---
  ipcMain.handle('update:check', async () => updater.check());
  ipcMain.handle('update:install', async () => updater.install());
  ipcMain.handle('update:status', async () => updater.getStatus());

}

setupHandlers().catch((err) => {
  logger.error('Failed to initialize IPC handlers:', err);
  const { dialog } = require('electron');
  dialog.showErrorBox(
    'Başlatma Hatası',
    `Veritabanı veya servisler başlatılamadı:\n${err.message}`
  );
});
