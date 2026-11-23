const fs = require('fs');
const path = require('path');
const os = require('os');
const { openCompat, verifyDbFile, isPlaintextHeader } = require('../database/dbCompat');

function tmp(name) {
  const p = path.join(os.tmpdir(), name);
  try { fs.unlinkSync(p); } catch (_) {}
  return p;
}

describe('dbCompat (encrypted sqlite)', () => {
  it('creates encrypted DBs whose header is not plaintext', () => {
    const p = tmp('tecton_t_enc1.sqlite');
    const db = openCompat({ filename: p, key: 'k1' });
    expect(isPlaintextHeader(p)).toBe(false);
    return db.close().then(() => fs.unlinkSync(p));
  });

  it('round-trips data with the right key and blocks the wrong key', async () => {
    const p = tmp('tecton_t_enc2.sqlite');
    const db = openCompat({ filename: p, key: 'correct' });
    await db.exec('CREATE TABLE t(a TEXT)');
    await db.run('INSERT INTO t(a) VALUES (?)', ['hi']);
    await db.close();

    const good = openCompat({ filename: p, key: 'correct' });
    expect(await good.all('SELECT * FROM t')).toEqual([{ a: 'hi' }]);
    await good.close();

    expect(() => {
      const bad = openCompat({ filename: p, key: 'wrong' });
      try {
        bad._native.prepare('SELECT * FROM t').all();
      } finally {
        try { bad._native.close(); } catch (_) { /* ignore */ }
      }
    }).toThrow();
    fs.unlinkSync(p);
  });

  it('maps lastID/lastInsertRowid like the old driver', async () => {
    const db = openCompat({ filename: ':memory:' });
    await db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY AUTOINCREMENT, a TEXT)');
    const r = await db.run('INSERT INTO t(a) VALUES (?)', ['x']);
    expect(r.lastID).toBe(1);
    expect(r.lastInsertRowid).toBe(1);
    expect(r.changes).toBe(1);
  });

  it('transparently encrypts a legacy plaintext DB (first-open migration)', async () => {
    const p = tmp('tecton_t_enc4.sqlite');
    // legacy plaintext seed (as db.js would find it)
    const Native = require('better-sqlite3-multiple-ciphers');
    const seed = Native(p);
    seed.exec('CREATE TABLE workers(id INTEGER PRIMARY KEY, full_name TEXT)');
    seed.prepare('INSERT INTO workers(full_name) VALUES (?)').run('Ali');
    seed.prepare('INSERT INTO workers(full_name) VALUES (?)').run('Veli');
    seed.close();
    expect(isPlaintextHeader(p)).toBe(true);

    // db.js migration path: openCompat with key
    const db = openCompat({ filename: p, key: 'prod-key' });
    expect(isPlaintextHeader(p)).toBe(false);
    expect(await db.all('SELECT full_name FROM workers ORDER BY id')).toEqual([
      { full_name: 'Ali' },
      { full_name: 'Veli' },
    ]);
    await db.close();
    expect(verifyDbFile(p, 'prod-key')).toBe(true);
    fs.unlinkSync(p);
  });

  it('verifyDbFile accepts valid and rejects garbage', async () => {    const p = tmp('tecton_t_enc3.sqlite');
    const db = openCompat({ filename: p, key: 'k' });
    await db.exec('CREATE TABLE t(a TEXT)');
    await db.close();
    expect(verifyDbFile(p, 'k')).toBe(true);
    expect(verifyDbFile(p, 'nope')).toBe(false);
    fs.writeFileSync(p, 'garbage-not-sqlite');
    expect(verifyDbFile(p, 'k')).toBe(false);
    fs.unlinkSync(p);
  });
});
