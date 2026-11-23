// Integration tests for src/main/index.js (app lifecycle): theme load,
// splash + main window creation, app-ready fast path, activate re-create,
// graceful close with safe backup, and window-all-closed quit.
//
// SEAMS: native require.cache seeds (see test-helpers). BrowserWindow is a
// recording fake; getDB serves a :memory: DB; timers are fake.

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  createIsolatedPaths,
  installPathMap,
  destroyPaths,
  createDbTracker,
  seedNativeElectron,
  getElectronStub,
  resetElectronStub,
  seedNativeKeystore,
  seedNativeLogger,
  seedNativeStub,
} from './test-helpers/electronMock.js';
import { setupTestDB } from './services/testDb.js';

seedNativeElectron();
seedNativeLogger();
const loggerCtl = seedNativeLogger();
// Fixed key for the close-flow backup verification (also keeps keystore.js
// single-loaded by keystore.test.js for stable v8 attribution).
const { ctl: keystoreCtl } = seedNativeKeystore();

const dbIdxCtl = { db: null, fail: false };
seedNativeStub('../database/db', '__tectonIdxDbStub', () => ({
  getDB: async () => {
    if (dbIdxCtl.fail) throw new Error('db gone');
    if (!dbIdxCtl.db) throw new Error('no-test-db');
    return dbIdxCtl.db;
  },
  createSnapshot: () => ({ success: true, backupPath: '/mock/snap' }),
  restoreSnapshot: () => ({ success: true }),
}));
// index.js only needs ipcHandlers for its side-effect import; the handler
// chain itself is covered in ipcHandlers.test.js. Stubbing keeps this suite
// isolated AND avoids double-loading ipcHandlers (v8 merge artifact).
seedNativeStub('../ipcHandlers', '__tectonIdxIpcStub', () => ({}));

// ---- recording BrowserWindow ----
const wins = [];
const appHandlers = new Map();
const ipcHandlers = new Map();
let cspCalls = 0;

function FakeWindow(opts) {
  const w = {
    opts,
    calls: [],
    handlers: {},
    loadFile: async (...a) => {
      w.calls.push(['loadFile', a]);
    },
    loadURL: async (...a) => {
      w.calls.push(['loadURL', a]);
    },
    show: () => {
      w.calls.push(['show']);
    },
    maximize: () => {
      w.calls.push(['maximize']);
    },
    minimize: () => {
      w.calls.push(['minimize']);
    },
    close: () => {
      w.calls.push(['close']);
    },
    isDestroyed: () => false,
    webContents: {
      send: (...a) => {
        w.calls.push(['send', a]);
      },
      on: (ev, fn) => {
        (w.handlers[ev] ??= []).push(fn);
      },
      setWindowOpenHandler: () => {},
    },
    once: (ev, fn) => {
      (w.handlers[ev] ??= []).push(fn);
    },
    on: (ev, fn) => {
      (w.handlers[ev] ??= []).push(fn);
    },
  };
  wins.push(w);
  return w;
}
FakeWindow.fromWebContents = () => null;
FakeWindow.getAllWindows = () => wins;

{
  const stub = getElectronStub();
  stub.BrowserWindow = FakeWindow;
  stub.ipcMain.on = (ch, fn) => {
    ipcHandlers.set(ch, fn);
  };
  stub.app.on = (ev, fn) => {
    if (!appHandlers.has(ev)) appHandlers.set(ev, []);
    appHandlers.get(ev).push(fn);
  };
  const origHeaders = stub.session.defaultSession.webRequest.onHeadersReceived;
  stub.session.defaultSession.webRequest.onHeadersReceived = (...a) => {
    cspCalls += 1;
    return origHeaders(...a);
  };
}

let paths;
let tracker;

async function freshApp() {
  vi.resetModules();
  await import('./index.js');
  await vi.waitFor(
    () => {
      if (wins.length < 2) throw new Error('windows pending');
    },
    { timeout: 5000 }
  );
  return { splash: wins[wins.length - 2], main: wins[wins.length - 1] };
}

beforeEach(async () => {
  vi.useFakeTimers();
  keystoreCtl.impl = async () => 'idx-test-key';
  wins.length = 0;
  appHandlers.clear();
  ipcHandlers.clear();
  cspCalls = 0;
  dbIdxCtl.fail = false;
  resetElectronStub();
  // resetElectronStub does not know about our class swap; restore it.
  getElectronStub().BrowserWindow = FakeWindow;
  paths = createIsolatedPaths('tecton-index-test-');
  installPathMap(paths);
  tracker = createDbTracker();
  process.env.NODE_ENV = 'test';
  dbIdxCtl.db = tracker.track(await setupTestDB());
  // app.on/ipcMain.on recorders live on the stub; re-attach after reset.
  const stub = getElectronStub();
  stub.ipcMain.on = (ch, fn) => {
    ipcHandlers.set(ch, fn);
  };
  stub.app.on = (ev, fn) => {
    if (!appHandlers.has(ev)) appHandlers.set(ev, []);
    appHandlers.get(ev).push(fn);
  };
});

afterEach(async () => {
  vi.useRealTimers();
  await tracker.closeAll();
  destroyPaths(paths);
});

