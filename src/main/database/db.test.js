// Integration tests for src/main/database/db.js with a mocked Electron shell.
// Covers: fresh encrypted init + seeds, idempotent migrations, legacy
// plaintext -> encrypted transparent migration (+ safety copy), keystore-down
// fallback, auto-recovery from backup, unclean-shutdown integrity check,
// snapshot/restore, and deferred audit/recycle cleanup.
//
// MOCK RULE (verified on Vitest 4.1.8): `vi.mock('electron')` does NOT
// intercept CJS `require('electron')` inside main-process sources, so the
// native require.cache is seeded with a stub (see test-helpers). `vi.mock`
// IS honored for relative source modules on the `import()` pipeline, and
// `vi.resetModules()` before each import yields isolated singletons while
// the native seed (outside Vite's registry) survives.

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  createIsolatedPaths,
  installPathMap,
  destroyPaths,
  createDbTracker,
  seedNativeElectron,
  seedNativeKeystore,
  seedNativeLogger,
  seedNativeDbCompat,
} from '../test-helpers/electronMock.js';
import { openCompat, isPlaintextHeader, verifyDbFile } from './dbCompat.js';

// Native seeds MUST run before the first `import('./db.js')` in this file.
// (CJS `require()` inside main-process sources resolves natively and
// bypasses `vi.mock`; the native cache survives `vi.resetModules()`.)
seedNativeElectron();
const { ctl: keystoreCtl } = seedNativeKeystore();
const loggerCtl = seedNativeLogger();
const dbCompatCtl = seedNativeDbCompat();

const TEST_KEY = 'test-db-key-123';
let paths;
let tracker;

// Isolated db.js instance per call (module-level singletons otherwise leak).
// `vi.resetModules` drops the registry; `vi.mock` factories are re-applied
// on the next static import (documented pattern).
async function freshDbModule() {
  vi.resetModules();
  return import('./db.js');
}

function dbPath() {
  return path.join(paths.userData, 'elektronik-yevmiye.sqlite');
}

beforeEach(() => {
  vi.useFakeTimers();
  keystoreCtl.impl = async () => TEST_KEY;
  loggerCtl.reset();
  dbCompatCtl.failOpenOnce = false;
  paths = createIsolatedPaths('tecton-db-test-');
  installPathMap(paths);
  tracker = createDbTracker();
  process.env.NODE_ENV = 'test';
});

afterEach(async () => {
  await tracker.closeAll();
  vi.useRealTimers();
  destroyPaths(paths);
});

