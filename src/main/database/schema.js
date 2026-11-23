/**
 * Single source of truth for the SQLite schema.
 *
 * Production (`database/db.js`) and the test harness
 * (`services/testDb.js`) used to keep two hand-maintained copies of the same
 * DDL. They silently drifted: the test schema was missing 7 tables' worth of
 * columns (`workers.phone`, `timesheets.work_type_id`, `transactions.created_at`,
 * …) and still carried pre-migration columns, so the unit tests ran against a
 * database whose shape did not exist in production. A query could pass in tests
 * and fail at runtime.
 *
 * Both now import these constants. The statements below declare the *final*
 * shape (base columns + everything the incremental `ALTER TABLE` migrations add),
 * so a brand-new database - production or test - is created fully formed. The
 * migrations in `db.js` remain only to upgrade databases created by older
 * releases; for a fresh database they fail with "duplicate column name" and are
 * intentionally ignored.
 */

const TABLES_SQL = `
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
    project_id INTEGER,
    start_date DATE,
    status TEXT DEFAULT 'active',
    extra_data TEXT,
    isg_start_date DATE,
    isg_bitis_tarihi DATE,
    tags TEXT,
    is_deleted BOOLEAN DEFAULT 0,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES worker_groups (id),
    FOREIGN KEY (project_id) REFERENCES projects (id)
  );

  CREATE TABLE IF NOT EXISTS timesheets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id INTEGER,
    work_date DATE NOT NULL,
    work_type_id INTEGER,
    project_id INTEGER,
    applied_wage REAL NOT NULL,
    applied_multiplier REAL NOT NULL,
    overtime_hours REAL DEFAULT 0,
    earned_amount REAL NOT NULL,
    notes TEXT,
    tags TEXT,
    is_deleted BOOLEAN DEFAULT 0,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers (id),
    FOREIGN KEY (work_type_id) REFERENCES work_types (id),
    FOREIGN KEY (project_id) REFERENCES projects (id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id INTEGER,
    trans_date DATE NOT NULL,
    trans_type TEXT NOT NULL,
    amount REAL NOT NULL,
    notes TEXT,
    project_id INTEGER,
    linked_cash_id INTEGER,
    tags TEXT,
    is_deleted BOOLEAN DEFAULT 0,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers (id),
    FOREIGN KEY (project_id) REFERENCES projects (id)
  );

  CREATE TABLE IF NOT EXISTS cash_register (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trans_date DATE NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    project_id INTEGER,
    tags TEXT,
    is_deleted BOOLEAN DEFAULT 0,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id)
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
    tags TEXT,
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
    tags TEXT,
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
    isg_start_date DATE,
    isg_expiry_date DATE,
    tags TEXT,
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
    tags TEXT,
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
`;

/**
 * Indexes for the columns the app filters on most often. Without these every
 * list screen does a full table scan (`project_id` / `worker_id` appear in
 * nearly every read and every balance calculation).
 *
 * Must run after TABLES_SQL.
 */
const INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
  CREATE INDEX IF NOT EXISTS idx_workers_project_id ON workers (project_id);
  CREATE INDEX IF NOT EXISTS idx_workers_group_id ON workers (group_id);
  CREATE INDEX IF NOT EXISTS idx_timesheets_worker_id ON timesheets (worker_id);
  CREATE INDEX IF NOT EXISTS idx_timesheets_project_id ON timesheets (project_id);
  CREATE INDEX IF NOT EXISTS idx_timesheets_work_date ON timesheets (work_date);
  CREATE INDEX IF NOT EXISTS idx_transactions_worker_id ON transactions (worker_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions (project_id);
  CREATE INDEX IF NOT EXISTS idx_cash_register_project_id ON cash_register (project_id);
  CREATE INDEX IF NOT EXISTS idx_production_records_project_id ON production_records (project_id);
  CREATE INDEX IF NOT EXISTS idx_materials_project_id ON materials (project_id);
  CREATE INDEX IF NOT EXISTS idx_daily_journals_project_id ON daily_journals (project_id);
  CREATE INDEX IF NOT EXISTS idx_daily_journals_journal_date ON daily_journals (journal_date);
  CREATE INDEX IF NOT EXISTS idx_quality_reports_project_id ON quality_reports (project_id);
  CREATE INDEX IF NOT EXISTS idx_subcontractor_ledgers_project_id ON subcontractor_ledgers (project_id);
  CREATE INDEX IF NOT EXISTS idx_subcontractor_transactions_sub_id ON subcontractor_transactions (subcontractor_id);
  CREATE INDEX IF NOT EXISTS idx_subcontractor_transactions_project_id ON subcontractor_transactions (project_id);
  CREATE INDEX IF NOT EXISTS idx_worker_leaves_worker_id ON worker_leaves (worker_id);
  CREATE INDEX IF NOT EXISTS idx_worker_leaves_project_id ON worker_leaves (project_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON audit_logs (project_id);
  CREATE INDEX IF NOT EXISTS idx_recycle_bin_table_name ON recycle_bin (table_name);
  -- Report queries filter by date range on both of these tables
  -- (transactions: reportService monthly/period/all-time sums; cash_register:
  -- the monthly cash summary). Without an index every report is a full scan
  -- that grows with the lifetime of the app.
  CREATE INDEX IF NOT EXISTS idx_transactions_trans_date ON transactions (trans_date);
  CREATE INDEX IF NOT EXISTS idx_cash_register_trans_date ON cash_register (trans_date);
  -- The 30-day purge runs on every launch:
  --   WHERE deleted_at <= datetime('now','-30 days') AND is_restored = 0
  CREATE INDEX IF NOT EXISTS idx_recycle_bin_deleted_at ON recycle_bin (deleted_at);
`;

module.exports = { TABLES_SQL, INDEXES_SQL };
