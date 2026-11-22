const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const AdmZip = require('adm-zip');
const logger = require('../logger');
const { toUserError } = require('../utils/errorUtils');
const { removeMediaFile, removeMediaProjectDir } = require('../utils/mediaPaths');
const { TABLES_SQL, INDEXES_SQL } = require('./schema');
const { runExclusive } = require('./transaction');

let dbPromise;

function findLatestBackup(backupFolder) {
  try {
    if (!fs.existsSync(backupFolder)) return null;
    let sqliteFiles = [];
    const traverse = (dir) => {
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          traverse(fullPath);
        } else if (file.endsWith('.sqlite') && file.startsWith('elektronik-yevmiye-backup-')) {
          sqliteFiles.push(fullPath);
        }
      });
    };
    traverse(backupFolder);
    if (sqliteFiles.length === 0) return null;
    sqliteFiles.sort((a, b) => b.localeCompare(a));
    return sqliteFiles[0];
  } catch (err) {
    logger.error('Error finding latest backup:', err);
    return null;
  }
}

let initPromise = null;

/**
 * SQLite reports an already-applied `ALTER TABLE ... ADD COLUMN` with
 * "duplicate column name". Every other ALTER failure (disk full, locked file,
 * unsupported schema) is a real problem and must not be swallowed.
 */
function isDuplicateColumnError(err) {
  const message = err && err.message ? String(err.message) : '';
  return /duplicate column name/i.test(message);
}

