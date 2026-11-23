const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { safeStorage, app } = require('electron');
const logger = require('../logger');

// TDE keystore: 32-byte key, base64-encoded, safeStorage-encrypted at rest.
// File: <userData>/.tecton-key (0600 on POSIX). Windows relies on DPAPI.
const KEY_FILE = '.tecton-key';
const KEY_BYTES = 32;
// 32 random bytes always encode to 43 base64 characters plus one pad byte.
const RAW_KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;

function keyFilePath() {
  try {
    return path.join(app.getPath('userData'), KEY_FILE);
  } catch (_) {
    return path.join(__dirname, '..', '..', KEY_FILE);
  }
}

// safeStorage is only usable once the app is ready. Before that
// isEncryptionAvailable() reports false, which used to make the very first
// launch store an unwrapped key: the read path below then failed to decrypt it
// and rotated the key on every start, leaving the encrypted database behind.
async function waitForSafeStorage() {
  if (!app.isReady()) {
    try {
      await app.whenReady();
    } catch (_) { /* app shutting down: fall back to plain storage */ }
  }
}

function isRawKey(text) {
  return RAW_KEY_PATTERN.test(text) && Buffer.from(text, 'base64').length === KEY_BYTES;
}

function storageAvailable() {
  try {
    return app.isReady() && safeStorage.isEncryptionAvailable();
  } catch (_) {
    return false;
  }
}

// Returns the stored key, or null when the file exists but cannot be unlocked.
async function readKeyFile(fp) {
  const text = fs.readFileSync(fp, 'utf8').trim();
  if (!text) return null;

  // Format written when safeStorage was unavailable: the key itself, base64,
  // without the safeStorage wrapper. Still a secret on disk, but readable.
  if (isRawKey(text)) return text;

  // Earlier builds wrote that fallback one step further: base64 of the base64
  // key (60 characters). Accept it so those profiles keep opening.
  const legacy = Buffer.from(text, 'base64');
  if (legacy.length === 44) {
    const inner = legacy.toString('utf8');
    if (isRawKey(inner)) return inner;
  }

  if (!storageAvailable()) return null;
  try {
    if (safeStorage.decryptStringAsync) {
      const { result } = await safeStorage.decryptStringAsync(Buffer.from(text, 'base64'));
      return result || null;
    }
    return safeStorage.decryptString(Buffer.from(text, 'base64')) || null;
  } catch (err) {
    logger.error('Keystore key could not be decrypted:', err.message);
    return null;
  }
}

// A key stored unwrapped (previous builds, or a platform without a keychain)
// is re-wrapped in place while we still have it in memory.
async function upgradeKeyFile(fp, key) {
  if (!storageAvailable()) return;
  try {
    const current = fs.readFileSync(fp, 'utf8').trim();
    const legacy = Buffer.from(current, 'base64').length === 44
      ? Buffer.from(current, 'base64').toString('utf8')
      : null;
    if (current !== key && legacy !== key) return;
    const wrapped = Buffer.from(safeStorage.encryptString(key)).toString('base64');
    const tmp = `${fp}.tmp`;
    fs.writeFileSync(tmp, wrapped, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, fp);
    logger.info('Keystore key upgraded to the safeStorage-wrapped format.');
  } catch (err) {
    logger.warn('Keystore key upgrade skipped:', err.message);
  }
}

async function loadOrCreateDbKey({ dbPath } = {}) {
  const fp = keyFilePath();

  // safeStorage cannot be used (and reports itself unavailable) before the app
  // is ready, and getDB() is called early during startup. Wait first, otherwise
  // an existing wrapped key looks unreadable and gets replaced.
  await waitForSafeStorage();

  if (fs.existsSync(fp)) {
    const existing = await readKeyFile(fp);
    if (existing) {
      await upgradeKeyFile(fp, existing);
      return existing;
    }

    // A key is present but unreadable. Overwriting it would make the already
    // encrypted database permanently inaccessible, so only rotate when there
    // is no database to lose.
    if (dbPath && fs.existsSync(dbPath)) {
      throw new Error('keystore_unlock_failed');
    }
    logger.warn('Keystore key could not be unlocked and no database exists yet; generating a new key.');
  }

  const rawB64 = crypto.randomBytes(KEY_BYTES).toString('base64');
  try {
    if (storageAvailable()) {
      const enc = safeStorage.encryptStringAsync
        ? await safeStorage.encryptStringAsync(rawB64)
        : safeStorage.encryptString(rawB64);
      fs.writeFileSync(fp, Buffer.from(enc).toString('base64'), { encoding: 'utf8', mode: 0o600 });
      try { fs.chmodSync(fp, 0o600); } catch (_) { /* Windows: no-op */ }
    } else {
      // No keychain (e.g. Linux basic_text) or safeStorage unavailable: store
      // with restricted perms + warn. Encryption-at-rest is degraded.
      logger.warn('safeStorage unavailable; database key is stored without OS keychain protection.');
      fs.writeFileSync(fp, rawB64, { encoding: 'utf8', mode: 0o600 });
    }
  } catch (e) {
    throw new Error(`keystore_write_failed:${e.message}`);
  }
  return rawB64;
}

module.exports = { loadOrCreateDbKey, keyFilePath };
