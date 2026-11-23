// Integration tests for src/main/ipcHandlers.js: every ipcMain channel is
// registered against an in-memory DB and invoked directly (no Electron).
//
// SEAMS (all native require.cache seeds - CJS `require()` inside sources
// bypasses `vi.mock`; see test-helpers/electronMock.js):
// - 'electron'      -> capturing stub (ipcMain/dialog/app/BrowserWindow/...)
// - '../database/db'-> { getDB } returning the per-test :memory: DB
// - '../services/lanServer' -> start/stop stub (real server stays in lanServer.test.js)
// - 'child_process' -> exec recorder (best-effort; guarded assertion-free)
// Services (crud/financial/balance/wage/report/secret), dbCompat, QRCode and
// better-sqlite3 run REAL. `vi.resetModules()` + static re-import registers
// a fresh handler set per test (last registration wins).

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  createIsolatedPaths,
  installPathMap,
  destroyPaths,
  createDbTracker,
  getHandledMap,
  seedNativeElectron,
  getElectronStub,
  resetElectronStub,
  seedNativeKeystore,
  seedNativeLogger,
  seedNativeStub,
} from './test-helpers/electronMock.js';
import { setupTestDB } from './services/testDb.js';
import { openCompat } from './database/dbCompat.js';

const TEST_KEY = 'ipc-test-key-123';

seedNativeElectron();
const { ctl: keystoreCtl } = seedNativeKeystore();
seedNativeLogger();

const dbIpcCtl = { db: null };
seedNativeStub('../database/db', '__tectonIpcDbStub', () => ({
  getDB: async () => {
    if (!dbIpcCtl.db) throw new Error('no-test-db');
    return dbIpcCtl.db;
  },
  createSnapshot: () => ({ success: true, backupPath: '/mock/snap' }),
  restoreSnapshot: () => ({ success: true }),
}));

const lanCtl = { mode: 'ok', stopped: false };
seedNativeStub('../services/lanServer', '__tectonIpcLanStub', () => ({
  startLANServer: () => {
    if (lanCtl.mode !== 'ok') return { success: false };
    return { success: true, ip: '192.168.1.2', port: 5001 };
  },
  stopLANServer: () => {
    lanCtl.stopped = true;
  },
}));

const cpCalls = [];
seedNativeStub('child_process', '__tectonCpStub', () => ({
  exec: (...args) => {
    cpCalls.push(args);
  },
}));

let paths;
let tracker;
const realFetch = globalThis.fetch;

function liveDbPath() {
  return path.join(paths.userData, 'elektronik-yevmiye.sqlite');
}

async function freshHandlers() {
  vi.resetModules();
  await import('./ipcHandlers.js');
  await vi.waitFor(
    () => {
      if (!getHandledMap()['db:read']) throw new Error('handlers pending');
    },
    { timeout: 5000 }
  );
  return getHandledMap();
}

function stub() {
  return getElectronStub();
}

function fakeWin(calls, isMax = false) {
  return {
    minimize: () => calls.push('minimize'),
    maximize: () => calls.push('maximize'),
    unmaximize: () => calls.push('unmaximize'),
    close: () => calls.push('close'),
    isMaximized: () => isMax,
    isDestroyed: () => false,
  };
}

async function seedWorkerLedger(db) {
  await db.run("INSERT INTO workers (id, full_name, daily_wage) VALUES (1, 'Test Isci', 1000)");
  for (let i = 1; i <= 5; i++) {
    await db.run(
      "INSERT INTO timesheets (worker_id, work_date, applied_wage, applied_multiplier, earned_amount) VALUES (1, '2026-06-11', 1000, 1.0, 1000)"
    );
  }
  await db.run("INSERT INTO transactions (worker_id, trans_date, amount) VALUES (1, '2026-06-11', 500)");
  await db.run("INSERT INTO transactions (worker_id, trans_date, amount) VALUES (1, '2026-06-12', 500)");
}