async function getDB() {
  if (dbPromise) return dbPromise;
  if (initPromise) return initPromise;

  initPromise = (async () => {

  const isDev = process.env.NODE_ENV === 'development';
  const dbPath = isDev 
    ? path.join(__dirname, '../../../.tecton-dev-data/database.sqlite')
    : path.join(app.getPath('userData'), 'elektronik-yevmiye.sqlite');

  let db;
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
  } catch (err) {
    logger.error('Failed to open primary database. Attempting auto-recovery...', err);
    const backupDir = app 
      ? path.join(app.getPath('documents'), 'TectonBackups', 'Database-Backups') 
      : path.join(__dirname, '../../.tecton-dev-data/Database-Backups');
    
    const latestBackup = findLatestBackup(backupDir);
    if (latestBackup && fs.existsSync(latestBackup)) {
      logger.info(`[Auto-Recovery] Found valid backup: ${latestBackup}. Restoring...`);
      fs.copyFileSync(latestBackup, dbPath);
      db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
    } else {
      logger.error('[Auto-Recovery] No valid backups found to recover from.');
      throw err;
    }
  }

  // dbPromise set deferred

  // Connection hardening:
  // - foreign_keys: SQLite ignores FK constraints unless explicitly enabled
  //   (every REFERENCES clause in the schema would otherwise be decorative).
  // - journal_mode = WAL: readers no longer block the writer, which matters for
  //   the backup/VACUUM/archiving tasks that run alongside the UI.
  // - busy_timeout: avoids instant SQLITE_BUSY failures when two writes overlap.
  try {
    await db.run('PRAGMA foreign_keys = ON');
    await db.run('PRAGMA journal_mode = WAL');
    await db.run('PRAGMA busy_timeout = 5000');
  } catch (pragmaErr) {
    logger.error('Failed to apply SQLite PRAGMAs:', pragmaErr);
  }

  // Verify clean shutdown state and perform integrity check if it was unclean
  try {
    const settingTableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'");
    if (settingTableExists) {
      const cleanSetting = await db.get("SELECT setting_value FROM app_settings WHERE setting_key = 'clean_shutdown'");
      if (cleanSetting) {
        if (cleanSetting.setting_value === '0') {
          logger.warn('[Integrity Check] Unclean shutdown detected. Checking database integrity...');
          const check = await db.get('PRAGMA integrity_check');
          logger.info('[Integrity Check] Result:', check);
          if (check && check.integrity_check !== 'ok') {
            logger.error('[Integrity Check] Database is corrupted! Attempting recovery from backup...');
            await db.close();
            const backupDir = app 
              ? path.join(app.getPath('documents'), 'TectonBackups', 'Database-Backups') 
              : path.join(__dirname, '../../.tecton-dev-data/Database-Backups');
            const latestBackup = findLatestBackup(backupDir);
            if (latestBackup) {
              fs.copyFileSync(latestBackup, dbPath);
              db = await open({ filename: dbPath, driver: sqlite3.Database });
              // dbPromise set deferred
            }
          }
        }
        await db.run("UPDATE app_settings SET setting_value = '0' WHERE setting_key = 'clean_shutdown'");
      } else {
        await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['clean_shutdown', '0', 'Clean Shutdown Status (0=no, 1=yes)']);
      }
    }
  } catch (checkErr) {
    logger.error('[Integrity Check] Failed to run integrity verification:', checkErr);
  }

  // Create tables (Zero-Code Change Architecture)
  await db.exec(TABLES_SQL);

  // Migrations for existing DB
  try {
    await db.run('ALTER TABLE projects ADD COLUMN sort_order INTEGER DEFAULT 0');
  } catch (err) {
    if (!isDuplicateColumnError(err)) {
      logger.error('Schema migration failed:', err);
      throw err;
    }
  }

  try {
    await db.run('ALTER TABLE workers ADD COLUMN group_id INTEGER REFERENCES worker_groups(id)');
  } catch (err) {
    if (!isDuplicateColumnError(err)) {
      logger.error('Schema migration failed:', err);
      throw err;
    }
  }

  try {
    await db.run('ALTER TABLE workers ADD COLUMN tc_no TEXT');
  } catch (err) {
    if (!isDuplicateColumnError(err)) {
      logger.error('Schema migration failed:', err);
      throw err;
    }
  }

  // Project ID & ISG Date Migrations for existing tables
  const tablesWithProjectId = ['workers', 'timesheets', 'transactions', 'cash_register', 'subcontractor_transactions'];
  for (const t of tablesWithProjectId) {
    try {
      await db.run(`ALTER TABLE ${t} ADD COLUMN project_id INTEGER REFERENCES projects(id)`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) {
        logger.error('Schema migration failed:', err);
        throw err;
      }
    }
  }

  try {
    await db.run('ALTER TABLE workers ADD COLUMN isg_bitis_tarihi DATE');
  } catch (err) {
    if (!isDuplicateColumnError(err)) {
      logger.error('Schema migration failed:', err);
      throw err;
    }
  }

  try {
    await db.run('ALTER TABLE workers ADD COLUMN isg_start_date DATE');
  } catch (err) {
    if (!isDuplicateColumnError(err)) {
      logger.error('Schema migration failed:', err);
      throw err;
    }
  }

  // ISG Date Migrations for subcontractor_ledgers
  try {
    await db.run('ALTER TABLE subcontractor_ledgers ADD COLUMN isg_start_date DATE');
  } catch (err) {
    if (!isDuplicateColumnError(err)) {
      logger.error('Schema migration failed:', err);
      throw err;
    }
  }
  try {
    await db.run('ALTER TABLE subcontractor_ledgers ADD COLUMN isg_expiry_date DATE');
  } catch (err) {
    if (!isDuplicateColumnError(err)) {
      logger.error('Schema migration failed:', err);
      throw err;
    }
  }

  // Tags Migrations
  const tablesWithTags = ['workers', 'timesheets', 'transactions', 'cash_register', 'materials', 'quality_reports', 'subcontractor_ledgers', 'subcontractor_transactions'];
  for (const t of tablesWithTags) {
    try {
      await db.run(`ALTER TABLE ${t} ADD COLUMN tags TEXT`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) {
        logger.error('Schema migration failed:', err);
        throw err;
      }
    }
  }

  // Audit Logs Project ID Migration
  try {
    await db.run('ALTER TABLE audit_logs ADD COLUMN project_id INTEGER REFERENCES projects(id)');
  } catch (err) {
    if (!isDuplicateColumnError(err)) {
      logger.error('Schema migration failed:', err);
      throw err;
    }
  }

  // Soft Delete Column Migrations for all main tables to ensure they have is_deleted and deleted_at
  const tablesForSoftDelete = [
    'workers', 'timesheets', 'transactions', 'cash_register',
    'projects', 'production_records', 'materials', 'daily_journals',
    'quality_reports', 'subcontractor_ledgers', 'subcontractor_transactions', 'work_types', 'worker_groups',
    'worker_leaves'
  ];
  for (const t of tablesForSoftDelete) {
    try {
      await db.run(`ALTER TABLE ${t} ADD COLUMN is_deleted INTEGER DEFAULT 0`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) {
        logger.error('Schema migration failed:', err);
        throw err;
      }
    }
    try {
      await db.run(`ALTER TABLE ${t} ADD COLUMN deleted_at TIMESTAMP`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) {
        logger.error('Schema migration failed:', err);
        throw err;
      }
    }
  }

  // Data migration: the cash direction and the worker ledger type used to be
  // stored as Turkish labels, which made reports, exports and the local API
  // language-dependent. The canonical values are language-neutral; this rewrite
  // runs once and is a no-op afterwards.
  try {
    await db.run(
      "UPDATE cash_register SET type = 'income' WHERE type IN ('Nakit Girişi', 'Nakit Girisi', 'Gelir', 'gelir', 'Tahsilat', 'tahsilat')"
    );
    await db.run(
      "UPDATE cash_register SET type = 'expense' WHERE type IN ('Nakit Çıkışı', 'Nakit Cikisi', 'Gider', 'gider', 'Ödeme', 'ödeme', 'odeme')"
    );
    await db.run("UPDATE transactions SET trans_type = 'advance' WHERE trans_type IN ('Avans', 'avans', 'Ödeme', 'ödeme', 'odeme')");
    await db.run(
      "UPDATE subcontractor_transactions SET type = 'payment' WHERE type IN ('Ödeme', 'ödeme', 'odeme', 'Payment')"
    );
    await db.run(
      "UPDATE subcontractor_transactions SET type = 'progress' WHERE type IN ('Hakediş', 'Hakedis', 'Progress billing')"
    );
  } catch (err) {
    logger.error('Cash and ledger type migration failed:', err);
    throw err;
  }

  // Indexes for the columns the app filters on most often.
  // Without these every list screen does a full table scan (project_id /
  // worker_id are used in nearly every read and every balance calculation).
  await db.exec(INDEXES_SQL);

  try {
    await db.run('ALTER TABLE recycle_bin ADD COLUMN project_id INTEGER');
  } catch (err) {
    if (!isDuplicateColumnError(err)) {
      logger.error('Schema migration failed:', err);
      throw err;
    }
  }

  // Triggers for main tables when they are soft-deleted (is_deleted = 1)
  const triggers = [
    {
      name: 'trg_workers_deleted',
      table: 'workers',
      titleExpr: 'NEW.full_name',
      projIdExpr: 'NEW.project_id'
    },
    {
      name: 'trg_transactions_deleted',
      table: 'transactions',
      titleExpr: "NEW.trans_type || ': ' || NEW.amount || ' ₺ (' || COALESCE(NEW.notes, '') || ')'",
      projIdExpr: 'NEW.project_id'
    },
    {
      name: 'trg_subcontractor_ledgers_deleted',
      table: 'subcontractor_ledgers',
      titleExpr: "NEW.name || ' (' || NEW.service_type || ')'",
      projIdExpr: 'NEW.project_id'
    },
    {
      name: 'trg_subcontractor_transactions_deleted',
      table: 'subcontractor_transactions',
      titleExpr: "NEW.type || ' - ' || NEW.description || ' (' || NEW.amount || ' ₺)'",
      projIdExpr: 'NEW.project_id'
    },
    {
      name: 'trg_materials_deleted',
      table: 'materials',
      titleExpr: "NEW.supplier || ' - ' || NEW.material_type || ' (' || NEW.quantity || ' ' || NEW.unit || ')'",
      projIdExpr: 'NEW.project_id'
    },
    {
      name: 'trg_daily_journals_deleted',
      table: 'daily_journals',
      titleExpr: 'NEW.journal_date',
      projIdExpr: 'NEW.project_id'
    },
    {
      name: 'trg_quality_reports_deleted',
      table: 'quality_reports',
      titleExpr: 'NEW.title',
      projIdExpr: 'NEW.project_id'
    },
    {
      name: 'trg_projects_deleted',
      table: 'projects',
      titleExpr: 'NEW.name',
      projIdExpr: 'NEW.id'
    },
    {
      name: 'trg_worker_leaves_deleted',
      table: 'worker_leaves',
      titleExpr: "NEW.type || ' (leave) ' || NEW.start_date || ' - ' || NEW.end_date",
      projIdExpr: 'NEW.project_id'
    }
  ];

  for (const trg of triggers) {
    try {
      await db.exec(`DROP TRIGGER IF EXISTS ${trg.name};`);
      await db.exec(`
        CREATE TRIGGER IF NOT EXISTS ${trg.name} AFTER UPDATE OF is_deleted ON ${trg.table}
        WHEN NEW.is_deleted = 1 AND OLD.is_deleted = 0
        BEGIN
          INSERT INTO recycle_bin (table_name, record_id, title, deleted_at, is_restored, project_id)
          VALUES ('${trg.table}', NEW.id, ${trg.titleExpr}, datetime('now', 'localtime'), 0, ${trg.projIdExpr});
        END;
      `);
    } catch (err) {
      logger.error(`Error creating trigger ${trg.name}:`, err);
    }
  }

  // The installer's language picker runs before there is any database, so its
  // choice wins over the Windows display language. Anything without a shipped
  // dictionary is English (never Turkish): the interface must never open in a
  // language the user did not choose.
  const SUPPORTED_UI_LANGUAGES = [
    'tr', 'en', 'de', 'es', 'fr', 'it', 'pt', 'nl', 'pl', 'ru',
    'ja', 'ko', 'zh', 'sv', 'no', 'da', 'cs', 'ar', 'hi',
  ];

  function resolveSupportedLanguage(value) {
    const raw = String(value || '').trim().toLowerCase().replace('_', '-');
    if (!raw) return null;
    if (raw === 'zh-tw' || raw === 'zh-hk' || raw === 'zh-hant') return 'zh';
    const base = raw.split('-')[0];
    return SUPPORTED_UI_LANGUAGES.includes(base) ? base : null;
  }

  function getSystemDefaultLanguage() {
    try {
      const installed = require('../services/platform').readInstallerLanguage();
      const resolvedInstaller = resolveSupportedLanguage(installed);
      if (resolvedInstaller) return resolvedInstaller;
    } catch (err) {
      logger.error('Failed to read the installer language:', err);
    }
    try {
      const resolvedSystem = resolveSupportedLanguage(require('electron').app.getLocale());
      if (resolvedSystem) return resolvedSystem;
    } catch (err) {
      logger.error('Failed to get system locale:', err);
    }
    return 'en';
  }

  // Seeder logic for initial default values.
  //
  // Every setting is declared once in DEFAULT_SETTINGS and then both inserted
  // (empty database) and reconciled (existing database), so a new setting can
  // never be missing from an upgraded installation.
  const defaultBackupDir = path.join(require('electron').app.getPath('documents'), 'TectonBackups');
  if (!fs.existsSync(defaultBackupDir)) {
    try {
      fs.mkdirSync(defaultBackupDir, { recursive: true });
    } catch (err) {
      logger.error('Failed to create default backup folder:', err);
    }
  }

  const systemLang = getSystemDefaultLanguage();
  const DEFAULT_SETTINGS = [
    ['standard_daily_hours', '8', 'Standard daily working hours'],
    ['overtime_multiplier', '1.5', 'Overtime rate multiplier'],
    ['theme', 'dark', 'Surface mode: dark, light or system'],
    ['theme_id', 'obsidian', 'Accent palette id'],
    ['custom_theme_color', '#8b5cf6', 'Custom accent colour (hex)'],
    ['app_icon', 'auto', 'Application icon variant'],
    ['app_icon_color', '#8b5cf6', 'Custom application icon colour (hex)'],
    ['language', systemLang, 'Interface language code'],
    ['ui_zoom', '1', 'Interface zoom factor (0.8 - 1.6)'],
    ['a11y_high_contrast', 'false', 'High contrast accessibility mode'],
    ['a11y_enhanced_focus', 'false', 'Enhanced keyboard focus outlines'],
    ['a11y_readable_spacing', 'false', 'Increased letter and line spacing'],
    ['a11y_reduce_motion', 'false', 'Reduce interface animations'],
    ['onboarding_completed', 'false', 'First-run wizard completed'],
    ['close_to_tray', 'true', 'Closing the window keeps the app in the tray'],
    ['start_minimized', 'false', 'Start hidden in the system tray'],
    ['autostart', 'false', 'Launch when Windows starts'],
    ['notifications_enabled', 'true', 'Show desktop notifications'],
    ['notification_sound', 'true', 'Play a sound with notifications'],
    ['company_name', '', 'Company or organisation name'],
    ['company_logo', '', 'Company logo (base64)'],
    ['company_website', '', 'Publisher website'],
    ['company_email', '', 'Publisher support email'],
    ['custom_currency', 'auto', 'Currency: auto, TRY, USD, EUR, GBP'],
    ['custom_date_format', 'auto', 'Date format: auto, DD.MM.YYYY, YYYY-MM-DD, MM/DD/YYYY'],
    ['custom_time_format', 'auto', 'Time format: auto, 24h, 12h'],
    ['cloud_sync_folder', defaultBackupDir, 'Silent cloud backup folder'],
    ['cloud_provider', 'none', 'Active cloud sync provider'],
    ['cloud_auto_sync', 'true', 'Sync changes to the cloud automatically'],
    ['cloud_last_sync', '', 'Timestamp of the last successful cloud sync'],
  ];

  const settingsCount = await db.get('SELECT COUNT(*) as count FROM app_settings');
  if (settingsCount.count === 0) {
    for (const [key, value, description] of DEFAULT_SETTINGS) {
      await db.run(
        'INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
        [key, value, description]
      );
    }
  } else {
    // Migration for existing databases: add any setting introduced after the
    // installation was first created, leaving user values untouched.
    const keys = await db.all('SELECT setting_key FROM app_settings');
    const existingKeys = new Set(keys.map((row) => row.setting_key));
    for (const [key, value, description] of DEFAULT_SETTINGS) {
      if (existingKeys.has(key)) continue;
      await db.run(
        'INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
        [key, value, description]
      );
    }
  }

  const workTypesCount = await db.get('SELECT COUNT(*) as count FROM work_types');
  if (workTypesCount.count === 0) {
    await db.run("INSERT INTO work_types (name, multiplier) VALUES (?, ?)", ['Full Day', 1.0]);
    await db.run("INSERT INTO work_types (name, multiplier) VALUES (?, ?)", ['Half Day', 0.5]);
    await db.run("INSERT INTO work_types (name, multiplier) VALUES (?, ?)", ['Pazar Mesaisi', 2.0]);
    await db.run("INSERT INTO work_types (name, multiplier) VALUES (?, ?)", ['Unpaid Leave', 0.0]);
  }

  // Run cleanup tasks asynchronously to optimize startup time
  runDeferredCleanup(db);

    dbPromise = db;
    return db;
  })();

  try {
    const resultDb = await initPromise;
    initPromise = null;
    return resultDb;
  } catch (err) {
    // Do not cache a rejected initialisation forever: after the user fixes the
    // cause (disk space, locked file) the next getDB() must retry instead of
    // instantly rethrowing the stale error.
    initPromise = null;
    dbPromise = null;
    throw err;
  }
}

