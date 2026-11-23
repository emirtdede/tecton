const { openCompat } = require('../database/dbCompat');

async function setupTestDB() {
  const db = openCompat({ filename: ':memory:' });

  // Zero-Code Change Schema
  await db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS work_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      multiplier REAL NOT NULL,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP
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
      start_date DATE,
      status TEXT DEFAULT 'active',
      extra_data TEXT,
      tags TEXT,
      group_id INTEGER,
      project_id INTEGER,
      isg_start_date DATE,
      isg_bitis_tarihi DATE,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP
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
      tags TEXT,
      project_id INTEGER,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER,
      trans_date DATE NOT NULL,
      trans_type TEXT NOT NULL DEFAULT 'Bakiye Devri',
      amount REAL NOT NULL,
      notes TEXT,
      linked_cash_id INTEGER,
      project_id INTEGER,
      tags TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cash_register (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trans_date DATE NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      project_id INTEGER,
      tags TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT,
      record_id INTEGER,
      action TEXT,
      old_values TEXT,
      new_values TEXT,
      project_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      status TEXT DEFAULT 'active',
      sort_order INTEGER DEFAULT 0,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      tags TEXT,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      tags TEXT,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subcontractor_ledgers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      phone TEXT,
      daily_wage REAL NOT NULL,
      status TEXT DEFAULT 'active',
      isg_start_date DATE,
      isg_expiry_date DATE,
      tags TEXT,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

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

  return db;
}

module.exports = { setupTestDB };
