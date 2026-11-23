// Unit tests for src/main/utils/archiveUtils.js (backup folder housekeeping).
// Logger is natively seeded to a silent capture.

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  createIsolatedPaths,
  destroyPaths,
  seedNativeLogger,
} from '../test-helpers/electronMock.js';

// Logger seed MUST precede the archiveUtils import (its require('../logger')
// runs at load time); hence the dynamic import below.
seedNativeLogger();
const { processBackupArchiving } = await import('./archiveUtils.js');

let paths;
let root;

beforeEach(() => {
  paths = createIsolatedPaths('tecton-archive-test-');
  root = path.join(paths.root, 'Database-Backups');
  fs.mkdirSync(root, { recursive: true });
});

afterEach(() => {
  destroyPaths(paths);
});

function prevYearMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return { y, m, ym: `${y}-${m}` };
}

describe('processBackupArchiving', () => {
  it('ignores a missing folder without throwing', () => {
    expect(() =>
      processBackupArchiving(path.join(paths.root, 'nope'))
    ).not.toThrow();
  });

  it('migrates legacy root daily files into YYYY/MM (then archives them)', () => {
    const name = 'elektronik-yevmiye-backup-2024-05-11.sqlite';
    fs.writeFileSync(path.join(root, name), 'db');
    processBackupArchiving(root);
    // Verified pipeline: step 1 migrates to 2024/05, step 2 (same run) zips
    // the past month and removes its folder.
    expect(fs.existsSync(path.join(root, '2024', 'elektronik-yevmiye-backup-2024-05.zip'))).toBe(true);
    expect(fs.existsSync(path.join(root, name))).toBe(false);
    expect(fs.existsSync(path.join(root, '2024', '05'))).toBe(false);
  });

  it('migrates legacy root zip archives into the year dir', () => {
    const name = 'elektronik-yevmiye-backup-2023-07.zip';
    fs.writeFileSync(path.join(root, name), 'zip');
    processBackupArchiving(root);
    expect(fs.existsSync(path.join(root, '2023', name))).toBe(true);
  });

  it('zips previous months and keeps the current month intact', () => {
    const { y, m, ym } = prevYearMonth();
    const oldDir = path.join(root, y, m);
    fs.mkdirSync(oldDir, { recursive: true });
    const fname = `elektronik-yevmiye-backup-${ym}-03.sqlite`;
    fs.writeFileSync(path.join(oldDir, fname), 'old-db');
    fs.writeFileSync(path.join(oldDir, 'notes.txt'), 'keep-me-out');

    const now = new Date();
    const cy = String(now.getFullYear());
    const cm = String(now.getMonth() + 1).padStart(2, '0');
    const curDir = path.join(root, cy, cm);
    fs.mkdirSync(curDir, { recursive: true });
    const curName = `elektronik-yevmiye-backup-${cy}-${cm}-01.sqlite`;
    fs.writeFileSync(path.join(curDir, curName), 'current-db');

    processBackupArchiving(root);

    expect(fs.existsSync(path.join(root, y, `elektronik-yevmiye-backup-${ym}.zip`))).toBe(true);
    expect(fs.existsSync(oldDir)).toBe(false);
    expect(fs.existsSync(path.join(curDir, curName))).toBe(true);
  });

  it('removes an emptied year directory', () => {
    // A past month with NO matching backups: no zip is written, the month
    // folder is removed, and the now-empty year folder is removed too.
    const { y, m } = prevYearMonth();
    const oldDir = path.join(root, y, m);
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'notes.txt'), 'x');
    processBackupArchiving(root);
    expect(fs.existsSync(oldDir)).toBe(false);
    expect(fs.existsSync(path.join(root, y))).toBe(false);
  });
});