describe('db.js getDB (encrypted lifecycle)', () => {
  it('creates a fresh encrypted DB with default settings and work types', async () => {
    const { getDB } = await freshDbModule();
    const db = tracker.track(await getDB());

    expect(isPlaintextHeader(dbPath())).toBe(false);
    // Behavioral proof the key came from the mocked keystore (fixed TEST_KEY),
    // not a random real one: the file verifies with TEST_KEY only.
    expect(verifyDbFile(dbPath(), TEST_KEY)).toBe(true);
    expect(verifyDbFile(dbPath(), 'wrong-key')).toBe(false);

    const settings = await db.all('SELECT setting_key, setting_value FROM app_settings');
    const map = Object.fromEntries(settings.map((s) => [s.setting_key, s.setting_value]));
    expect(map.standard_daily_hours).toBe('8');
    expect(map.overtime_multiplier).toBe('1.5');
    expect(map.theme).toBe('dark');
    expect(map.language).toBe('tr');
    // NOTE (verified code order): the integrity block runs BEFORE table
    // creation, so a fresh DB has no `clean_shutdown` row yet - it is
    // inserted on the SECOND open (see idempotency test).
    expect(map.clean_shutdown).toBeUndefined();

    const workTypes = await db.all('SELECT name, multiplier FROM work_types ORDER BY id');
    expect(workTypes).toEqual([
      { name: 'Tam Gün', multiplier: 1.0 },
      { name: 'Yarım Gün', multiplier: 0.5 },
      { name: 'Pazar Mesaisi', multiplier: 2.0 },
      { name: 'İzinli (Ücretsiz)', multiplier: 0.0 },
    ]);
  });

  it('re opening an existing DB is idempotent (migrations do not throw, settings preserved)', async () => {
    const { getDB: getDB1 } = await freshDbModule();
    const db1 = tracker.track(await getDB1());
    await db1.run("UPDATE app_settings SET setting_value = 'Acme' WHERE setting_key = 'company_name'");
    await tracker.closeAll();

    const { getDB: getDB2 } = await freshDbModule();
    const db2 = tracker.track(await getDB2());
    const company = await db2.get("SELECT setting_value FROM app_settings WHERE setting_key = 'company_name'");
    expect(company.setting_value).toBe('Acme');

    const cols = await db2.all('PRAGMA table_info(workers)');
    const names = cols.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['project_id', 'tags', 'is_deleted', 'deleted_at', 'tc_no']));

    const binCols = await db2.all('PRAGMA table_info(recycle_bin)');
    expect(binCols.map((c) => c.name)).toEqual(expect.arrayContaining(['project_id']));

    // Second open inserts the shutdown flag (absent after fresh init).
    const flag = await db2.get("SELECT setting_value FROM app_settings WHERE setting_key = 'clean_shutdown'");
    expect(flag.setting_value).toBe('0');
  });

  it('transparently encrypts a legacy plaintext DB and keeps a safety copy', async () => {
    const { default: Native } = await import('better-sqlite3-multiple-ciphers');
    const seed = Native(dbPath());
    seed.exec('CREATE TABLE workers(id INTEGER PRIMARY KEY, full_name TEXT)');
    seed.prepare('INSERT INTO workers(full_name) VALUES (?)').run('Ali');
    seed.prepare('INSERT INTO workers(full_name) VALUES (?)').run('Veli');
    seed.close();
    expect(isPlaintextHeader(dbPath())).toBe(true);

    const { getDB } = await freshDbModule();
    const db = tracker.track(await getDB());

    expect(isPlaintextHeader(dbPath())).toBe(false);
    const encDir = path.join(paths.userData, 'old_backups');
    const copies = fs.existsSync(encDir)
      ? fs.readdirSync(encDir).filter((f) => f.startsWith('backup_before_enc_'))
      : [];
    expect(copies.length).toBe(1);
    expect(isPlaintextHeader(path.join(encDir, copies[0]))).toBe(true);

    const rows = await db.all('SELECT full_name FROM workers ORDER BY id');
    expect(rows).toEqual([{ full_name: 'Ali' }, { full_name: 'Veli' }]);
  });

  it('opens plaintext when the keystore is unavailable (degraded, no throw)', async () => {
    keystoreCtl.impl = async () => {
      throw new Error('dpapi-down');
    };
    const { getDB } = await freshDbModule();
    const db = tracker.track(await getDB());

    expect(isPlaintextHeader(dbPath())).toBe(true);
    const count = await db.get('SELECT COUNT(*) as count FROM app_settings');
    expect(count.count).toBeGreaterThan(0);
    expect(loggerCtl.logs.error.length).toBeGreaterThan(0);
  });

  it('auto-recovers when the primary fails to open (latest backup restored)', async () => {
    const backupDir = path.join(paths.documents, 'TectonBackups', 'Database-Backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, 'elektronik-yevmiye-backup-2026-01-10.sqlite');
    const seed = openCompat({ filename: backupPath, key: TEST_KEY });
    await seed.exec('CREATE TABLE probe(id INTEGER PRIMARY KEY, v TEXT)');
    await seed.run('INSERT INTO probe(v) VALUES (?)', ['recovered']);
    await seed.close();

    // Corrupted primary on disk + a hard open failure (dbCompat wrapper
    // throws once with the exact native error) -> recovery branch.
    fs.writeFileSync(dbPath(), 'garbage-not-sqlite');
    dbCompatCtl.failOpenOnce = true;

    const { getDB } = await freshDbModule();
    const db = tracker.track(await getDB());

    const row = await db.get('SELECT v FROM probe WHERE id = 1');
    expect(row.v).toBe('recovered');
  });

  it('throws when the primary is corrupted and no backup exists', async () => {
    // NOTE (verified real behavior): `key` pragma is lazy, so a garbage
    // primary passes openCompat and fails later at first read/integrity
    // check -> getDB rejects. Documented here as a regression guard.
    fs.writeFileSync(dbPath(), 'garbage-not-sqlite');
    const { getDB } = await freshDbModule();
    await expect(getDB()).rejects.toThrow();
  });

  it('runs an integrity check after an unclean shutdown', async () => {
    const { getDB: getDB1 } = await freshDbModule();
    tracker.track(await getDB1());
    await tracker.closeAll();

    // Simulate a previous run that never shut down cleanly.
    const raw = openCompat({ filename: dbPath(), key: TEST_KEY });
    await raw.run(
      "INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)",
      ['clean_shutdown', '0', 'Clean Shutdown Status (0=no, 1=yes)']
    );
    await raw.close();

    const { getDB: getDB2 } = await freshDbModule();
    const db2 = tracker.track(await getDB2());
    const warnCalls = loggerCtl.logs.warn.map((c) => String(c[0]));
    expect(warnCalls.some((m) => m.includes('Unclean shutdown'))).toBe(true);
    const flag = await db2.get("SELECT setting_value FROM app_settings WHERE setting_key = 'clean_shutdown'");
    expect(flag.setting_value).toBe('0');
  });

  it('defers audit archiving and 30-day recycle purge (fake timers)', async () => {
    const { getDB } = await freshDbModule();
    const db = tracker.track(await getDB());

    await db.run(
      "INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, created_at) VALUES ('workers', 1, 'CREATE', NULL, NULL, datetime('now', '-2 days'))"
    );
    await db.run("INSERT INTO workers (full_name, daily_wage, is_deleted) VALUES ('Silinecek', 1000, 1)");
    const w = await db.get("SELECT id FROM workers WHERE full_name = 'Silinecek'");
    await db.run(
      "INSERT INTO recycle_bin (table_name, record_id, title, deleted_at, is_restored) VALUES ('workers', ?, 'Silinecek', datetime('now', '-31 days'), 0)",
      [w.id]
    );

    await vi.advanceTimersByTimeAsync(1500);

    const remaining = await db.all('SELECT * FROM audit_logs');
    expect(remaining.length).toBe(0);
    const gone = await db.get('SELECT * FROM workers WHERE id = ?', [w.id]);
    expect(gone).toBeUndefined();

    const today = new Date();
    const yyyy = String(today.getFullYear());
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const logDir = path.join(paths.documents, 'TectonBackups', 'SystemLogs-Backups', yyyy, mm);
    const files = fs.existsSync(logDir) ? fs.readdirSync(logDir) : [];
    expect(files.some((f) => f.startsWith('audit-') && f.endsWith('.log'))).toBe(true);
  });
});

describe('db.js snapshots', () => {
  it('creates and restores a snapshot round-trip', async () => {
    const { getDB, createSnapshot, restoreSnapshot } = await freshDbModule();
    const db = tracker.track(await getDB());
    await db.run("INSERT INTO workers (full_name, daily_wage) VALUES ('Snap', 1000)");

    const created = createSnapshot('restore-point');
    expect(created.success).toBe(true);
    expect(fs.existsSync(created.backupPath)).toBe(true);

    await db.run("DELETE FROM workers WHERE full_name = 'Snap'");
    const restored = restoreSnapshot('restore-point');
    expect(restored.success).toBe(true);

    await tracker.closeAll();
    const { getDB: getDB2 } = await freshDbModule();
    const db2 = tracker.track(await getDB2());
    const row = await db2.get("SELECT full_name FROM workers WHERE full_name = 'Snap'");
    expect(row.full_name).toBe('Snap');
  });

  it('reports a missing restore point without throwing', async () => {
    const { restoreSnapshot } = await freshDbModule();
    expect(restoreSnapshot('restore-point')).toEqual({
      success: false,
      message: 'Restore point bulunamadı.',
    });
  });
});
