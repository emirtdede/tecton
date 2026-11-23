// Shared runtime helpers for main-process integration tests.
//
// MOCK ARCHITECTURE (verified against Vitest 4.1.8): `vi.mock('electron')`
// does NOT intercept CJS `require('electron')` inside main-process sources
// (externalized to native Node, where the real package exports a binary-path
// string). Instead, tests seed the NATIVE require.cache for 'electron' with
// a controllable stub BEFORE importing the module under test. `vi.mock`
// remains valid for RELATIVE source modules (e.g. ../services/keystore).
// This module holds plain utilities: native seeding, isolated tmp paths,
// DB tracking (better-sqlite3 keeps Windows file locks, so every opened DB
// must be closed), and ipcMain handler-map extraction.

const fs = require('fs');
const os = require('os');
const path = require('path');

const STUB_MARK = '__tectonElectronStub';

function defaultDialog() {
  return {
    showSaveDialog: async () => ({ canceled: true }),
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showMessageBox: async () => ({ response: 1, checkboxChecked: false }),
  };
}

function buildStub() {
  const ipcCalls = [];
  const stub = {
    [STUB_MARK]: true,
    __ipcCalls: ipcCalls,
    app: {
      getPath: (name) => {
        const map = globalThis.__tectonTestPaths || {};
        return map[name] || `/mock/${name}`;
      },
      getAppPath: () => {
        const map = globalThis.__tectonTestPaths || {};
        return map.root || '/mock/app';
      },
      getLocale: () => 'tr-TR',
      requestSingleInstanceLock: () => true,
      hasSingleInstanceLock: () => true,
      setAppUserModelId: () => {},
      relaunch: () => {},
      exit: () => {},
      quit: () => {},
      on: () => {},
      off: () => {},
      once: () => {},
      whenReady: () => Promise.resolve(),
      isReady: () => true,
    },
    safeStorage: {
      isEncryptionAvailable: () => false,
      isAsyncEncryptionAvailable: async () => false,
      encryptString: (s) => Buffer.from(`enc:${s}`),
      decryptString: (buf) => String(buf).replace(/^enc:/, ''),
      encryptStringAsync: async (s) => Buffer.from(`enc:${s}`),
      decryptStringAsync: async (buf) => ({ result: String(buf).replace(/^enc:/, ''), shouldReEncrypt: false }),
    },
    dialog: defaultDialog(),
    BrowserWindow: Object.assign(
      function BrowserWindow() {
        return {
          loadFile: async () => {},
          loadURL: async () => {},
          show: () => {},
          maximize: () => {},
          unmaximize: () => {},
          minimize: () => {},
          close: () => {},
          isDestroyed: () => false,
          isMaximized: () => false,
          webContents: { send: () => {}, on: () => {}, setWindowOpenHandler: () => {} },
          once: () => {},
          on: () => {},
        };
      },
      { fromWebContents: () => null, getAllWindows: () => [] }
    ),
    ipcMain: {
      handle: (channel, handler) => {
        ipcCalls.push([channel, handler]);
      },
      on: () => {},
      off: () => {},
      removeHandler: () => {},
    },
    ipcRenderer: {
      invoke: async () => {},
      send: () => {},
      on: () => {},
      removeListener: () => {},
    },
    shell: {
      showItemInFolder: () => {},
      openPath: async () => '',
      writeShortcutLink: () => true,
    },
    session: {
      defaultSession: { webRequest: { onHeadersReceived: () => {} } },
    },
    contextBridge: { exposeInMainWorld: () => {} },
  };
  return stub;
}

// Idempotent: always returns the SAME exports object that native
// `require('electron')` resolves to in this test file's worker.
function seedNativeElectron() {
  const { createRequire } = require('module');
  const rq = createRequire(__filename);
  const electronPath = rq.resolve('electron');
  const cached = rq.cache[electronPath];
  if (cached && cached.exports && cached.exports[STUB_MARK]) {
    return cached.exports;
  }
  const stub = buildStub();
  rq.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: stub,
  };
  return stub;
}