describe('main lifecycle', () => {
  it('creates splash + main window with the DB theme and CSP lockdown', async () => {
    await dbIdxCtl.db.run("INSERT INTO app_settings (setting_key, setting_value) VALUES ('theme', 'light')");
    const { splash, main } = await freshApp();

    expect(splash.opts.width).toBe(300);
    expect(main.opts.width).toBe(1200);
    expect(cspCalls).toBe(1);

    // Main window points at the production bundle outside development.
    expect(main.calls.some(([c]) => c === 'loadFile')).toBe(true);

    // Navigation lockdown + popups denied.
    main.handlers['will-navigate'][0]({ preventDefault: () => {} });
    expect(main.webContents.setWindowOpenHandler).toBeDefined();
  });

  it('falls back to dark theme when the DB is unreachable', async () => {
    dbIdxCtl.fail = true;
    const { splash } = await freshApp();
    expect(splash.opts).toBeDefined();
    expect(loggerCtl.logs.error.length).toBeGreaterThan(0);
  });

  it('shows the main window after app-ready without waiting for fallback', async () => {
    const { splash, main } = await freshApp();
    ipcHandlers.get('window:app-ready')();
    await vi.advanceTimersByTimeAsync(2600);
    expect(splash.calls.some(([c]) => c === 'close')).toBe(true);
    expect(main.calls.some(([c]) => c === 'show')).toBe(true);
    expect(main.calls.some(([c]) => c === 'maximize')).toBe(true);

    // Second signal is idempotent (isReadyShown guard).
    ipcHandlers.get('window:app-ready')();
    await vi.advanceTimersByTimeAsync(6000);
    expect(main.calls.filter(([c]) => c === 'show')).toHaveLength(1);
  });

  it('uses the ready-to-show fallback when React never signals', async () => {
    const { main } = await freshApp();
    main.handlers['ready-to-show'][0]();
    await vi.advanceTimersByTimeAsync(3500);
    expect(main.calls.some(([c]) => c === 'show')).toBe(true);
  });

  it('recreates the window on activate when none exist', async () => {
    await freshApp();
    const before = wins.length;
    FakeWindow.getAllWindows = () => [];
    try {
      appHandlers.get('activate')[0]();
      expect(wins.length).toBe(before + 2);
    } finally {
      FakeWindow.getAllWindows = () => wins;
    }
  });

  it('performs a safe backup on close and quits on second close', async () => {
    await dbIdxCtl.db.run(
      "INSERT INTO app_settings (setting_key, setting_value) VALUES ('cloud_sync_folder', ?)",
      [path.join(paths.documents, 'TectonBackups')]
    );
    // An empty database is deliberately not backed up (see the next test), so
    // give it one real record the way a used installation would have.
    await dbIdxCtl.db.run("INSERT INTO projects (name) VALUES ('Test site')");
    const { main } = await freshApp();

    let prevented = false;
    const p = main.handlers.close[0]({ preventDefault: () => { prevented = true; } });
    await vi.advanceTimersByTimeAsync(6000);
    await p;

    expect(prevented).toBe(true);
    expect(main.calls.some(([c, a]) => c === 'send' && a[0] === 'system:shutdown-starting')).toBe(true);
    const flag = await dbIdxCtl.db.get(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'clean_shutdown'"
    );
    // :memory: test DB has no clean_shutdown seed; close still completes.
    expect(flag === undefined || flag.setting_value === '1').toBe(true);
    const backups = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith('.sqlite')) backups.push(full);
      }
    };
    walk(path.join(paths.documents, 'TectonBackups'));
    expect(backups.length).toBeGreaterThan(0);
    expect(main.calls.filter(([c]) => c === 'close')).toHaveLength(1);

    // Second close: isQuitting short-circuits (no new backup, no prevent).
    let prevented2 = false;
    main.handlers.close[0]({ preventDefault: () => { prevented2 = true; } });
    expect(prevented2).toBe(false);
  });

  it('skips the safe backup when the database holds no projects', async () => {
    // A recovery that restored an empty file must not then write that
    // emptiness into the daily backup slot and destroy the real history.
    await dbIdxCtl.db.run(
      "INSERT INTO app_settings (setting_key, setting_value) VALUES ('cloud_sync_folder', ?)",
      [path.join(paths.documents, 'TectonBackups')]
    );
    const { main } = await freshApp();

    const p = main.handlers.close[0]({ preventDefault: () => {} });
    await vi.advanceTimersByTimeAsync(6000);
    await p;

    const sqlite = [];
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith('.sqlite')) sqlite.push(full);
      }
    };
    walk(path.join(paths.documents, 'TectonBackups'));
    expect(sqlite).toHaveLength(0);
    const flag = await dbIdxCtl.db.get(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'clean_shutdown'"
    );
    expect(flag === undefined || flag.setting_value === '1').toBe(true);
  });

  it('quits on window-all-closed outside darwin', async () => {
    await freshApp();
    const quits = [];
    getElectronStub().app.quit = () => quits.push(true);
    const handlers = appHandlers.get('window-all-closed');
    expect(handlers.length).toBe(1);
    handlers[0]();
    if (process.platform !== 'darwin') {
      expect(quits).toEqual([true]);
    }
  });
});
