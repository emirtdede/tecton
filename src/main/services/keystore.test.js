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

  it('exposes the key file path inside userData', () => {
    expect(keystore.keyFilePath()).toBe(path.join(paths.userData, '.tecton-key'));
  });
});
