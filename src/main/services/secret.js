const { safeStorage } = require('electron');

// Weather API key storage via OS keychain (DPAPI/Keychain/libsecret).
// Renderer never receives the raw key; only { configured: boolean }.

async function getWeatherKey(db) {
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const enc = await db.get(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'weather_api_key_enc'"
      );
      if (enc && enc.setting_value) {
        const buf = Buffer.from(enc.setting_value, 'base64');
        if (safeStorage.decryptStringAsync) {
          const { result } = await safeStorage.decryptStringAsync(buf);
          if (result) return result;
        } else {
          try {
            return safeStorage.decryptString(buf);
          } catch (_) { /* fall through to migration */ }
        }
      }
    }
  } catch (_) { /* fall through to migration */ }

  // One-time migration: plaintext -> encrypted, then purge plaintext
  try {
    const plain = await db.get(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'weather_api_key'"
    );
    if (plain && plain.setting_value) {
      const key = plain.setting_value;
      try { await setWeatherKey(db, key); } catch (_) { /* store failed, still return */ }
      try {
        await db.run(
          "UPDATE app_settings SET setting_value = NULL WHERE setting_key = 'weather_api_key'"
        );
      } catch (_) { /* ignore purge failure */ }
      try {
        await db.run(
          "INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values) VALUES (?, ?, ?, ?, ?)",
          ['app_settings', 0, 'WEATHER_KEY_MIGRATED', null, JSON.stringify({ purged: true })]
        );
      } catch (_) { /* audit best-effort */ }
      return key;
    }
  } catch (_) { /* ignore */ }
  return null;
}

async function setWeatherKey(db, plainKey) {
  if (!plainKey || typeof plainKey !== 'string' || plainKey.length < 8 || plainKey.length > 128) {
    throw new Error('invalid_key');
  }
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    // No OS keychain: store NOTHING silently is safer than plaintext.
    // Caller surfaces { success:false, errorType:'no_keychain' }.
    throw new Error('no_keychain');
  }
  let buf;
  if (safeStorage.encryptStringAsync) {
    buf = await safeStorage.encryptStringAsync(plainKey);
  } else {
    buf = safeStorage.encryptString(plainKey);
  }
  const b64 = Buffer.from(buf).toString('base64');
  const existing = await db.get(
    "SELECT id FROM app_settings WHERE setting_key = 'weather_api_key_enc'"
  );
  if (existing) {
    await db.run(
      "UPDATE app_settings SET setting_value = ? WHERE setting_key = 'weather_api_key_enc'",
      [b64]
    );
  } else {
    await db.run(
      "INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)",
      ['weather_api_key_enc', b64, 'Weather API key (safeStorage encrypted)']
    );
  }
  // Purge any legacy plaintext
  try {
    await db.run(
      "UPDATE app_settings SET setting_value = NULL WHERE setting_key = 'weather_api_key'"
    );
  } catch (_) { /* ignore */ }
  return { success: true };
}

async function isWeatherKeyConfigured(db) {
  const k = await getWeatherKey(db);
  return !!k;
}

module.exports = { getWeatherKey, setWeatherKey, isWeatherKeyConfigured };
