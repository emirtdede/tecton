vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: () => false }, app: { getPath: () => '/mock' } }));
// NOTE: the `vi.mock` above does not intercept CJS `require('electron')`
// (externalized to native Node). The native cache is seeded instead so the
// keychain-availability branches below are genuinely exercised.
const { seedNativeElectron } = require('../test-helpers/electronMock.js');
// Seed BEFORE requiring './secret': it destructures `safeStorage` at load.
seedNativeElectron();

const { getWeatherKey, setWeatherKey, isWeatherKeyConfigured } = require('./secret');

function fakeDb(plainValue) {
  return {
    get: async (sql) => {
      if (sql.includes('weather_api_key_enc')) return undefined;
      if (sql.includes("setting_key = 'weather_api_key'")) {
        return plainValue ? { setting_value: plainValue } : undefined;
      }
      return undefined;
    },
    run: async () => ({})
  };
}

describe('secret (weather key, no keychain)', () => {
  it("returns missing (null) when nothing stored and no fallback", async () => {
    // fakeDb(null) has no plaintext; safeStorage unavailable -> null
    const k = await getWeatherKey(fakeDb(null));
    expect(k).toBeNull();
  });

  it('migrates legacy plaintext once', async () => {
    const runs = [];
    const db = { get: fakeDb('ABC123XYZ').get, run: async (sql) => { runs.push(sql); return {}; } };
    const k = await getWeatherKey(db);
    expect(k).toBe('ABC123XYZ');
    expect(runs.some((s) => s.includes('weather_api_key'))).toBe(true);
  });

  it('rejects invalid keys without touching storage', async () => {
    await expect(setWeatherKey(fakeDb(null), 'short')).rejects.toThrow('invalid_key');
    await expect(setWeatherKey(fakeDb(null), '')).rejects.toThrow('invalid_key');
  });
});

function memDb() {
  const store = new Map();
  return {
    store,
    get: async (sql) => {
      if (sql.includes('weather_api_key_enc')) {
        const v = store.get('weather_api_key_enc');
        return v === undefined ? undefined : { setting_value: v };
      }
      if (sql.includes("setting_key = 'weather_api_key'")) {
        const v = store.get('weather_api_key');
        return v === undefined || v === null ? undefined : { setting_value: v };
      }
      return undefined;
    },
    run: async (sql, params = []) => {
      if (sql.includes('weather_api_key_enc')) {
        store.set('weather_api_key_enc', sql.startsWith('UPDATE') ? params[0] : params[1]);
      } else if (sql.includes("setting_key = 'weather_api_key'")) {
        store.set('weather_api_key', params.length ? params[0] : null);
      } else if (sql.includes('INSERT INTO app_settings')) {
        // setWeatherKey passes the key name as a bound param, not in SQL.
        if (params[0] === 'weather_api_key_enc') store.set('weather_api_key_enc', params[1]);
        if (params[0] === 'weather_api_key') store.set('weather_api_key', params[1]);
      }
      return {};
    },
  };
}

describe('secret (weather key, keychain available)', () => {
  beforeAll(() => {
    const stub = seedNativeElectron();
    stub.safeStorage.isEncryptionAvailable = () => true;
    stub.safeStorage.encryptStringAsync = async (s) => Buffer.from(`enc:${s}`);
    stub.safeStorage.decryptStringAsync = async (buf) => ({
      result: Buffer.from(buf).toString().replace(/^enc:/, ''),
      shouldReEncrypt: false,
    });
  });

  it('stores encrypted (insert then update) and reads back the key', async () => {
    const db = memDb();
    expect(await setWeatherKey(db, 'ABC123XYZ9')).toEqual({ success: true });
    expect(await getWeatherKey(db)).toBe('ABC123XYZ9');
    expect(await isWeatherKeyConfigured(db)).toBe(true);

    expect(await setWeatherKey(db, 'ZZZ999YYY8')).toEqual({ success: true });
    expect(await getWeatherKey(db)).toBe('ZZZ999YYY8');
    expect(db.store.get('weather_api_key')).toBeNull();
  });

  it('falls back to migration when decryption yields nothing', async () => {
    const db = memDb();
    await setWeatherKey(db, 'ABC123XYZ9');
    const stub = seedNativeElectron();
    const orig = stub.safeStorage.decryptStringAsync;
    stub.safeStorage.decryptStringAsync = async () => ({ result: '', shouldReEncrypt: false });
    try {
      expect(await getWeatherKey(db)).toBeNull();
    } finally {
      stub.safeStorage.decryptStringAsync = orig;
    }
  });
});