function getElectronStub() {
  return seedNativeElectron();
}

// Restores dialog defaults + drops recorded ipc handlers. Call in beforeEach.
function resetElectronStub() {
  const stub = seedNativeElectron();
  stub.dialog = defaultDialog();
  stub.__ipcCalls.length = 0;
  stub.BrowserWindow.fromWebContents = () => null;
  stub.shell = {
    showItemInFolder: () => {},
    openPath: async () => '',
    writeShortcutLink: () => true,
  };
  stub.app.relaunch = () => {};
  stub.app.exit = () => {};
  stub.app.quit = () => {};
  stub.app.on = () => {};
  stub.app.off = () => {};
  stub.app.once = () => {};
  delete globalThis.__electronStub;
}

// Generic native stub for any module required via CJS from main-process
// sources (project-relative like '../services/lanServer', or bare builtins
// like 'child_process' - verified per-module by the tests that use it).
function seedNativeStub(relPath, mark, makeExports) {
  const rq = nativeRequireForHere();
  const resolved = rq.resolve(relPath);
  // Relative project files resolve extensionless; bare/builtin ids stay bare.
  const cacheKey = relPath.startsWith('.') && !resolved.endsWith('.js')
    ? `${resolved}.js`
    : resolved;
  const existing = rq.cache[cacheKey];
  if (existing && existing.exports && existing.exports[mark]) {
    return existing.exports;
  }
  const stub = makeExports();
  stub[mark] = true;
  rq.cache[cacheKey] = { id: cacheKey, filename: cacheKey, loaded: true, exports: stub };
  return stub;
}

function createIsolatedPaths(prefix = 'tecton-main-test-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const paths = {
    root,
    userData: path.join(root, 'userData'),
    documents: path.join(root, 'Documents'),
    desktop: path.join(root, 'Desktop'),
    home: root,
    temp: path.join(root, 'Temp'),
  };
  for (const p of Object.values(paths)) {
    fs.mkdirSync(p, { recursive: true });
  }
  return paths;
}

function installPathMap(paths) {
  globalThis.__tectonTestPaths = {
    root: paths.root,
    userData: paths.userData,
    documents: paths.documents,
    desktop: paths.desktop,
    home: paths.home || paths.root,
    temp: paths.temp || paths.root,
  };
}

function clearPathMap() {
  delete globalThis.__tectonTestPaths;
}

function resolveTestPath(name) {
  const map = globalThis.__tectonTestPaths || {};
  return map[name] || path.join(os.tmpdir(), `tecton-fallback-${name}`);
}

function destroyPaths(paths) {
  clearPathMap();
  try {
    fs.rmSync(paths.root, { recursive: true, force: true });
  } catch (_) {
    // Windows file-lock race: best-effort cleanup, never fails the test.
  }
}

// Collects DB handles so afterEach can close them before tmp cleanup.
function createDbTracker() {
  const handles = [];
  return {
    track(db) {
      if (db) handles.push(db);
      return db;
    },
    async closeAll() {
      for (const db of handles.splice(0)) {
        try {
          await db.close();
        } catch (_) {
          // Already closed / never opened: ignore.
        }
      }
    },
  };
}

// ---- Native seeds for CJS `require()` inside main-process sources ----
// Same mechanism as electron: project CJS files resolve sibling/parent
// requires natively, bypassing `vi.mock`. Seeded once per test file (the
// native cache survives `vi.resetModules()`); per-test behavior is driven
// through the returned control handles.

function nativeRequireForHere() {
  const { createRequire } = require('module');
  return createRequire(__filename);
}

// Keystore control: `keystoreCtl.impl` decides the key per test.
// Default resolves the fixed test key; tests may reject (keystore down)
// or resolve a different key (rotation/wrong-key scenarios).
const keystoreCtl = { impl: async () => 'test-db-key-123' };

