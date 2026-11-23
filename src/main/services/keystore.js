const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { safeStorage, app } = require('electron');

// TDE keystore: 32-byte key, base64-encoded, safeStorage-encrypted at rest.
// File: <userData>/.tecton-key (0600 on POSIX). Windows relies on DPAPI.
const KEY_FILE = '.tecton-key';

function keyFilePath() {
  try {
    return path.join(app.getPath('userData'), KEY_FILE);
  } catch (_) {
    return path.join(__dirname, '..', '..', KEY_FILE);
  }
}

async function loadOrCreateDbKey() {
  const fp = keyFilePath();
  try {
    if (fs.existsSync(fp)) {
      const b64enc = fs.readFileSync(fp, 'utf8').trim();
      const encBuf = Buffer.from(b64enc, 'base64');
      if (safeStorage.decryptStringAsync) {
        const { result } = await safeStorage.decryptStringAsync(encBuf);
        if (result) return result;
      } else {
        try {
          const r = safeStorage.decryptString(encBuf);
          if (r) return r;
        } catch (_) { /* fall through to rotation */ }
      }
    }
  } catch (_) { /* fall through to creation */ }

  // Create + persist
  const rawB64 = crypto.randomBytes(32).toString('base64');
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const enc = safeStorage.encryptStringAsync
        ? await safeStorage.encryptStringAsync(rawB64)
        : safeStorage.encryptString(rawB64);
      fs.writeFileSync(fp, Buffer.from(enc).toString('base64'), { encoding: 'utf8', mode: 0o600 });
      try { fs.chmodSync(fp, 0o600); } catch (_) { /* Windows: no-op */ }
    } else {
      // No keychain (e.g. Linux basic_text): store with restricted perms + warn.
      // Caller MUST surface a warning; encryption-at-rest is degraded.
      fs.writeFileSync(fp, Buffer.from(rawB64, 'utf8').toString('base64'), { encoding: 'utf8', mode: 0o600 });
    }
  } catch (e) {
    throw new Error(`keystore_write_failed:${e.message}`);
  }
  return rawB64;
}

module.exports = { loadOrCreateDbKey, keyFilePath };
