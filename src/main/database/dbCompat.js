const fs = require('fs');

// Async-compatible wrapper over better-sqlite3-multiple-ciphers.
// Preserves the `sqlite` package call-shape used across the codebase:
//   get(sql, params?) -> row|undefined
//   all(sql, params?) -> row[]
//   run(sql, params?) -> { lastID, lastInsertRowid, changes }
//   exec(sql)         -> void (multi-statement OK)
//   close()           -> void

function wrap(native) {
  return {
    _native: native,
    async get(sql, params = []) {
      return native.prepare(sql).get(...params);
    },
    async all(sql, params = []) {
      return native.prepare(sql).all(...params);
    },
    async run(sql, params = []) {
      const info = native.prepare(sql).run(...params);
      return { lastID: info.lastInsertRowid, lastInsertRowid: info.lastInsertRowid, changes: info.changes };
    },
    async exec(sql) {
      return native.exec(sql);
    },
    async close() {
      native.close();
    }
  };
}

function isPlaintextHeader(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    return buf.toString('latin1').startsWith('SQLite format 3');
  } catch (_) {
    return false;
  }
}

// Open (and create-encrypt if needed). Options: { key?: string|null }.
// - missing file      -> create + rekey (if key) else plaintext
// - plaintext file    -> open, rekey in place (if key)
// - encrypted file    -> open with key (throws on wrong key)
function openCompat({ filename, key = null, readonly = false }) {
  const Native = require('better-sqlite3-multiple-ciphers');
  const exists = filename !== ':memory:' && fs.existsSync(filename);
  const native = Native(filename, readonly ? { readonly: true } : {});
  if (filename === ':memory:') {
    return wrap(native);
  }
  if (!exists) {
    if (key) native.pragma(`rekey='${key.replace(/'/g, "''")}'`);
    return wrap(native);
  }
  if (isPlaintextHeader(filename)) {
    if (key) native.pragma(`rekey='${key.replace(/'/g, "''")}'`);
    return wrap(native);
  }
  if (key) native.pragma(`key='${key.replace(/'/g, "''")}'`);
  return wrap(native);
}

// Inspect a candidate DB file WITHOUT touching the live DB.
// Tries key-first, then plaintext. `ok` is true only if integrity_check passes;
// `projects` is how many rows the projects table holds (-1 when unreadable), so
// a caller can tell a real backup from an empty database that was written after
// a failed recovery.
function inspectDbFile(filePath, key = null) {
  const Native = require('better-sqlite3-multiple-ciphers');
  const attempts = [];
  if (key) attempts.push(`key='${key.replace(/'/g, "''")}'`);
  attempts.push(null); // plaintext fallback (legacy backups)
  for (const pragma of attempts) {
    let native = null;
    try {
      native = Native(filePath, { readonly: true });
      if (pragma) native.pragma(pragma);
      const row = native.prepare('PRAGMA integrity_check').get();
      if (!row || row.integrity_check !== 'ok') {
        native.close();
        continue;
      }
      let projects = 0;
      try {
        projects = native.prepare('SELECT count(*) AS c FROM projects').get().c;
      } catch (_) {
        // Older schema without a projects table: nothing to weigh.
        projects = 0;
      }
      native.close();
      return { ok: true, projects };
    } catch (_) {
      try { if (native) native.close(); } catch (_) { /* ignore */ }
    }
  }
  return { ok: false, projects: -1 };
}

function verifyDbFile(filePath, key = null) {
  return inspectDbFile(filePath, key).ok;
}

module.exports = { openCompat, verifyDbFile, inspectDbFile, isPlaintextHeader, wrap };