async function seedSeptember(db) {
  await db.run("INSERT INTO workers (id, full_name, daily_wage) VALUES (1, 'Veli Rapor', 1000)");
  await db.run(
    "INSERT INTO timesheets (worker_id, work_date, applied_wage, applied_multiplier, earned_amount) VALUES (1, '2023-08-15', 1000, 1.0, 3000)"
  );
  await db.run(
    "INSERT INTO transactions (worker_id, trans_date, trans_type, amount) VALUES (1, '2023-08-20', 'Avans', 1000)"
  );
  await db.run(
    "INSERT INTO timesheets (worker_id, work_date, applied_wage, applied_multiplier, earned_amount) VALUES (1, '2023-09-05', 1000, 1.0, 2500)"
  );
  await db.run(
    "INSERT INTO transactions (worker_id, trans_date, trans_type, amount) VALUES (1, '2023-09-10', 'Avans', 1500)"
  );
  await db.run(
    "INSERT INTO cash_register (trans_date, type, amount, description) VALUES ('2023-09-01', 'Nakit Girisi', 10000, 'Sermaye')"
  );
  await db.run(
    "INSERT INTO cash_register (trans_date, type, amount, description) VALUES ('2023-09-10', 'Nakit Cikisi', 1500, 'Veli Avans')"
  );
}

beforeEach(async () => {
  keystoreCtl.impl = async () => TEST_KEY;
  lanCtl.mode = 'ok';
  lanCtl.stopped = false;
  cpCalls.length = 0;
  resetElectronStub();
  paths = createIsolatedPaths('tecton-ipc-test-');
  installPathMap(paths);
  tracker = createDbTracker();
  process.env.NODE_ENV = 'test';
  dbIpcCtl.db = tracker.track(await setupTestDB());
  globalThis.fetch = realFetch;
});

afterEach(async () => {
  globalThis.fetch = realFetch;
  await tracker.closeAll();
  destroyPaths(paths);
});

// ---------------- generic CRUD ----------------

describe('ipc db:* generic API', () => {
  it('reads active rows and rejects forbidden tables/columns', async () => {
    const h = await freshHandlers();
    const db = dbIpcCtl.db;
    await db.run("INSERT INTO workers (full_name, daily_wage, is_deleted) VALUES ('A', 1000, 0)");
    await db.run("INSERT INTO workers (full_name, daily_wage, is_deleted) VALUES ('B', 1000, 1)");

    expect(await h['db:read']({}, { table: 'workers', conditions: {} })).toHaveLength(1);
    expect(await h['db:read']({}, { table: 'sqlite_master', conditions: {} })).toEqual([]);
    expect(await h['db:read']({}, { table: 'workers', conditions: { no_such_col: 1 } })).toEqual([]);
  });

  it('creates/updates/deletes with audit trail', async () => {
    const h = await freshHandlers();
    const created = await h['db:create']({}, { table: 'workers', data: { full_name: 'Ipc Isci', daily_wage: 1200 } });
    expect(created.success).toBe(true);

    const updated = await h['db:update']({}, { table: 'workers', id: created.id, data: { daily_wage: 1500 } });
    expect(updated.success).toBe(true);

    const deleted = await h['db:delete']({}, { table: 'workers', id: created.id });
    expect(deleted.success).toBe(true);
    expect(await h['db:read']({}, { table: 'workers', conditions: {} })).toHaveLength(0);

    const bad = await h['db:create']({}, { table: 'workers', data: { bogus_col: 1 } });
    expect(bad.success).toBe(false);
    const badUpd = await h['db:update']({}, { table: 'workers', id: 9999, data: { bogus_col: 1 } });
    expect(badUpd.success).toBe(false);
  });

  it('creates bulk records and validates the payload', async () => {
    const h = await freshHandlers();
    const res = await h['db:create-bulk'](
      {},
      {
        table: 'workers',
        dataList: [
          { full_name: 'Bulk1', daily_wage: 1000 },
          { full_name: 'Bulk2', daily_wage: 2000 },
        ],
        logMessage: 'Toplu isci',
      }
    );
    expect(res.success).toBe(true);
    expect(await h['db:read']({}, { table: 'workers', conditions: {} })).toHaveLength(2);

    expect(await h['db:create-bulk']({}, { table: 'workers', dataList: [] })).toEqual({
      success: false,
      message: 'Veri listesi boş.',
    });
    const badBulk = await h['db:create-bulk']({}, { table: 'nope', dataList: [{ a: 1 }] });
    expect(badBulk.success).toBe(false);
  });

  it('returns safe fallbacks when the DB layer throws', async () => {
    // NOTE: handlers close over the DB from import time, so the broken
    // double must be installed BEFORE freshHandlers().
    dbIpcCtl.db = {
      all: async () => {
        throw new Error('down');
      },
      get: async () => {
        throw new Error('down');
      },
      run: async () => {
        throw new Error('down');
      },
      exec: async () => {
        throw new Error('down');
      },
      close: async () => {},
    };
    const h = await freshHandlers();
    expect(await h['db:read']({}, { table: 'workers', conditions: {} })).toEqual([]);
    expect((await h['db:create']({}, { table: 'workers', data: { full_name: 'x' } })).success).toBe(false);
    expect((await h['db:update']({}, { table: 'workers', id: 1, data: {} })).success).toBe(false);
    expect((await h['db:delete']({}, { table: 'workers', id: 1 })).success).toBe(false);
    expect((await h['db:create-bulk']({}, { table: 'workers', dataList: [{ full_name: 'x' }] })).success).toBe(false);
    expect(await h['db:read-deleted']()).toEqual([]);
    expect(await h['db:read-all-projects']()).toEqual([]);
    expect((await h['db:restore']({}, { table: 'workers', id: 1 })).success).toBe(false);
  });
});

