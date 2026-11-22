/**
 * Cloud sync engine.
 *
 * Serverless by design: it writes a single JSON snapshot into the folder the
 * user already has synced by OneDrive / Google Drive / Dropbox / iCloud /
 * Nextcloud. No OAuth, no API keys, no server to pay for; the provider's own
 * client does the upload.
 *
 * Storage layout inside the chosen root:
 *   tecton-sync.json              current snapshot
 *   tecton-sync-previous.json     the snapshot that was current before the last write
 *   tecton-backup-YYYY-MM-DD.json one rolling daily snapshot, 15 kept
 *
 * Reading is defensive: a truncated or half-written file is skipped and the
 * reader falls back to `previous`, then to the newest valid daily backup. That
 * chain is what makes a killed process or a locked file recoverable.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const SYNC_FILE = 'tecton-sync.json';
const PREVIOUS_FILE = 'tecton-sync-previous.json';
const BACKUP_PREFIX = 'tecton-backup-';
const BACKUP_SUFFIX = '.json';
const HISTORY_LIMIT = 15;
const FORMAT_VERSION = 1;

/**
 * Provider detection. Order matters: OneDrive sets both `OneDrive` and
 * `OneDriveConsumer`, and a commercial account also sets `OneDriveCommercial`.
 */
const PROVIDERS = [
  {
    id: 'onedrive',
    label: 'OneDrive',
    rootNames: ['Tecton'],
    envVars: ['OneDriveConsumer', 'OneDrive', 'OneDriveCommercial'],
    homedir: 'OneDrive',
  },
  {
    id: 'googledrive',
    label: 'Google Drive',
    rootNames: ['My Drive', 'Tecton'],
    envVars: ['GoogleDrive', 'GOOGLE_DRIVE'],
    homedir: path.join('Google Drive', 'My Drive'),
    glob: ['Google Drive'],
  },
  {
    id: 'dropbox',
    label: 'Dropbox',
    rootNames: ['Tecton'],
    envVars: ['Dropbox'],
    homedir: 'Dropbox',
  },
  {
    id: 'icloud',
    label: 'iCloud Drive',
    rootNames: ['Tecton'],
    envVars: ['ICLOUD_DRIVE'],
    homedir: path.join('iCloudDrive', 'Documents'),
  },
  {
    id: 'nextcloud',
    label: 'Nextcloud',
    rootNames: ['Tecton'],
    envVars: ['NEXTCLOUD_DIR'],
    homedir: 'Nextcloud',
  },
];

function isDirectory(candidate) {
  try {
    return Boolean(candidate) && fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Returns every provider whose local sync root exists, newest-first priority
 * following PROVIDERS. Each entry also reports the folder Tecton would use.
 */
function detectProviders({ env = process.env, home = os.homedir(), exists = isDirectory } = {}) {
  const found = [];
  for (const provider of PROVIDERS) {
    let root = null;

    for (const variable of provider.envVars) {
      const value = env[variable];
      if (value && exists(value)) {
        root = value;
        break;
      }
    }

    if (!root) {
      const candidate = path.join(home, provider.homedir);
      if (exists(candidate)) root = candidate;
    }

    if (!root) continue;

    // Google Drive keeps the user's files inside "My Drive"; OneDrive and the
    // others expose the account root directly.
    let base = root;
    if (provider.id === 'googledrive') {
      const myDrive = path.join(root, 'My Drive');
      if (exists(myDrive)) base = myDrive;
      else if (path.basename(root) === 'My Drive') base = root;
    }

    found.push({
      id: provider.id,
      label: provider.label,
      root: base,
      folder: path.join(base, 'Tecton'),
    });
  }
  return found;
}

function safeJsonParse(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function readJsonFile(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size === 0) return null;
    return safeJsonParse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function listDailyBackups(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_SUFFIX))
      .map((name) => ({
        name,
        file: path.join(dir, name),
        date: name.slice(BACKUP_PREFIX.length, -BACKUP_SUFFIX.length),
      }))
      .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

/**
 * Walks the recovery chain and returns the first structurally valid snapshot.
 * `source` tells the caller which file won, so the UI can say "restored from
 * yesterday's backup" instead of pretending nothing happened.
 */
function readSnapshot(dir) {
  const candidates = [
    { source: 'current', file: path.join(dir, SYNC_FILE) },
    { source: 'previous', file: path.join(dir, PREVIOUS_FILE) },
    ...listDailyBackups(dir).map((entry) => ({ source: 'daily', file: entry.file, date: entry.date })),
  ];

  for (const candidate of candidates) {
    const data = readJsonFile(candidate.file);
    if (!data) continue;
    if (!data.settings && !data.data) continue;
    return { ok: true, source: candidate.source, date: candidate.date || null, file: candidate.file, data };
  }
  return { ok: false, source: null, file: null, data: null };
}

/** True when a snapshot carries at least one user setting or one data row. */
function isMeaningfulSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const settings = snapshot.settings && typeof snapshot.settings === 'object' ? snapshot.settings : {};
  const settingCount = Object.keys(settings).length;
  const data = snapshot.data && typeof snapshot.data === 'object' ? snapshot.data : {};
  const dataCount = Object.values(data).reduce(
    (total, rows) => total + (Array.isArray(rows) ? rows.length : 0),
    0
  );
  return settingCount > 0 || dataCount > 0;
}

/**
 * Atomic write with a Windows lock fallback.
 *
 * `rename` is atomic on NTFS, but the sync client may momentarily hold the
 * target open (`EBUSY`/`EPERM`). In that case the payload is copied into place
 * and the temporary file is removed, which is not atomic but is the best
 * available outcome and still leaves a readable file at the destination.
 */
function writeFileAtomic(target, contents) {
  const temp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temp, contents, 'utf8');
  try {
    fs.renameSync(temp, target);
    return { ok: true, strategy: 'rename' };
  } catch (error) {
    if (error.code !== 'EBUSY' && error.code !== 'EPERM' && error.code !== 'EACCES') {
      try {
        fs.unlinkSync(temp);
      } catch {
        /* the temp file is best-effort */
      }
      throw error;
    }
    try {
      fs.copyFileSync(temp, target);
      return { ok: true, strategy: 'copy' };
    } finally {
      try {
        fs.unlinkSync(temp);
      } catch {
        /* ignore */
      }
    }
  }
}

function todayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function pruneBackups(dir, limit = HISTORY_LIMIT) {
  const backups = listDailyBackups(dir);
  const removed = [];
  for (const entry of backups.slice(limit)) {
    try {
      fs.unlinkSync(entry.file);
      removed.push(entry.name);
    } catch {
      /* a locked old backup will be retried on the next sync */
    }
  }
  return removed;
}

/**
 * Builds the snapshot payload. `data` is a table -> rows map produced by the
 * caller; the engine never interprets it, which keeps this module independent
 * of the schema.
 */
function buildSnapshot({ settings = {}, data = {}, appVersion = '1.0.0', provider = 'custom', device = '' } = {}) {
  return {
    app: 'Tecton',
    formatVersion: FORMAT_VERSION,
    provider,
    appVersion,
    device,
    exportedAt: new Date().toISOString(),
    settings,
    data,
  };
}

/**
 * Persists a snapshot, keeping the previous file and one daily backup.
 * Refuses to overwrite a populated remote snapshot with an empty local one.
 */
function writeSnapshot(dir, snapshot, { allowEmptyOverwrite = false, now = new Date() } = {}) {
  if (!isMeaningfulSnapshot(snapshot) && !allowEmptyOverwrite) {
    const existing = readSnapshot(dir);
    if (existing.ok && isMeaningfulSnapshot(existing.data)) {
      return {
        ok: false,
        reason: 'refused_empty_overwrite',
        messageKey: 'cloud.error_empty_overwrite',
      };
    }
  }

  fs.mkdirSync(dir, { recursive: true });

  const current = path.join(dir, SYNC_FILE);
  const previous = path.join(dir, PREVIOUS_FILE);
  const daily = path.join(dir, `${BACKUP_PREFIX}${todayStamp(now)}${BACKUP_SUFFIX}`);
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;

  // Preserve the outgoing file before it is replaced.
  if (fs.existsSync(current)) {
    try {
      const raw = fs.readFileSync(current, 'utf8');
      if (safeJsonParse(raw)) writeFileAtomic(previous, raw);
    } catch {
      /* an unreadable current file is simply replaced */
    }
  }

  const result = writeFileAtomic(current, serialized);

  // The daily backup is a snapshot of the file that is now current, so a day
  // always has exactly one entry regardless of how often the user saves.
  try {
    writeFileAtomic(daily, serialized);
  } catch {
    /* the daily copy is best-effort; the main file already succeeded */
  }

  const removed = pruneBackups(dir);

  return {
    ok: true,
    strategy: result.strategy,
    files: { current, previous, daily },
    removedBackups: removed,
    backupCount: listDailyBackups(dir).length,
    syncedAt: snapshot.exportedAt,
  };
}

/** Lightweight state used by the settings card. */
function inspectFolder(dir) {
  const exists = isDirectory(dir);
  if (!exists) {
    return { exists: false, hasSnapshot: false, backupCount: 0, lastSync: null, source: null, stats: null };
  }
  const current = readJsonFile(path.join(dir, SYNC_FILE));
  const backups = listDailyBackups(dir);
  return {
    exists: true,
    hasSnapshot: Boolean(current),
    backupCount: backups.length,
    lastSync: current && current.exportedAt ? current.exportedAt : null,
    source: current ? 'current' : null,
    stats: current
      ? {
          settings: Object.keys(current.settings || {}).length,
          records: Object.values(current.data || {}).reduce(
            (total, rows) => total + (Array.isArray(rows) ? rows.length : 0),
            0
          ),
        }
      : null,
  };
}

/**
 * Debounced writer. `schedule()` is called on every settings mutation; a burst
 * of writes collapses into one disk write, and `flush()` guarantees the last
 * change is on disk before the process exits.
 */
function createSyncQueue({ delay = 300, write, onError = () => {} } = {}) {
  let timer = null;
  let pending = null;
  let inFlight = null;

  const run = async () => {
    timer = null;
    if (pending === null) return;
    const payload = pending;
    pending = null;
    inFlight = (async () => {
      try {
        return await write(payload);
      } catch (error) {
        onError(error);
        return { ok: false, reason: 'write_failed' };
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };

  return {
    schedule(payload) {
      pending = payload;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
      if (typeof timer.unref === 'function') timer.unref();
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (inFlight) await inFlight;
      if (pending !== null || timer === null) await run();
      return { ok: true };
    },
    get pending() {
      return pending !== null || timer !== null;
    },
  };
}

module.exports = {
  BACKUP_PREFIX,
  BACKUP_SUFFIX,
  FORMAT_VERSION,
  HISTORY_LIMIT,
  SYNC_FILE,
  PREVIOUS_FILE,
  PROVIDERS,
  buildSnapshot,
  createSyncQueue,
  detectProviders,
  inspectFolder,
  isMeaningfulSnapshot,
  listDailyBackups,
  pruneBackups,
  readSnapshot,
  todayStamp,
  writeFileAtomic,
  writeSnapshot,
};
