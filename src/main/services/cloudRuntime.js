/**
 * Cloud runtime.
 *
 * Bridges the pure file engine (`cloudSync.js`) to the live SQLite database and
 * the `app_settings` rows. Keeping the file logic pure means it is unit-tested
 * without Electron; this module is the thin I/O layer the IPC handlers call.
 *
 * Serverless by design: the "cloud" is a folder that OneDrive, Google Drive,
 * Dropbox, iCloud Drive or Nextcloud already syncs. No OAuth, no account, no
 * server, no cost.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const cloudSync = require('./cloudSync');
const logger = require('../logger');

// Dependency order for inserts; deletes run in reverse. `app_settings` is stored
// separately as a key/value map so a restore never wipes machine-local settings
// such as the cloud connection itself.
const SYNC_TABLES = [
  'projects',
  'work_types',
  'worker_groups',
  'workers',
  'worker_leaves',
  'timesheets',
  'transactions',
  'cash_register',
  'daily_journals',
  'materials',
  'production_records',
  'quality_reports',
  'subcontractor_ledgers',
  'subcontractor_transactions',
  'recycle_bin',
];

// Keys that describe this machine's cloud connection and must not be copied
// from another device's snapshot.
const MACHINE_SETTING_PREFIXES = ['cloud_'];

let getDB = null;
let queue = null;

function configure({ database }) {
  getDB = database;
}

async function db() {
  if (!getDB) throw new Error('Cloud runtime is not configured');
  return getDB();
}

async function readSettingMap(database) {
  const rows = await database.all('SELECT setting_key, setting_value FROM app_settings');
  return rows.reduce((map, row) => {
    map[row.setting_key] = row.setting_value;
    return map;
  }, {});
}

async function writeSetting(database, key, value) {
  const row = await database.get('SELECT id FROM app_settings WHERE setting_key = ?', [key]);
  if (row) {
    await database.run('UPDATE app_settings SET setting_value = ? WHERE id = ?', [String(value), row.id]);
  } else {
    await database.run(
      'INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
      [key, String(value), 'Cloud sync']
    );
  }
}

function appVersion() {
  try {
    // Lazy require: this module is also loadable from a plain Node context.
    return require('electron').app.getVersion();
  } catch {
    return '1.0.0';
  }
}

async function buildLocalSnapshot(database, provider = 'custom') {
  const settings = await readSettingMap(database);
  for (const key of Object.keys(settings)) {
    if (MACHINE_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix))) delete settings[key];
  }

  const data = {};
  for (const table of SYNC_TABLES) {
    try {
      data[table] = await database.all(`SELECT * FROM ${table}`);
    } catch {
      data[table] = [];
    }
  }

  return cloudSync.buildSnapshot({
    settings,
    data,
    appVersion: appVersion(),
    provider,
    device: os.hostname(),
  });
}

/** True when the local database has no user records yet (fresh install/format). */
async function isLocalEmpty(database) {
  const snapshot = await buildLocalSnapshot(database);
  return !cloudSync.isMeaningfulSnapshot(snapshot);
}

/**
 * Every provider Tecton knows about, with its detection state.
 *
 * `cloudSync.detectProviders()` only returns the providers it found; the
 * settings card needs the full list so a missing OneDrive still appears (greyed
 * out with "Not found") instead of vanishing.
 */
function listProviders() {
  const detected = new Map(cloudSync.detectProviders().map((provider) => [provider.id, provider]));
  return cloudSync.PROVIDERS.map((provider) => {
    const hit = detected.get(provider.id);
    return {
      id: provider.id,
      label: provider.label,
      detected: Boolean(hit),
      path: hit ? hit.folder : null,
    };
  });
}

async function connect(providerId, explicitFolder) {
  const database = await db();
  const providers = listProviders();
  const chosen = providers.find((provider) => provider.id === providerId && provider.detected);

  let folder = explicitFolder;
  if (!folder && chosen) folder = chosen.path;

  if (!folder) {
    // Safe fallback: keep data local and tell the UI where it lives.
    folder = path.join(os.homedir(), 'Tecton');
    try {
      fs.mkdirSync(folder, { recursive: true });
    } catch (error) {
      logger.error('Failed to create fallback cloud folder:', error);
      return { ok: false, reason: 'no_folder', messageKey: 'cloud.safe_fallback' };
    }
  }

  await writeSetting(database, 'cloud_provider', chosen ? chosen.id : 'custom');
  await writeSetting(database, 'cloud_sync_folder', folder);
  await writeSetting(database, 'cloud_auto_sync', 'true');

  const remote = cloudSync.readSnapshot(folder);
  const localEmpty = await isLocalEmpty(database);

  if (localEmpty && remote.ok && cloudSync.isMeaningfulSnapshot(remote.data)) {
    return {
      ok: true,
      folder,
      provider: chosen ? chosen.id : 'custom',
      needsRestore: true,
      restoredFrom: remote.source,
      backupCount: cloudSync.inspectFolder(folder).backupCount,
    };
  }

  const snapshot = await buildLocalSnapshot(database, chosen ? chosen.id : 'custom');
  const result = cloudSync.writeSnapshot(folder, snapshot, { allowEmptyOverwrite: false });
  if (result.ok) {
    await writeSetting(database, 'cloud_last_sync', snapshot.exportedAt);
  }
  return {
    ok: result.ok,
    folder,
    provider: chosen ? chosen.id : 'custom',
    needsRestore: false,
    backupCount: result.backupCount || 0,
    reason: result.reason,
    lastSync: snapshot.exportedAt,
  };
}