// ---------------- recycle bin ----------------

describe('ipc recycle bin', () => {
  it('lists deleted rows with project names', async () => {
    const h = await freshHandlers();
    const db = dbIpcCtl.db;
    await db.run("INSERT INTO projects (id, name) VALUES (9, 'Santiye')");
    await db.run(
      "INSERT INTO recycle_bin (table_name, record_id, title, project_id, is_restored) VALUES ('workers', 3, 'Ali', 9, 0)"
    );
    await db.run("INSERT INTO recycle_bin (table_name, record_id, title, is_restored) VALUES ('materials', 4, 'Cimento', 1)");

    const rows = await h['db:read-deleted']();
    expect(rows).toHaveLength(2);
    const withProj = rows.find((r) => r.title === 'Ali');
    expect(withProj.project_name).toBe('Santiye');
    expect(withProj.is_deleted).toBe(1);
    expect(rows.find((r) => r.title === 'Cimento').is_deleted).toBe(0);
  });

  it('reads all projects in sort order', async () => {
    const h = await freshHandlers();
    const db = dbIpcCtl.db;
    await db.run("INSERT INTO projects (name, sort_order) VALUES ('B', 2)");
    await db.run("INSERT INTO projects (name, sort_order) VALUES ('A', 1)");
    const rows = await h['db:read-all-projects']();
    expect(rows.map((r) => r.name)).toEqual(['A', 'B']);
  });

  it('restores a worker and reports a missing bin item', async () => {
    const h = await freshHandlers();
    const db = dbIpcCtl.db;
    await db.run("INSERT INTO workers (id, full_name, daily_wage, is_deleted) VALUES (5, 'Geri', 1000, 1)");
    await db.run("INSERT INTO recycle_bin (table_name, record_id, title) VALUES ('workers', 5, 'Geri')");
    const bin = await db.get('SELECT id FROM recycle_bin');

    const res = await h['db:restore']({}, { table: 'workers', id: bin.id });
    expect(res.success).toBe(true);
    expect((await db.get('SELECT is_deleted FROM workers WHERE id = 5')).is_deleted).toBe(0);

    // `messageKey` is additive i18n metadata on the dev branch, so match the
    // meaningful fields rather than the whole object.
    expect(await h['db:restore']({}, { table: 'workers', id: 99999 })).toMatchObject({
      success: false,
      message: 'Çöp kutusu kaydı bulunamadı.',
    });
  });

  it('cascade-restores linked cash for transactions', async () => {
    const h = await freshHandlers();
    const db = dbIpcCtl.db;
    await db.run(
      "INSERT INTO cash_register (id, trans_date, type, amount, is_deleted) VALUES (11, '2026-01-01', 'Nakit Cikisi', 500, 1)"
    );
    await db.run(
      "INSERT INTO transactions (id, worker_id, trans_date, amount, linked_cash_id, is_deleted) VALUES (12, 1, '2026-01-01', 500, 11, 1)"
    );
    await db.run("INSERT INTO recycle_bin (table_name, record_id, title) VALUES ('transactions', 12, 'Avans')");
    const bin = await db.get('SELECT id FROM recycle_bin');

    expect((await h['db:restore']({}, { table: 'x', id: bin.id })).success).toBe(true);
    expect((await db.get('SELECT is_deleted FROM cash_register WHERE id = 11')).is_deleted).toBe(0);
  });

  it('cascade-restores project children', async () => {
    const h = await freshHandlers();
    const db = dbIpcCtl.db;
    await db.run("INSERT INTO projects (id, name, is_deleted) VALUES (21, 'P', 1)");
    await db.run("INSERT INTO workers (id, full_name, daily_wage, project_id, is_deleted) VALUES (22, 'W', 1000, 21, 1)");
    await db.run(
      "INSERT INTO materials (project_id, supplier, material_type, quantity, unit, receipt_date, is_deleted) VALUES (21, 'S', 'M', 1, 'adet', '2026-01-01', 1)"
    );
    await db.run("INSERT INTO recycle_bin (table_name, record_id, title) VALUES ('projects', 21, 'P')");
    const bin = await db.get('SELECT id FROM recycle_bin');

    expect((await h['db:restore']({}, { table: 'x', id: bin.id })).success).toBe(true);
    expect((await db.get('SELECT is_deleted FROM workers WHERE id = 22')).is_deleted).toBe(0);
    expect((await db.get('SELECT is_deleted FROM materials WHERE project_id = 21')).is_deleted).toBe(0);
  });
});