function getSystemLogsDir() {
  const baseDir = app 
    ? path.join(app.getPath('documents'), 'TectonBackups', 'SystemLogs-Backups') 
    : path.join(__dirname, '../../.tecton-dev-data/SystemLogs-Backups');
  if (!fs.existsSync(baseDir)) {
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch (e) {
      logger.error('Failed to create SystemLogs-Backups directory:', e);
    }
  }
  return baseDir;
}

function runDeferredCleanup(db) {
  setTimeout(async () => {
    let vacuumNeeded = false;
    // Auto-Cleanup audit_logs (logs older than today local time)
    try {
      const oldDates = await db.all("SELECT DISTINCT date(created_at, 'localtime') as log_date FROM audit_logs WHERE date(created_at, 'localtime') < date('now', 'localtime')");
      if (oldDates && oldDates.length > 0) {
        const logsDir = getSystemLogsDir();
        for (const d of oldDates) {
          const logDate = d.log_date;
          if (!logDate) continue;

          const logs = await db.all(
            "SELECT id, table_name, record_id, action, old_values, new_values, project_id, datetime(created_at, 'localtime') as local_created_at FROM audit_logs WHERE date(created_at, 'localtime') = ? ORDER BY created_at ASC",
            [logDate]
          );

          if (logs && logs.length > 0) {
            const [year, month] = logDate.split('-');
            const logDir = path.join(logsDir, year, month);
            if (!fs.existsSync(logDir)) {
              fs.mkdirSync(logDir, { recursive: true });
            }

            const logFilePath = path.join(logDir, `audit-${logDate}.log`);
            const logContent = logs.map(l => {
              return `[${l.local_created_at}] [${l.action}] Table: ${l.table_name}, ID: ${l.record_id}, ProjectID: ${l.project_id || 'N/A'}\n` +
                     `  Old: ${l.old_values || 'NULL'}\n` +
                     `  New: ${l.new_values || 'NULL'}`;
            }).join('\n\n') + '\n\n';

            fs.appendFileSync(logFilePath, logContent, 'utf8');
            await db.run("DELETE FROM audit_logs WHERE date(created_at, 'localtime') = ?", [logDate]);
            vacuumNeeded = true;
          }
        }
      }
    } catch (err) {
      logger.error('Audit logs cleanup/archiving error:', err);
    }

    // Auto-Cleanup 30 days old deleted records
    try {
      const oldRecords = await db.all("SELECT id, table_name, record_id FROM recycle_bin WHERE deleted_at <= datetime('now', '-30 days') AND is_restored = 0");
      // table_name comes from the recycle_bin table, but treat it as untrusted:
      // only real, non-audit business tables may be hard-deleted with an
      // interpolated identifier.
      // The rank encodes FK dependency depth: children before parents, so that
      // 'PRAGMA foreign_keys = ON' cannot reject a delete because a parent row
      // is removed while a child row still references it.
      const deletableTables = new Map([
        ['timesheets', 1],
        ['transactions', 1],
        ['cash_register', 1],
        ['production_records', 1],
        ['materials', 1],
        ['daily_journals', 1],
        ['quality_reports', 1],
        ['subcontractor_transactions', 1],
        ['worker_leaves', 1],
        ['workers', 2],
        ['subcontractor_ledgers', 2],
        ['work_types', 3],
        ['worker_groups', 3],
        ['projects', 4],
        ['app_settings', 5],
      ]);
      const ordered = [...oldRecords].sort(
        (a, b) => (deletableTables.get(a.table_name) ?? 99) - (deletableTables.get(b.table_name) ?? 99)
      );
      // Photo files live on disk, not in SQLite: once the row is deleted the path
      // is gone and the file leaks forever. Capture the references first, delete
      // the rows, then unlink - never before, or a failing DELETE would lose the
      // photo while the record survives.
      const orphanedPhotos = [];
      const orphanedProjects = [];
      // Only recycle_bin rows whose record was really removed may be dropped.
      // The old code deleted EVERY expired recycle_bin row after the loop, so a
      // record whose hard-delete threw (FK violation, lock) stayed in the table
      // while its recycle_bin entry vanished - leaving it soft-deleted, hidden
      // from every screen and never purged again (permanent silent data orphan).
      const purgedRecycleIds = [];
      for (const r of ordered) {
        try {
          if (!deletableTables.has(r.table_name)) {
            logger.warn(`Skipped hard-delete for unknown table: ${r.table_name}`);
            continue;
          }
          if (r.table_name === 'materials' || r.table_name === 'quality_reports') {
            const row = await db.get(`SELECT photo_path FROM ${r.table_name} WHERE id = ?`, [r.record_id]);
            if (row && row.photo_path) orphanedPhotos.push(row.photo_path);
          } else if (r.table_name === 'projects') {
            orphanedProjects.push(r.record_id);
          }
          await db.run(`DELETE FROM ${r.table_name} WHERE id = ? AND is_deleted = 1`, [r.record_id]);
          purgedRecycleIds.push(r.id);
        } catch (e) {
          logger.error(`Error hard-deleting record ${r.record_id} from ${r.table_name}:`, e);
        }
      }
      for (const relPath of orphanedPhotos) {
        removeMediaFile(relPath);
      }
      for (const projectId of orphanedProjects) {
        removeMediaProjectDir(projectId);
      }
      // Delete by id, not by date: an entry that failed above keeps its row and
      // is retried on the next launch instead of being forgotten.
      if (purgedRecycleIds.length > 0) {
        const placeholders = purgedRecycleIds.map(() => '?').join(', ');
        await db.run(`DELETE FROM recycle_bin WHERE id IN (${placeholders})`, purgedRecycleIds);
      }
      
      if (oldRecords && oldRecords.length > 0) {
        vacuumNeeded = true;
      }
    } catch (err) {
      logger.error('Auto cleanup error:', err);
    }

    if (vacuumNeeded) {
      try {
        await db.run('VACUUM');
        logger.info('Database vacuum completed successfully.');
      } catch (e) {
        logger.error('VACUUM error:', e);
      }
    }

    // Archive old log folders
    archiveOldLogs();
  }, 1000);

  // Archive old database backups 5 seconds after startup
  setTimeout(async () => {
    try {
      const setting = await db.get("SELECT setting_value FROM app_settings WHERE setting_key = 'cloud_sync_folder'");
      if (setting && setting.setting_value) {
        const backupFolder = path.join(setting.setting_value, 'Database-Backups');
        const { processBackupArchiving } = require('../utils/archiveUtils');
        processBackupArchiving(backupFolder);
      }
    } catch (err) {
      logger.error('Database archiving error at startup:', err);
    }
  }, 5000);
}