function seedNativeKeystore() {
  const rq = nativeRequireForHere();
  const resolved = rq.resolve('../services/keystore');
  const withExt = resolved.endsWith('.js') ? resolved : `${resolved}.js`;
  const mark = '__tectonKeystoreStub';
  const existing = rq.cache[withExt];
  if (existing && existing.exports && existing.exports[mark]) {
    return { ctl: keystoreCtl, stub: existing.exports };
  }
  const stub = {
    [mark]: true,
    loadOrCreateDbKey: (...args) => keystoreCtl.impl(...args),
    keyFilePath: () => '/mock/.tecton-key',
  };
  rq.cache[withExt] = { id: withExt, filename: withExt, loaded: true, exports: stub };
  return { ctl: keystoreCtl, stub };
}

// Logger control: capturing arrays, reset per test via `loggerCtl.reset()`.
const loggerStore = { info: [], warn: [], error: [] };
const loggerCtl = {
  logs: loggerStore,
  reset() {
    loggerStore.info.length = 0;
    loggerStore.warn.length = 0;
    loggerStore.error.length = 0;
  },
};

function seedNativeLogger() {
  const rq = nativeRequireForHere();
  const resolved = rq.resolve('../logger');
  const withExt = resolved.endsWith('.js') ? resolved : `${resolved}.js`;
  const mark = '__tectonLoggerStub';
  const existing = rq.cache[withExt];
  if (existing && existing.exports && existing.exports[mark]) {
    return loggerCtl;
  }
  const stub = {
    [mark]: true,
    info: (...args) => {
      loggerStore.info.push(args);
    },
    warn: (...args) => {
      loggerStore.warn.push(args);
    },
    error: (...args) => {
      loggerStore.error.push(args);
    },
  };
  rq.cache[withExt] = { id: withExt, filename: withExt, loaded: true, exports: stub };
  return loggerCtl;
}

// dbCompat wrapper: delegates to the REAL implementation, with an optional
// one-shot open failure to exercise db.js auto-recovery honestly.
// (`key` pragma is lazy - real corruption surfaces at first read, NOT at
// open - so only a hard open failure reaches the recovery branch.)
const dbCompatCtl = { failOpenOnce: false };

function seedNativeDbCompat() {
  const rq = nativeRequireForHere();
  const resolved = rq.resolve('../database/dbCompat');
  const withExt = resolved.endsWith('.js') ? resolved : `${resolved}.js`;
  const mark = '__tectonDbCompatStub';
  const existing = rq.cache[withExt];
  if (existing && existing.exports && existing.exports[mark]) {
    return dbCompatCtl;
  }
  const real = rq(withExt);
  const stub = {
    [mark]: true,
    wrap: real.wrap,
    isPlaintextHeader: real.isPlaintextHeader,
    verifyDbFile: real.verifyDbFile,
    inspectDbFile: real.inspectDbFile,
    openCompat: (...args) => {
      if (dbCompatCtl.failOpenOnce) {
        dbCompatCtl.failOpenOnce = false;
        throw new Error('file is not a database');
      }
      return real.openCompat(...args);
    },
  };
  rq.cache[withExt] = { id: withExt, filename: withExt, loaded: true, exports: stub };
  return dbCompatCtl;
}

// ipcMain.handle is a capturing stub; this rebuilds { channel: handler }
// (last registration wins, matching repeated setupHandlers() imports).
function getHandledMap() {
  const stub = seedNativeElectron();
  return Object.fromEntries(stub.__ipcCalls);
}

module.exports = {
  createIsolatedPaths,
  installPathMap,
  clearPathMap,
  resolveTestPath,
  destroyPaths,
  createDbTracker,
  getHandledMap,
  seedNativeElectron,
  getElectronStub,
  resetElectronStub,
  seedNativeStub,
  seedNativeKeystore,
  seedNativeLogger,
  seedNativeDbCompat,
};