// ---------------- finance ----------------

describe('ipc finance:*', () => {
  it('deletes a transaction with its linked cash entry', async () => {
    const h = await freshHandlers();
    const db = dbIpcCtl.db;
    await db.run(
      "INSERT INTO cash_register (id, trans_date, type, amount, is_deleted) VALUES (31, '2026-02-01', 'Nakit Cikisi', 700, 0)"
    );
    await db.run(
      "INSERT INTO transactions (id, worker_id, trans_date, amount, linked_cash_id, is_deleted) VALUES (32, 1, '2026-02-01', 700, 31, 0)"
    );

    expect(await h['finance:delete-transaction']({}, { id: 9999 })).toMatchObject({
      success: false,
      message: 'Transaction not found',
    });
    const res = await h['finance:delete-transaction']({}, { id: 32 });
    expect(res.success).toBe(true);
    expect((await db.get('SELECT is_deleted FROM cash_register WHERE id = 31')).is_deleted).toBe(1);
  });

  it('creates advances with and without a cash leg', async () => {
    const h = await freshHandlers();
    const db = dbIpcCtl.db;
    const avans = await h['finance:create-advance'](
      {},
      { data: { worker_id: 1, trans_date: '2026-03-01', trans_type: 'Avans', amount: 900, notes: 'n', project_id: null } }
    );
    expect(avans.success).toBe(true);
    expect(avans.linked_cash_id).toBeGreaterThan(0);
    expect((await db.get('SELECT type FROM cash_register WHERE id = ?', [avans.linked_cash_id])).type).toBe(
      'expense'
    );

    // 'Ödeme' is a legacy spelling of an advance, so the non-cash case uses a
    // balance carry-over, which never moves cash.
    const odeme = await h['finance:create-advance'](
      {},
      { data: { worker_id: 1, trans_date: '2026-03-02', trans_type: 'Bakiye Devri', amount: 100, project_id: null } }
    );
    expect(odeme.success).toBe(true);
    expect(odeme.linked_cash_id).toBeNull();

    expect((await h['finance:create-advance']({}, { data: {} })).success).toBe(false);
  });

  it('reports balances (single + bulk)', async () => {
    const h = await freshHandlers();
    await seedWorkerLedger(dbIpcCtl.db);

    expect(await h['finance:get-balance']({}, { worker_id: 1 })).toEqual({ success: true, balance: 4000 });
    const bulk = await h['finance:get-balances']({}, { worker_ids: [1] });
    expect(bulk.success).toBe(true);
    expect(bulk.balances[1]).toBe(4000);
  });

  it('calculates wages and validates settings', async () => {
    const h = await freshHandlers();
    const db = dbIpcCtl.db;
    await db.run("INSERT INTO app_settings (setting_key, setting_value) VALUES ('standard_daily_hours', '8')");
    await db.run("INSERT INTO app_settings (setting_key, setting_value) VALUES ('overtime_multiplier', '1.5')");

    const ok = await h['finance:calculate-wage']({}, { daily_wage: 1000, multiplier: 1, overtime_hours: 2 });
    expect(ok).toEqual({ success: true, wage: 1375 });

    await db.run("UPDATE app_settings SET setting_value = '-3' WHERE setting_key = 'standard_daily_hours'");
    expect(await h['finance:calculate-wage']({}, { daily_wage: 1000, multiplier: 1 })).toMatchObject({
      success: false,
      message: 'Çalışma saati 0 veya daha küçük olamaz.',
    });

    expect((await h['finance:calculate-wage']({}, { daily_wage: 'bin', multiplier: 1 })).success).toBe(false);
  });

  it('generates worker/report/company/group statements', async () => {
    const h = await freshHandlers();
    await seedSeptember(dbIpcCtl.db);

    const monthly = await h['finance:worker-report']({}, { worker_id: 1, year: 2023, month: 9 });
    expect(monthly.success).toBe(true);
    expect(monthly.summary).toMatchObject({ devredenBakiye: 2000, monthEarned: 2500, monthAdvance: 1500 });

    const statement = await h['finance:worker-statement'](
      {},
      { worker_id: 1, start_date: '2023-09-30', end_date: '2023-09-01' }
    );
    expect(statement.success).toBe(true);
    expect(statement.summary.periodEarned).toBe(2500);

    const company = await h['finance:company-report']({}, { year: 2023, month: 9 });
    expect(company.success).toBe(true);
    expect(company.summary.totalWageCost).toBe(2500);

    const group = await h['finance:group-statement'](
      {},
      { start_date: '2023-09-01', end_date: '2023-09-30' }
    );
    expect(group.success).toBe(true);
    expect(group.groups.length).toBeGreaterThan(0);
  });
});

