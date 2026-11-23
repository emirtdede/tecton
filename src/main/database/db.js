const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const AdmZip = require('adm-zip');
const { openCompat, isPlaintextHeader, verifyDbFile } = require('./dbCompat');
const { loadOrCreateDbKey } = require('../services/keystore');
const logger = require('../logger');

let dbPromise;

function listBackups(backupFolder) {
  try {
    if (!fs.existsSync(backupFolder)) return [];
    const sqliteFiles = [];
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
    sqliteFiles.sort((a, b) => b.localeCompare(a));
    return sqliteFiles;
  } catch (err) {
    logger.error('Error finding latest backup:', err);
    return [];
  }
}

function findLatestBackup(backupFolder) {
  return listBackups(backupFolder)[0] || null;
}
let initPromise = null;

async function getDB() {
  if (dbPromise) return dbPromise;
  if (initPromise) return initPromise;

  initPromise = (async () => {

  const isDev = process.env.NODE_ENV === 'development';
  const dbPath = isDev 
    ? path.join(__dirname, '../../../.tecton-dev-data/database.sqlite')
    : path.join(app.getPath('userData'), 'elektronik-yevmiye.sqlite');

  let db;
  let dbKey = null;
  try {
    dbKey = await loadOrCreateDbKey({ dbPath });
  } catch (keyErr) {
    logger.error('Keystore unavailable, opening database without encryption:', keyErr.message);
  }
  // One-time transparent encryption: legacy plaintext DBs are encrypted in place
  // after a safety copy (backup_before_enc_*.sqlite). Trigger: R2 fallback path.
  try {
    if (fs.existsSync(dbPath) && dbKey && isPlaintextHeader(dbPath)) {
      const encDir = path.join(path.dirname(dbPath), 'old_backups');
      if (!fs.existsSync(encDir)) fs.mkdirSync(encDir, { recursive: true });
      fs.copyFileSync(dbPath, path.join(encDir, `backup_before_enc_${Date.now()}.sqlite`));
    }
  } catch (migErr) {
    logger.error('Pre-encryption safety copy failed:', migErr.message);
  }
  // better-sqlite3 opens lazily, so an encrypted database opened with the
  // wrong key only fails on the first read. Verify with a real query so that
  // case takes the recovery path instead of booting a broken handle.
  const openAndVerify = async () => {
    const handle = openCompat({ filename: dbPath, key: dbKey });
    try {
      await handle.get('SELECT count(*) AS c FROM sqlite_master');
      return handle;
    } catch (verifyErr) {
      try { await handle.close(); } catch (_) { /* already gone */ }
      throw verifyErr;
    }
  };

  const backupDir = app
    ? path.join(app.getPath('documents'), 'TectonBackups', 'Database-Backups')
    : path.join(__dirname, '../../.tecton-dev-data/Database-Backups');

  // Only restore a backup that really opens (key first, then legacy plaintext).
  // For an encrypted database, an older copy encrypted under a previous key is
  // useless, and copying it over the primary file would destroy the only
  // remaining copy. verifyDbFile is read-only, so probing is safe.
  const findUsableBackup = async () => {
    for (const candidate of listBackups(backupDir).slice(0, 5)) {
      if (verifyDbFile(candidate, dbKey)) return candidate;
      logger.warn(`[Auto-Recovery] Backup unusable with the current key: ${candidate}`);
    }
    return null;
  };

  try {
    db = await openAndVerify();
  } catch (err) {
    logger.error('Failed to open primary database. Attempting auto-recovery...', err);
    // A database with a binary (encrypted) header cannot be recovered while the
    // key is missing: every backup is encrypted with the same key.
    if (!dbKey && fs.existsSync(dbPath) && !isPlaintextHeader(dbPath)) {
      throw new Error('database_locked_keystore_unavailable');
    }

    const latestBackup = await findUsableBackup();
    if (latestBackup) {
      logger.info(`[Auto-Recovery] Found valid backup: ${latestBackup}. Restoring...`);
      fs.copyFileSync(dbPath, `${dbPath}.unreadable-${Date.now()}`);
      fs.copyFileSync(latestBackup, dbPath);
      db = await openAndVerify();
    } else {
      logger.error('[Auto-Recovery] No valid backups found to recover from.');
      throw err;
    }
  }

  // dbPromise set deferred

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
            const latestBackup = await findUsableBackup();
            if (latestBackup) {
              fs.copyFileSync(dbPath, `${dbPath}.corrupt-${Date.now()}`);
              fs.copyFileSync(latestBackup, dbPath);
              db = await openAndVerify();
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
  await db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS work_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      multiplier REAL NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS worker_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      tc_no TEXT,
      phone TEXT,
      daily_wage REAL NOT NULL,
      group_id INTEGER,
      start_date DATE,
      status TEXT DEFAULT 'active',
      extra_data TEXT,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES worker_groups (id)
    );

    CREATE TABLE IF NOT EXISTS timesheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER,
      work_date DATE NOT NULL,
      work_type_id INTEGER,
      applied_wage REAL NOT NULL,
      applied_multiplier REAL NOT NULL,
      overtime_hours REAL DEFAULT 0,
      earned_amount REAL NOT NULL,
      notes TEXT,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (worker_id) REFERENCES workers (id),
      FOREIGN KEY (work_type_id) REFERENCES work_types (id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER,
      trans_date DATE NOT NULL,
      trans_type TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      linked_cash_id INTEGER,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (worker_id) REFERENCES workers (id)
    );

    CREATE TABLE IF NOT EXISTS cash_register (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trans_date DATE NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT,
      record_id INTEGER,
      action TEXT,
      old_values TEXT,
      new_values TEXT,
      project_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      status TEXT DEFAULT 'active',
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS production_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      notes TEXT,
      record_date DATE NOT NULL,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      supplier TEXT NOT NULL,
      material_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      receipt_number TEXT,
      receipt_date DATE NOT NULL,
      photo_path TEXT,
      notes TEXT,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS daily_journals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      journal_date DATE NOT NULL,
      weather_temp REAL,
      weather_desc TEXT,
      weather_icon TEXT,
      notes TEXT,
      worker_count INTEGER,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      UNIQUE(project_id, journal_date)
    );

    CREATE TABLE IF NOT EXISTS quality_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'open',
      photo_path TEXT,
      report_date DATE NOT NULL,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS subcontractor_ledgers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      phone TEXT,
      daily_wage REAL NOT NULL,
      status TEXT DEFAULT 'active',
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS subcontractor_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subcontractor_id INTEGER NOT NULL,
      trans_date DATE NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      project_id INTEGER,
      linked_cash_id INTEGER,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subcontractor_id) REFERENCES subcontractor_ledgers(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS worker_leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      project_id INTEGER,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (worker_id) REFERENCES workers(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // Migrations for existing DB
  try {
    await db.run('ALTER TABLE projects ADD COLUMN sort_order INTEGER DEFAULT 0');
  } catch (err) {
    // Column might already exist, ignore
  }

  try {
    await db.run('ALTER TABLE workers ADD COLUMN group_id INTEGER REFERENCES worker_groups(id)');
  } catch (err) {
    // Column might already exist, ignore
  }

  try {
    await db.run('ALTER TABLE workers ADD COLUMN tc_no TEXT');
  } catch (err) {
    // Column might already exist, ignore
  }

  // Project ID & ISG Date Migrations for existing tables
  const tablesWithProjectId = ['workers', 'timesheets', 'transactions', 'cash_register', 'subcontractor_transactions'];
  for (const t of tablesWithProjectId) {
    try {
      await db.run(`ALTER TABLE ${t} ADD COLUMN project_id INTEGER REFERENCES projects(id)`);
    } catch (err) {
      // Column might already exist, ignore
    }
  }

  try {
    await db.run('ALTER TABLE workers ADD COLUMN isg_bitis_tarihi DATE');
  } catch (err) {
    // Column might already exist, ignore
  }

  try {
    await db.run('ALTER TABLE workers ADD COLUMN isg_start_date DATE');
  } catch (err) {
    // Column might already exist, ignore
  }

  // ISG Date Migrations for subcontractor_ledgers
  try {
    await db.run('ALTER TABLE subcontractor_ledgers ADD COLUMN isg_start_date DATE');
  } catch (err) {
    // Column might already exist, ignore
  }
  try {
    await db.run('ALTER TABLE subcontractor_ledgers ADD COLUMN isg_expiry_date DATE');
  } catch (err) {
    // Column might already exist, ignore
  }

  // Tags Migrations
  const tablesWithTags = ['workers', 'timesheets', 'transactions', 'cash_register', 'materials', 'quality_reports', 'subcontractor_ledgers', 'subcontractor_transactions'];
  for (const t of tablesWithTags) {
    try {
      await db.run(`ALTER TABLE ${t} ADD COLUMN tags TEXT`);
    } catch (err) {
      // Column might already exist, ignore
    }
  }

  // Audit Logs Project ID Migration
  try {
    await db.run('ALTER TABLE audit_logs ADD COLUMN project_id INTEGER REFERENCES projects(id)');
  } catch (err) {
    // Column might already exist, ignore
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
      // Column might already exist, ignore
    }
    try {
      await db.run(`ALTER TABLE ${t} ADD COLUMN deleted_at TIMESTAMP`);
    } catch (err) {
      // Column might already exist, ignore
    }
  }

  // Create recycle_bin table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS recycle_bin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      deleted_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
      is_restored BOOLEAN DEFAULT 0,
      restored_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
      original_data TEXT,
      project_id INTEGER
    );
  `);

  try {
    await db.run('ALTER TABLE recycle_bin ADD COLUMN project_id INTEGER');
  } catch (err) {
    // Column might already exist, ignore
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
      titleExpr: "NEW.type || ' İzni (' || NEW.start_date || ' - ' || NEW.end_date || ')'",
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

  function getSystemDefaultLanguage() {
    try {
      const locale = require('electron').app.getLocale().toLowerCase();
      const systemLang = locale.split('-')[0];
      const supportedLangs = ['tr', 'en', 'zh', 'es', 'fr', 'ar', 'hi', 'ru', 'pt', 'de', 'sv', 'no', 'da', 'pl', 'it', 'nl', 'cs', 'ja', 'ko'];
      if (supportedLangs.includes(systemLang)) {
        return systemLang;
      }
    } catch (err) {
      logger.error('Failed to get system locale:', err);
    }
    return 'tr';
  }

  // Seeder logic for initial default values
  const settingsCount = await db.get('SELECT COUNT(*) as count FROM app_settings');
  if (settingsCount.count === 0) {
    const systemLang = getSystemDefaultLanguage();
    await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['standard_daily_hours', '8', 'Standart günlük çalışma saati']);
    await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['overtime_multiplier', '1.5', 'Mesai saat ücreti çarpanı']);
    await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['theme', 'dark', 'Uygulama Teması (dark/light)']);
    await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['language', systemLang, 'Uygulama Dili (tr/en)']);
    await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['company_name', '', 'Şirket/Kurum Adı']);
    await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['company_logo', '', 'Şirket Logosu (Base64)']);
    await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['custom_currency', 'auto', 'Para Birimi Seçimi (auto, TRY, USD, EUR, GBP)']);
    await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['custom_date_format', 'auto', 'Tarih Formatı Seçimi (auto, DD.MM.YYYY, YYYY-MM-DD, MM/DD/YYYY)']);
    await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['custom_time_format', 'auto', 'Saat Formatı Seçimi (auto, 24h, 12h)']);
    const defaultBackupDir = path.join(require('electron').app.getPath('documents'), 'TectonBackups');
    if (!fs.existsSync(defaultBackupDir)) {
      try {
        fs.mkdirSync(defaultBackupDir, { recursive: true });
      } catch (err) {
        logger.error('Failed to create default backup folder:', err);
      }
    }
    await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['cloud_sync_folder', defaultBackupDir, 'Sessiz Bulut Yedekleme Klasörü']);
  } else {
    // Migration for existing databases to ensure new settings exist
    const keys = await db.all('SELECT setting_key FROM app_settings');
    const existingKeys = keys.map(k => k.setting_key);
    
    if (!existingKeys.includes('company_name')) {
      await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['company_name', '', 'Şirket/Kurum Adı']);
    }
    if (!existingKeys.includes('company_logo')) {
      await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['company_logo', '', 'Şirket Logosu (Base64)']);
    }
    if (!existingKeys.includes('language')) {
      const systemLang = getSystemDefaultLanguage();
      await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['language', systemLang, 'Uygulama Dili (tr/en)']);
    }
    if (!existingKeys.includes('custom_currency')) {
      await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['custom_currency', 'auto', 'Para Birimi Seçimi (auto, TRY, USD, EUR, GBP)']);
    }
    if (!existingKeys.includes('custom_date_format')) {
      await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['custom_date_format', 'auto', 'Tarih Formatı Seçimi (auto, DD.MM.YYYY, YYYY-MM-DD, MM/DD/YYYY)']);
    }
    if (!existingKeys.includes('custom_time_format')) {
      await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['custom_time_format', 'auto', 'Saat Formatı Seçimi (auto, 24h, 12h)']);
    }
    if (!existingKeys.includes('cloud_sync_folder')) {
      const defaultBackupDir = path.join(require('electron').app.getPath('documents'), 'TectonBackups');
      if (!fs.existsSync(defaultBackupDir)) {
        try {
          fs.mkdirSync(defaultBackupDir, { recursive: true });
        } catch (err) {
          logger.error('Failed to create default backup folder:', err);
        }
      }
      await db.run("INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)", ['cloud_sync_folder', defaultBackupDir, 'Sessiz Bulut Yedekleme Klasörü']);
    }
  }

  // Settings introduced after the first release. Inserted only when missing so
  // a user value is never overwritten by a default.
  const DEFAULT_SETTINGS = [
    ['theme_id', 'obsidian', 'Accent palette id'],
    ['custom_theme_color', '#8b5cf6', 'Custom accent colour (hex)'],
    ['app_icon', 'auto', 'Application icon variant'],
    ['app_icon_color', '#8b5cf6', 'Custom application icon colour (hex)'],
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
    ['company_website', '', 'Publisher website'],
    ['company_email', '', 'Publisher support email'],
    ['cloud_provider', 'none', 'Active cloud sync provider'],
    ['cloud_auto_sync', 'true', 'Sync changes to the cloud automatically'],
    ['cloud_last_sync', '', 'Timestamp of the last successful cloud sync'],
  ];
  {
    const existingRows = await db.all('SELECT setting_key FROM app_settings');
    const existingKeys = new Set(existingRows.map((row) => row.setting_key));
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
    await db.run("INSERT INTO work_types (name, multiplier) VALUES (?, ?)", ['Tam Gün', 1.0]);
    await db.run("INSERT INTO work_types (name, multiplier) VALUES (?, ?)", ['Yarım Gün', 0.5]);
    await db.run("INSERT INTO work_types (name, multiplier) VALUES (?, ?)", ['Pazar Mesaisi', 2.0]);
    await db.run("INSERT INTO work_types (name, multiplier) VALUES (?, ?)", ['İzinli (Ücretsiz)', 0.0]);
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

/**
 * Drops the cached connection so the next getDB() reopens the file. A restore
 * closes the shared handle; every caller still holding it would otherwise query
 * a closed database.
 */
function resetConnection() {
  dbPromise = null;
  initPromise = null;
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
      for (const r of oldRecords) {
        try {
          const { isAllowedTable } = require('../services/allowlist');
          if (!isAllowedTable(r.table_name)) {
            logger.error(`Skipping hard-delete: forbidden table ${r.table_name}`);
            continue;
          }
          await db.run(`DELETE FROM ${r.table_name} WHERE id = ? AND is_deleted = 1`, [r.record_id]);
        } catch (e) {
          logger.error(`Error hard-deleting record ${r.record_id} from ${r.table_name}:`, e);
        }
      }
      await db.run("DELETE FROM recycle_bin WHERE deleted_at <= datetime('now', '-30 days')");
      
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


// Zaman Makinesi (Restore Point) Snapshot Fonksiyonları
function getDBPath() {
  const isDev = process.env.NODE_ENV === 'development';
  return isDev 
    ? path.join(__dirname, '../../../.tecton-dev-data/database.sqlite')
    : path.join(app.getPath('userData'), 'elektronik-yevmiye.sqlite');
}

function createSnapshot(suffix = 'restore-point') {
  try {
    const dbPath = getDBPath();
    const backupPath = `${dbPath}.${suffix}`;
    fs.copyFileSync(dbPath, backupPath);
    return { success: true, backupPath };
  } catch (err) {
    logger.error('Snapshot creation failed:', err);
    return { success: false, message: err.message };
  }
}

function restoreSnapshot(suffix = 'restore-point') {
  try {
    const dbPath = getDBPath();
    const backupPath = `${dbPath}.${suffix}`;
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, dbPath);
      return { success: true };
    }
    return { success: false, message: 'Restore point bulunamadı.' };
  } catch (err) {
    logger.error('Restore failed:', err);
    return { success: false, message: err.message };
  }
}

module.exports = { getDB, createSnapshot, restoreSnapshot, resetConnection };
