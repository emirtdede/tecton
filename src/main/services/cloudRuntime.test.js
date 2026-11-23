import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import cloudRuntime from './cloudRuntime';
import cloudSync from './cloudSync';

/** Minimal SQLite stand-in covering exactly the statements cloudRuntime emits. */
function createFakeDatabase({ settings = {}, tables = {} } = {}) {
  let nextId = 1;
  const settingRows = Object.entries(settings).map(([key, value]) => ({
    id: nextId++,
    setting_key: key,
    setting_value: String(value),
    description: '',
  }));

  const data = {};
  for (const table of cloudRuntime.SYNC_TABLES) {
    data[table] = (tables[table] || []).map((row) => ({ ...row }));
  }

  const database = {
    settings: settingRows,
    data,
    async all(sql, params = []) {
      if (/FROM\s+app_settings/i.test(sql)) {
        return settingRows.map((row) => ({ setting_key: row.setting_key, setting_value: row.setting_value }));
      }
      const match = sql.match(/FROM\s+(\w+)/i);
      if (match && data[match[1]]) return data[match[1]].map((row) => ({ ...row }));
      return [];
    },
    async get(sql, params = []) {
      if (/FROM\s+app_settings/i.test(sql)) {
        return settingRows.find((row) => row.setting_key === params[0]);
      }
      const match = sql.match(/FROM\s+(\w+)/i);
      if (match && data[match[1]]) return data[match[1]][0];
      return undefined;
    },
    async run(sql, params = []) {
      if (/^\s*(PRAGMA|BEGIN|COMMIT|ROLLBACK)/i.test(sql)) return { changes: 0 };
      if (/UPDATE\s+app_settings/i.test(sql)) {
        const row = settingRows.find((entry) => entry.id === params[1]);
        if (row) row.setting_value = String(params[0]);
        return { changes: row ? 1 : 0 };
      }
      if (/INSERT\s+INTO\s+app_settings/i.test(sql)) {
        settingRows.push({
          id: nextId++,
          setting_key: params[0],
          setting_value: String(params[1]),
          description: params[2] || '',
        });
        return { changes: 1 };
      }
      const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
      if (deleteMatch) {
        if (data[deleteMatch[1]]) data[deleteMatch[1]] = [];
        return { changes: 1 };
      }
      const insertMatch = sql.match(/INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
      if (insertMatch) {
        const table = insertMatch[1];
        const columns = insertMatch[2].split(',').map((column) => column.trim());
        data[table] = data[table] || [];
        const row = {};
        columns.forEach((column, index) => {
          row[column] = params[index];
        });
        data[table].push(row);
        return { changes: 1 };
      }
      return { changes: 0 };
    },
  };

  return database;
}

function settingValue(database, key) {
  const row = database.settings.find((entry) => entry.setting_key === key);
  return row ? row.setting_value : undefined;
}

describe('cloudRuntime', () => {
  const PROVIDER_ENV = [
    'OneDriveConsumer',
    'OneDrive',
    'OneDriveCommercial',
    'GoogleDrive',
    'GOOGLE_DRIVE',
    'Dropbox',
    'ICLOUD_DRIVE',
    'Nextcloud',
  ];

  let sandbox;
  let oneDriveRoot;
  let previousEnv;

  beforeEach(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tecton-cloud-'));
    oneDriveRoot = path.join(sandbox, 'OneDrive');
    fs.mkdirSync(oneDriveRoot, { recursive: true });
    previousEnv = {};
    for (const key of PROVIDER_ENV) previousEnv[key] = process.env[key];
    process.env.OneDriveConsumer = oneDriveRoot;
  });

  afterEach(() => {
    for (const key of PROVIDER_ENV) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  it('lists every known provider with its detection state', () => {
    const database = createFakeDatabase();
    cloudRuntime.configure({ database: () => database });

    const providers = cloudRuntime.listProviders();
    expect(providers.map((provider) => provider.id)).toEqual(
      expect.arrayContaining(['onedrive', 'googledrive', 'dropbox', 'icloud', 'nextcloud'])
    );
    const oneDrive = providers.find((provider) => provider.id === 'onedrive');
    expect(oneDrive.detected).toBe(true);
    expect(oneDrive.path).toBe(path.join(oneDriveRoot, 'Tecton'));
  });

  it('connects to the detected folder and disconnects again', async () => {
    const database = createFakeDatabase({
      settings: { language: 'en' },
      tables: { projects: [{ id: 1, name: 'North Bridge' }] },
    });
    cloudRuntime.configure({ database: () => database });

    const connected = await cloudRuntime.connect('onedrive');
    expect(connected.ok).toBe(true);
    expect(settingValue(database, 'cloud_provider')).toBe('onedrive');
    expect(settingValue(database, 'cloud_sync_folder')).toBe(path.join(oneDriveRoot, 'Tecton'));
    expect(fs.existsSync(path.join(oneDriveRoot, 'Tecton', cloudSync.SYNC_FILE))).toBe(true);

    const status = await cloudRuntime.status();
    expect(status.connected).toBe(true);
    expect(status.provider).toBe('onedrive');

    await cloudRuntime.disconnect();
    const disconnected = await cloudRuntime.status();
    expect(disconnected.connected).toBe(false);
    expect(disconnected.provider).toBe('none');
    expect(disconnected.autoSync).toBe(false);
  });

  it('asks for a restore when the device is empty but the folder is not', async () => {
    const folder = path.join(oneDriveRoot, 'Tecton');
    cloudSync.writeSnapshot(
      folder,
      cloudSync.buildSnapshot({
        settings: { language: 'de' },
        data: { projects: [{ id: 7, name: 'Cloud Site' }] },
        device: 'other-pc',
      })
    );

    const database = createFakeDatabase();
    cloudRuntime.configure({ database: () => database });

    const result = await cloudRuntime.connect('onedrive');
    expect(result.needsRestore).toBe(true);
    expect(result.folder).toBe(folder);

    const restored = await cloudRuntime.restore();
    expect(restored.ok).toBe(true);
    expect(database.data.projects).toHaveLength(1);
    expect(database.data.projects[0].name).toBe('Cloud Site');
    expect(settingValue(database, 'language')).toBe('de');
  });

  it('never overwrites a populated cloud snapshot with an empty device', async () => {
    const folder = path.join(oneDriveRoot, 'Tecton');
    const remote = cloudSync.buildSnapshot({
      settings: { language: 'en' },
      data: { projects: [{ id: 1, name: 'Existing' }] },
    });
    cloudSync.writeSnapshot(folder, remote);

    const database = createFakeDatabase();
    cloudRuntime.configure({ database: () => database });
    await cloudRuntime.connect('onedrive');

    const before = fs.readFileSync(path.join(folder, cloudSync.SYNC_FILE), 'utf8');
    expect(JSON.parse(before).data.projects).toHaveLength(1);

    const sync = await cloudRuntime.syncNow();
    expect(sync.ok).toBe(false);
    expect(sync.reason).toBe('refused_empty_overwrite');

    const after = fs.readFileSync(path.join(folder, cloudSync.SYNC_FILE), 'utf8');
    expect(JSON.parse(after).data.projects).toHaveLength(1);
  });

  it('falls back to a local folder when no provider is detected', async () => {
    fs.rmSync(oneDriveRoot, { recursive: true, force: true });
    for (const key of PROVIDER_ENV) delete process.env[key];
    process.env.HOME = sandbox;
    process.env.USERPROFILE = sandbox;

    const database = createFakeDatabase({
      settings: { language: 'en' },
      tables: { projects: [{ id: 1, name: 'Local only' }] },
    });
    cloudRuntime.configure({ database: () => database });

    const result = await cloudRuntime.connect('onedrive');
    expect(result.ok).toBe(true);
    expect(result.provider).toBe('custom');
    expect(fs.existsSync(path.join(sandbox, 'Tecton', cloudSync.SYNC_FILE))).toBe(true);
  });
});