// ---------------- system ----------------

describe('ipc system:*', () => {
  it('backs up the DB (cancel + success)', async () => {
    const h = await freshHandlers();
    expect(await h['system:backup-db']({})).toMatchObject({ success: false, message: 'İşlem iptal edildi' });

    fs.writeFileSync(liveDbPath(), 'dummy-db');
    const dest = path.join(paths.root, 'manual-backup.sqlite');
    stub().dialog.showSaveDialog = async () => ({ canceled: false, filePath: dest });
    const res = await h['system:backup-db']({});
    expect(res.success).toBe(true);
    expect(fs.existsSync(dest)).toBe(true);
  });

  it('reads logs (recursive + date range + empty)', async () => {
    const h = await freshHandlers();
    const base = path.join(paths.documents, 'TectonBackups', 'SystemLogs-Backups');
    fs.mkdirSync(path.join(base, '2026', '01'), { recursive: true });
    fs.writeFileSync(path.join(base, '2026', '01', 'audit-2026-01-05.log'), 'line1\n\nline2\n');
    fs.writeFileSync(path.join(base, '2026', '01', '2026-01-06.log'), 'day6\n');

    const all = await h['system:read-logs']({}, {});
    expect(all.success).toBe(true);
    expect(all.logs).toEqual(expect.arrayContaining(['line1', 'line2', 'day6']));

    const ranged = await h['system:read-logs']({}, { startDate: '2026-01-06', endDate: '2026-01-06' });
    expect(ranged.logs).toEqual(['day6']);

    const empty = await h['system:read-logs']({}, { startDate: '2020-01-01', endDate: '2020-01-02' });
    expect(empty).toMatchObject({ success: true, logs: [] });
  });

  it('vacuums the DB', async () => {
    const h = await freshHandlers();
    expect(await h['system:vacuum-db']()).toEqual({ success: true });
  });

  it('sets the cloud folder (insert + update + cancel)', async () => {
    const h = await freshHandlers();
    expect(await h['system:set-cloud-folder']()).toMatchObject({ success: false, message: 'İşlem iptal edildi' });

    const dir = path.join(paths.root, 'cloud');
    fs.mkdirSync(dir, { recursive: true });
    stub().dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
    expect(await h['system:set-cloud-folder']()).toEqual({ success: true, folderPath: dir });
    expect(await h['system:set-cloud-folder']()).toEqual({ success: true, folderPath: dir });
  });

  it('serves weather: missing key without leaking secrets', async () => {
    const h = await freshHandlers();
    const res = await h['system:get-weather']({}, { location: 'Ankara', lang: 'tr' });
    expect(res).toMatchObject({ success: false, errorType: 'missing_key' });
    expect(res.message).toContain('API anahtarı');
    expect(await h['system:get-weather']({}, { location: '', lang: 'tr' })).toMatchObject({
      success: false,
      message: 'Lokasyon belirtilmedi.',
    });
  });

  it('maps weather failures and localizes messages', async () => {
    const h = await freshHandlers();
    const db = dbIpcCtl.db;
    await db.run("INSERT INTO app_settings (setting_key, setting_value) VALUES ('weather_api_key', 'ABC123XYZ9')");

    globalThis.fetch = async () => {
      throw new Error('down');
    };
    for (const lang of ['tr', 'hi', 'ar', 'en']) {
      expect(await h['system:get-weather']({}, { location: 'Ankara', lang })).toMatchObject({
        success: false,
        errorType: 'offline',
      });
    }

    globalThis.fetch = async () => ({ ok: false, status: 401 });
    for (const lang of ['tr', 'hi', 'ar', 'en']) {
      expect(await h['system:get-weather']({}, { location: 'Ankara', lang })).toMatchObject({
        success: false,
        errorType: 'unauthorized',
      });
    }

    globalThis.fetch = async () => ({ ok: false, status: 404 });
    for (const lang of ['tr', 'hi', 'ar', 'en']) {
      expect(await h['system:get-weather']({}, { location: 'Ankara', lang })).toMatchObject({
        success: false,
        errorType: 'not_found',
      });
    }

    globalThis.fetch = async () => ({ ok: false, status: 500 });
    for (const lang of ['tr', 'hi', 'ar', 'en']) {
      const res = await h['system:get-weather']({}, { location: 'Ankara', lang });
      expect(res.errorType).toBe('api_error');
      expect(JSON.stringify(res)).not.toContain('ABC123XYZ9');
    }

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ main: { temp: 21.6 }, weather: [{ description: 'acik', icon: '01d' }] }),
    });
    const ok = await h['system:get-weather']({}, { location: 'Ankara', lang: 'zh' });
    expect(ok).toMatchObject({ success: true, temp: 22, desc: 'acik', icon: '01d', simulated: false });
  });

  it('manages the weather key via the keychain gate', async () => {
    const h = await freshHandlers();
    // Stubbed safeStorage reports no keychain -> set refuses, nothing stored.
    expect(await h['system:set-weather-key']({}, { apiKey: 'short' })).toMatchObject({
      success: false,
      errorType: 'invalid_key',
    });
    expect(await h['system:set-weather-key']({}, { apiKey: 'ABC123XYZ9' })).toMatchObject({
      success: false,
      errorType: 'no_keychain',
    });
    expect(await h['system:is-weather-configured']()).toEqual({ success: true, configured: false });

    await dbIpcCtl.db.run(
      "INSERT INTO app_settings (setting_key, setting_value) VALUES ('weather_api_key', 'ABC123XYZ9')"
    );
    expect(await h['system:is-weather-configured']()).toEqual({ success: true, configured: true });
  });

  it('opens helper folders', async () => {
    const h = await freshHandlers();
    expect(await h['system:open-old-backups-folder']()).toEqual({ success: true });
    expect(fs.existsSync(path.join(paths.userData, 'old_backups'))).toBe(true);
    expect(await h['system:open-logs-folder']()).toEqual({ success: true });
    expect(
      fs.existsSync(path.join(paths.documents, 'TectonBackups', 'SystemLogs-Backups'))
    ).toBe(true);
  });

  it('changes the desktop icon through every branch', async () => {
    const h = await freshHandlers();
    expect(await h['system:change-desktop-icon']({}, { theme: 'dark' })).toMatchObject({
      success: false,
      message: 'İkon dosyası bulunamadı.',
    });

    const assets = path.join(paths.root, 'tecton_assets');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, 'tecton-tray-dark.ico'), 'ico');
    fs.writeFileSync(path.join(assets, 'tecton-tray-light.ico'), 'ico');
    expect(await h['system:change-desktop-icon']({}, { theme: 'dark' })).toMatchObject({
      success: false,
      message: 'Masaüstü kısayolu bulunamadı (Tecton.lnk).',
    });

    fs.writeFileSync(path.join(paths.desktop, 'Tecton.lnk'), 'lnk');
    stub().shell.writeShortcutLink = () => false;
    expect(await h['system:change-desktop-icon']({}, { theme: 'light' })).toMatchObject({
      success: false,
      message: 'Kısayol güncellenemedi.',
    });

    stub().shell.writeShortcutLink = () => true;
    expect((await h['system:change-desktop-icon']({}, { theme: 'light' })).success).toBe(true);
  });
});