function archiveOldLogs() {
  try {
    const logsDir = getSystemLogsDir();
    if (!fs.existsSync(logsDir)) return;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthStr = String(today.getMonth() + 1).padStart(2, '0');
    const currentYearMonth = `${currentYear}-${currentMonthStr}`;

    const years = fs.readdirSync(logsDir);
    for (const year of years) {
      const yearPath = path.join(logsDir, year);
      if (!fs.existsSync(yearPath) || !fs.statSync(yearPath).isDirectory()) continue;

      const months = fs.readdirSync(yearPath);
      for (const month of months) {
        const monthPath = path.join(yearPath, month);
        if (!fs.existsSync(monthPath) || !fs.statSync(monthPath).isDirectory()) continue;

        const folderYearMonth = `${year}-${month}`;
        if (folderYearMonth < currentYearMonth) {
          const files = fs.readdirSync(monthPath);
          if (files.length > 0) {
            const zipPath = path.join(yearPath, `logs-${folderYearMonth}.zip`);
            const zip = new AdmZip();

            files.forEach(file => {
              const filePath = path.join(monthPath, file);
              if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                zip.addLocalFile(filePath);
              }
            });

            zip.writeZip(zipPath);
            logger.info(`Archived log folder ${folderYearMonth} to ${zipPath}`);
          }

          fs.rmSync(monthPath, { recursive: true, force: true });
        }
      }

      // Cleanup year directory if empty
      try {
        const remaining = fs.readdirSync(yearPath);
        if (remaining.length === 0) {
          fs.rmdirSync(yearPath);
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    logger.error('Log archiving error:', err);
  }
}


// Restore point (time machine) snapshot helpers
function getDBPath() {
  const isDev = process.env.NODE_ENV === 'development';
  return isDev 
    ? path.join(__dirname, '../../../.tecton-dev-data/database.sqlite')
    : path.join(app.getPath('userData'), 'elektronik-yevmiye.sqlite');
}

/**
 * Creates a restore point through SQLite instead of copying the file.
 *
 * `fs.copyFileSync` on a live WAL database copies only the main file; commits
 * still sitting in `-wal` are omitted, so the "restore point" can silently
 * lose the most recent data. VACUUM INTO writes a consistent snapshot that
 * includes every committed transaction.
 */
async function createSnapshot(suffix = 'restore-point') {
  const dbPath = getDBPath();
  const backupPath = `${dbPath}.${suffix}`;
  const tempPath = `${backupPath}.tmp`;
  try {
    const db = await getDB();
    await runExclusive(async () => {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      await db.run('VACUUM INTO ?', [tempPath]);
      fs.renameSync(tempPath, backupPath);
    });
    // Announced only after the rename: a listener must never receive an event
    // for a backup that is still being written.
    try {
      require('../services/integrationRuntime').emitEvent('backup.completed', { suffix, path: backupPath });
    } catch {
      // Integrations are optional; a failure here cannot fail the backup.
    }
    return { success: true, backupPath };
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (cleanupErr) {
      logger.warn('Snapshot temp cleanup failed:', cleanupErr.message);
    }
    logger.error('Snapshot creation failed:', err);
    return { success: false, ...toUserError(err, 'file_error') };
  }
}

/**
 * Restores a restore point. Closes the shared connection first and removes the
 * WAL sidecars, otherwise SQLite would replay the old database's WAL over the
 * restored file. The caller must restart the app afterwards: every IPC handler
 * still holds the closed connection.
 */
async function restoreSnapshot(suffix = 'restore-point') {
  const dbPath = getDBPath();
  const backupPath = `${dbPath}.${suffix}`;
  if (!fs.existsSync(backupPath)) {
    return { success: false, message: 'Restore point not found.', messageKey: 'errors.restore_point_missing' };
  }
  try {
    await runExclusive(async () => {
      if (dbPromise) {
        try {
          await dbPromise.close();
        } catch (closeErr) {
          logger.warn('Snapshot restore: connection close failed:', closeErr.message);
        }
      }
      dbPromise = null;
      initPromise = null;
      for (const sidecar of ['-wal', '-shm', '-journal']) {
        const sidecarPath = `${dbPath}${sidecar}`;
        try {
          if (fs.existsSync(sidecarPath)) fs.unlinkSync(sidecarPath);
        } catch (unlinkErr) {
          logger.warn(`Snapshot restore: failed to remove ${sidecar}:`, unlinkErr.message);
        }
      }
      fs.copyFileSync(backupPath, dbPath);
    });
    return { success: true, restartRequired: true };
  } catch (err) {
    logger.error('Restore failed:', err);
    return { success: false, ...toUserError(err, 'file_error') };
  }
}

/**
 * Drop the cached connection so the next `getDB()` reopens the file.
 *
 * Needed after a DB-file restore is rolled back: the handler closes the
 * connection before swapping the file, and if the copy fails the app keeps
 * running - but with `dbPromise` still pointing at a closed handle, so every
 * later query throws "Database is closed" until the user restarts.
 */
function resetConnection() {
  dbPromise = null;
  initPromise = null;
}

module.exports = { getDB, createSnapshot, restoreSnapshot, resetConnection };