async function status() {
  const database = await db();
  const map = await readSettingMap(database);
  const folder = map.cloud_sync_folder || '';
  const provider = map.cloud_provider || 'none';
  const autoSync = map.cloud_auto_sync !== 'false';
  const connected = provider !== 'none' && Boolean(folder) && fs.existsSync(folder);
  const inspection = folder ? cloudSync.inspectFolder(folder) : null;

  return {
    ok: true,
    provider,
    folder,
    connected,
    autoSync,
    lastSync: map.cloud_last_sync || null,
    hasSnapshot: Boolean(inspection && inspection.hasSnapshot),
    backupCount: inspection ? inspection.backupCount : 0,
    stats: inspection ? inspection.stats : null,
    remoteLastSync: inspection ? inspection.lastSync : null,
    providers: listProviders(),
  };
}

async function syncNow() {
  const database = await db();
  const map = await readSettingMap(database);
  const folder = map.cloud_sync_folder;
  if (!folder) return { ok: false, reason: 'no_folder', messageKey: 'cloud.connect_failed' };

  const snapshot = await buildLocalSnapshot(database, map.cloud_provider || 'custom');
  const result = cloudSync.writeSnapshot(folder, snapshot);
  if (result.ok) await writeSetting(database, 'cloud_last_sync', snapshot.exportedAt);
  return {
    ok: result.ok,
    reason: result.reason,
    syncedAt: snapshot.exportedAt,
    backupCount: result.backupCount || 0,
  };
}

async function restore() {
  const database = await db();
  const map = await readSettingMap(database);
  const folder = map.cloud_sync_folder;
  if (!folder) return { ok: false, reason: 'no_folder' };

  const remote = cloudSync.readSnapshot(folder);
  if (!remote.ok || !cloudSync.isMeaningfulSnapshot(remote.data)) {
    return { ok: false, reason: 'no_snapshot' };
  }

  const snapshot = remote.data;
  const data = snapshot.data || {};
  const settings = snapshot.settings || {};

  await database.run('PRAGMA foreign_keys = OFF');
  try {
    await database.run('BEGIN');
    for (const table of [...SYNC_TABLES].reverse()) {
      try {
        await database.run(`DELETE FROM ${table}`);
      } catch {
        /* a table that does not exist yet is skipped */
      }
    }
    for (const table of SYNC_TABLES) {
      const rows = Array.isArray(data[table]) ? data[table] : [];
      for (const row of rows) {
        const keys = Object.keys(row);
        if (!keys.length) continue;
        const placeholders = keys.map(() => '?').join(', ');
        await database.run(
          `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
          keys.map((key) => row[key])
        );
      }
    }
    await database.run('COMMIT');
  } catch (error) {
    try {
      await database.run('ROLLBACK');
    } catch {
      /* already rolled back */
    }
    throw error;
  } finally {
    await database.run('PRAGMA foreign_keys = ON');
  }

  for (const [key, value] of Object.entries(settings)) {
    if (MACHINE_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    await writeSetting(database, key, value);
  }

  await writeSetting(database, 'cloud_last_sync', new Date().toISOString());
  return { ok: true, restoredFrom: remote.source, device: snapshot.device || '', exportedAt: snapshot.exportedAt || '' };
}

async function disconnect() {
  const database = await db();
  await writeSetting(database, 'cloud_provider', 'none');
  await writeSetting(database, 'cloud_auto_sync', 'false');
  return { ok: true };
}

function ensureQueue() {
  if (queue) return queue;
  queue = cloudSync.createSyncQueue({
    delay: 300,
    write: async () => {
      const database = await db();
      const map = await readSettingMap(database);
      if (map.cloud_auto_sync === 'false' || !map.cloud_sync_folder) return { ok: true, skipped: true };
      const snapshot = await buildLocalSnapshot(database, map.cloud_provider || 'custom');
      const result = cloudSync.writeSnapshot(map.cloud_sync_folder, snapshot);
      if (result.ok) await writeSetting(database, 'cloud_last_sync', snapshot.exportedAt);
      return result;
    },
    onError: (error) => logger.error('Background cloud sync failed:', error),
  });
  return queue;
}

/** Debounced background sync. Never throws: a cloud failure must not block UI. */
function scheduleSync() {
  try {
    ensureQueue().schedule({});
  } catch (error) {
    logger.error('Failed to schedule cloud sync:', error);
  }
}

/** Flushes the pending debounce; called from the app close handler. */
async function flush() {
  try {
    if (queue) await queue.flush();
  } catch (error) {
    logger.error('Failed to flush cloud sync:', error);
  }
}

module.exports = {
  SYNC_TABLES,
  configure,
  connect,
  disconnect,
  flush,
  listProviders,
  restore,
  scheduleSync,
  status,
  syncNow,
};