// ---------------- media ----------------

describe('ipc media:*', () => {
  it('selects photos via dialog', async () => {
    const h = await freshHandlers();
    expect(await h['media:select-photo']()).toEqual({ success: false });
    stub().dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['/tmp/a.jpg'] });
    expect(await h['media:select-photo']()).toEqual({ success: true, filePath: '/tmp/a.jpg' });
  });

  it('saves/reads photos with traversal guard', async () => {
    const h = await freshHandlers();
    expect(await h['media:save-photo']({}, {})).toMatchObject({ success: false, message: 'Dosya seçilmedi' });

    const src = path.join(paths.root, 'src.jpg');
    fs.writeFileSync(src, 'jpeg-bytes');
    const saved = await h['media:save-photo']({}, { projectId: 7, filePath: src });
    expect(saved.success).toBe(true);
    expect(saved.relativePath.startsWith('project_7/')).toBe(true);

    const read = await h['media:read-photo']({}, { relativePath: saved.relativePath });
    expect(read.success).toBe(true);
    expect(read.base64.startsWith('data:image/jpeg;base64,')).toBe(true);

    expect(await h['media:read-photo']({}, { relativePath: '../../evil.jpg' })).toMatchObject({
      success: false,
      message: 'Geçersiz dosya yolu',
    });
    expect(await h['media:read-photo']({}, { relativePath: 'project_7/nope.jpg' })).toMatchObject({
      success: false,
      message: 'Dosya bulunamadı',
    });
    expect(await h['media:read-photo']({}, {})).toMatchObject({ success: false, message: 'Dosya belirtilmedi' });
  });

  it('saves base64 photos', async () => {
    const h = await freshHandlers();
    expect(await h['media:save-photo-base64']({}, {})).toMatchObject({ success: false, message: 'Veri boş' });
    const payload = `data:image/webp;base64,${Buffer.from('webp-bytes').toString('base64')}`;
    const saved = await h['media:save-photo-base64']({}, { projectId: 3, base64Data: payload });
    expect(saved.success).toBe(true);
    expect(saved.relativePath.endsWith('.webp')).toBe(true);
  });
});

