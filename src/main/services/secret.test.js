vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: () => false }, app: { getPath: () => '/mock' } }));

const { getWeatherKey, setWeatherKey } = require('./secret');

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
