import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  HISTORY_LIMIT,
  buildSnapshot,
  createSyncQueue,
  detectProviders,
  inspectFolder,
  isMeaningfulSnapshot,
  listDailyBackups,
  readSnapshot,
  writeSnapshot,
} from './cloudSync';

let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tecton-cloud-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const snapshotWith = (records = 1, settings = 1) =>
  buildSnapshot({
    settings: Object.fromEntries(Array.from({ length: settings }, (_, i) => [`key_${i}`, 'value'])),
    data: { workers: Array.from({ length: records }, (_, i) => ({ id: i + 1 })) },
  });

describe('cloudSync.detectProviders', () => {
  it('prefers OneDriveConsumer over the generic OneDrive variable', () => {
    const env = {
      OneDriveConsumer: path.join(dir, 'consumer'),
      OneDrive: path.join(dir, 'generic'),
    };
    fs.mkdirSync(env.OneDriveConsumer, { recursive: true });
    fs.mkdirSync(env.OneDrive, { recursive: true });

    const found = detectProviders({ env, home: dir });
    const oneDrive = found.find((provider) => provider.id === 'onedrive');
    expect(oneDrive.root).toBe(path.resolve(env.OneDriveConsumer));
  });

  it('falls back through the env order and reports no provider when nothing exists', () => {
    expect(detectProviders({ env: {}, home: path.join(dir, 'nowhere') })).toEqual([]);
  });

  it('resolves a Google Drive account into its My Drive folder', () => {
    const root = path.join(dir, 'Google Drive');
    fs.mkdirSync(path.join(root, 'My Drive'), { recursive: true });
    const found = detectProviders({ env: { GoogleDrive: root }, home: dir });
    const drive = found.find((provider) => provider.id === 'googledrive');
    expect(drive.root).toBe(path.resolve(root, 'My Drive'));
    expect(drive.folder.endsWith('Tecton')).toBe(true);
  });
});

describe('cloudSync.writeSnapshot', () => {
  it('writes the snapshot, keeps a previous copy, and creates a daily backup', () => {
    const first = writeSnapshot(dir, snapshotWith(1));
    expect(first.ok).toBe(true);

    const second = writeSnapshot(dir, snapshotWith(3));
    expect(second.ok).toBe(true);
    expect(fs.existsSync(path.join(dir, 'tecton-sync.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'tecton-sync-previous.json'))).toBe(true);
    expect(listDailyBackups(dir)).toHaveLength(1);
  });

  it('refuses to overwrite a populated remote snapshot with an empty local one', () => {
    writeSnapshot(dir, snapshotWith(5));
    const empty = buildSnapshot({ settings: {}, data: {} });
    const result = writeSnapshot(dir, empty);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('refused_empty_overwrite');
    expect(readSnapshot(dir).data.data.workers).toHaveLength(5);
  });

  it('allows an explicit empty overwrite when the caller asks for it', () => {
    writeSnapshot(dir, snapshotWith(5));
    const empty = buildSnapshot({ settings: {}, data: {} });
    const result = writeSnapshot(dir, empty, { allowEmptyOverwrite: true });
    expect(result.ok).toBe(true);
  });

  it(`rotates the daily history down to ${HISTORY_LIMIT} entries`, () => {
    for (let day = 0; day < HISTORY_LIMIT + 5; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + day));
      writeSnapshot(dir, snapshotWith(day + 1), { now: date });
    }
    const backups = listDailyBackups(dir);
    expect(backups).toHaveLength(HISTORY_LIMIT);
    // Newest first; the five oldest dates are the ones removed.
    expect(backups[0].date).toBe('2026-01-20');
    expect(backups[backups.length - 1].date).toBe('2026-01-06');
  });
});

describe('cloudSync.readSnapshot recovery chain', () => {
  it('falls back to previous.json when the current file is corrupt', () => {
    writeSnapshot(dir, snapshotWith(2));
    writeSnapshot(dir, snapshotWith(4));
    fs.writeFileSync(path.join(dir, 'tecton-sync.json'), '{ this is not json');

    const recovered = readSnapshot(dir);
    expect(recovered.ok).toBe(true);
    expect(recovered.source).toBe('previous');
    expect(recovered.data.data.workers).toHaveLength(2);
  });

  it('falls back to the newest daily backup when both current and previous are corrupt', () => {
    writeSnapshot(dir, snapshotWith(2), { now: new Date(Date.UTC(2026, 0, 1)) });
    fs.writeFileSync(path.join(dir, 'tecton-sync.json'), '');
    fs.writeFileSync(path.join(dir, 'tecton-sync-previous.json'), 'garbage');

    const recovered = readSnapshot(dir);
    expect(recovered.ok).toBe(true);
    expect(recovered.source).toBe('daily');
    expect(recovered.date).toBe('2026-01-01');
  });

  it('reports no snapshot for an empty folder', () => {
    expect(readSnapshot(dir).ok).toBe(false);
  });
});

describe('cloudSync.isMeaningfulSnapshot', () => {
  it('treats settings-only and data-only snapshots as meaningful', () => {
    expect(isMeaningfulSnapshot(snapshotWith(0, 3))).toBe(true);
    expect(isMeaningfulSnapshot(snapshotWith(2, 0))).toBe(true);
    expect(isMeaningfulSnapshot(buildSnapshot({}))).toBe(false);
  });
});

describe('cloudSync.inspectFolder', () => {
  it('summarises the folder for the settings card', () => {
    writeSnapshot(dir, snapshotWith(3, 2));
    const state = inspectFolder(dir);
    expect(state.exists).toBe(true);
    expect(state.hasSnapshot).toBe(true);
    expect(state.backupCount).toBe(1);
    expect(state.stats.records).toBe(3);
    expect(state.stats.settings).toBe(2);
  });
});

describe('cloudSync.createSyncQueue', () => {
  it('collapses a burst of writes into one disk write and flushes the last value', async () => {
    const writes = [];
    const queue = createSyncQueue({
      delay: 20,
      write: async (value) => {
        writes.push(value);
        return { ok: true };
      },
    });

    queue.schedule('a');
    queue.schedule('b');
    queue.schedule('c');
    await queue.flush();

    expect(writes).toEqual(['c']);
    expect(queue.pending).toBe(false);
  });
});