// ---------------- LAN + restore + window ----------------

describe('ipc lan/restore/window', () => {
  it('starts/stops the LAN server (ok + failure)', async () => {
    const h = await freshHandlers();
    const ok = await h['system:start-lan-server'](
      { sender: {} },
      { projectId: 4, projectName: 'Santiye', lang: 'tr' }
    );
    expect(ok.success).toBe(true);
    expect(ok.url).toContain('192.168.1.2:5001');
    expect(ok.url).toContain('projectId=4');
    expect(ok.qrCodeDataUrl.startsWith('data:image/png')).toBe(true);

    lanCtl.mode = 'fail';
    expect(
      await h['system:start-lan-server']({ sender: {} }, { projectId: 4, projectName: 'S', lang: 'tr' })
    ).toMatchObject({ success: false, message: 'Sunucu başlatılamadı.' });

    expect(await h['system:stop-lan-server']()).toEqual({ success: true });
    expect(lanCtl.stopped).toBe(true);
  });

  it('restores a DB file (invalid + corrupted + success)', async () => {
    const h = await freshHandlers();
    expect(await h['system:restore-db-file']({}, {})).toMatchObject({
      success: false,
      message: 'Geçersiz dosya yolu.',
    });
    expect(await h['system:restore-db-file']({}, { filePath: '/nonexistent/x.sqlite' })).toMatchObject({
      success: false,
      message: 'Geçersiz dosya yolu.',
    });

    const garbage = path.join(paths.root, 'garbage.sqlite');
    fs.writeFileSync(garbage, 'garbage-not-sqlite');
    expect(await h['system:restore-db-file']({}, { filePath: garbage })).toMatchObject({
      success: false,
      message: 'RESTORE_CORRUPTED',
    });

    const candidate = path.join(paths.root, 'candidate.sqlite');
    const seed = openCompat({ filename: candidate, key: TEST_KEY });
    await seed.exec('CREATE TABLE probe(id INTEGER PRIMARY KEY, v TEXT)');
    await seed.run('INSERT INTO probe(v) VALUES (?)', ['restored']);
    await seed.close();

    fs.writeFileSync(liveDbPath(), 'current-live');
    const calls = [];
    stub().app.relaunch = () => calls.push('relaunch');
    stub().app.exit = () => calls.push('exit');
    expect(await h['system:restore-db-file']({}, { filePath: candidate })).toEqual({ success: true });
    // The handler replies first, then relaunches on a short timer so the IPC
    // result reaches the renderer before the process restarts.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(calls).toEqual(['relaunch', 'exit']);

    const check = openCompat({ filename: liveDbPath(), key: TEST_KEY });
    expect((await check.get('SELECT v FROM probe WHERE id = 1')).v).toBe('restored');
    await check.close();
  });

  it('controls windows safely (incl. null window)', async () => {
    const h = await freshHandlers();
    // Null window (default stub): must not throw.
    await h['window:minimize']({ sender: {} });
    await h['window:maximize']({ sender: {} });
    await h['window:close']({ sender: {} });

    const calls = [];
    stub().BrowserWindow.fromWebContents = () => fakeWin(calls, false);
    await h['window:minimize']({ sender: {} });
    await h['window:maximize']({ sender: {} });
    await h['window:close']({ sender: {} });
    expect(calls).toEqual(['minimize', 'maximize', 'close']);

    const calls2 = [];
    stub().BrowserWindow.fromWebContents = () => fakeWin(calls2, true);
    await h['window:maximize']({ sender: {} });
    expect(calls2).toEqual(['unmaximize']);
  });
});
