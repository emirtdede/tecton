// Unit tests for src/main/services/keystore.js with a seeded Electron stub.
// safeStorage is controllable per test through the native stub.

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  createIsolatedPaths,
  installPathMap,
  destroyPaths,
  seedNativeElectron,
} from '../test-helpers/electronMock.js';

const stub = seedNativeElectron();
const keystore = await import('./keystore.js');

let paths;

beforeEach(() => {
  paths = createIsolatedPaths('tecton-keystore-test-');
  installPathMap(paths);
  process.env.NODE_ENV = 'test';
  stub.safeStorage.isEncryptionAvailable = () => false;
  stub.safeStorage.isAsyncEncryptionAvailable = async () => false;
});

afterEach(() => {
  destroyPaths(paths);
});

describe('keystore (TDE key lifecycle)', () => {
  it('creates, persists and reloads the same key without a keychain', async () => {
    const k1 = await keystore.loadOrCreateDbKey();
    expect(typeof k1).toBe('string');
    expect(Buffer.from(k1, 'base64').length).toBe(32);

    const keyFile = path.join(paths.userData, '.tecton-key');
    expect(fs.existsSync(keyFile)).toBe(true);

    const k2 = await keystore.loadOrCreateDbKey();
    expect(k2).toBe(k1);
  });

  it('round-trips through safeStorage when a keychain is available', async () => {
    stub.safeStorage.isEncryptionAvailable = () => true;
    stub.safeStorage.isAsyncEncryptionAvailable = async () => true;
    stub.safeStorage.encryptStringAsync = async (s) => Buffer.from(`enc:${s}`);
    stub.safeStorage.decryptStringAsync = async (buf) => ({
      result: String(buf).replace(/^enc:/, ''),
      shouldReEncrypt: false,
    });

    const k1 = await keystore.loadOrCreateDbKey();
    expect(Buffer.from(k1, 'base64').length).toBe(32);
    expect(await keystore.loadOrCreateDbKey()).toBe(k1);
  });

  it('reports keystore_write_failed when the userData dir is missing', async () => {
    globalThis.__tectonTestPaths = {
      ...(globalThis.__tectonTestPaths || {}),
      userData: path.join(paths.root, 'no-such-dir', 'nested'),
    };
    await expect(keystore.loadOrCreateDbKey()).rejects.toThrow(/keystore_write_failed/);
  });

  // Regression: keys written before the app was ready used to be stored
  // unwrapped and were then undecryptable, which rotated the key on every
  // launch and locked the encrypted database.
  it('reads a key stored unwrapped (no safeStorage)', async () => {
    stub.safeStorage.isEncryptionAvailable = () => true;
    const raw = Buffer.alloc(32, 7).toString('base64');
    fs.writeFileSync(path.join(paths.userData, '.tecton-key'), raw);
    await expect(keystore.loadOrCreateDbKey()).resolves.toBe(raw);
  });

  it('reads and upgrades the double-encoded legacy key format', async () => {
    stub.safeStorage.isEncryptionAvailable = () => true;
    const raw = Buffer.alloc(32, 9).toString('base64');
    const legacy = Buffer.from(raw, 'utf8').toString('base64');
    const keyFile = path.join(paths.userData, '.tecton-key');
    fs.writeFileSync(keyFile, legacy);

    await expect(keystore.loadOrCreateDbKey()).resolves.toBe(raw);
    // Re-wrapped in the safeStorage format now that the key is known.
    const stored = fs.readFileSync(keyFile, 'utf8').trim();
    expect(stored).not.toBe(legacy);
    expect(Buffer.from(stored, 'base64').toString('utf8')).toBe(`enc:${raw}`);
  });

  it('refuses to rotate an unreadable key when a database exists', async () => {
    stub.safeStorage.isEncryptionAvailable = () => false;
    const dbPath = path.join(paths.userData, 'elektronik-yevmiye.sqlite');
    fs.writeFileSync(path.join(paths.userData, '.tecton-key'), Buffer.alloc(20, 1).toString('base64'));
    fs.writeFileSync(dbPath, Buffer.from('encrypted-database'));

    await expect(keystore.loadOrCreateDbKey({ dbPath })).rejects.toThrow(/keystore_unlock_failed/);
  });

  it('exposes the key file path inside userData', () => {
    expect(keystore.keyFilePath()).toBe(path.join(paths.userData, '.tecton-key'));
  });
});
