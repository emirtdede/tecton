/**
 * Keeps the encrypted-SQLite native module on the ABI the caller needs.
 *
 * better-sqlite3-multiple-ciphers is a native addon: the same file cannot be
 * loaded by both Node (the test runner) and Electron (the app), because the
 * two runtimes have different NODE_MODULE_VERSION values. Installing one
 * silently breaks the other, which surfaced as
 *
 *   NODE_MODULE_VERSION 121. This version of Node.js requires ...
 *
 * after every packaging run. This script keeps one copy per runtime in
 * node_modules/.cache/tecton-native and swaps the file in place instead of
 * rebuilding every time.
 *
 *   node scripts/nativeBinding.js node
 *   node scripts/nativeBinding.js electron
 *
 * Unknown state is resolved by building the requested flavour, so the switch
 * is always deterministic.
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MODULE = 'better-sqlite3-multiple-ciphers';
const moduleDir = path.join(__dirname, '..', 'node_modules', MODULE);
const releaseDir = path.join(moduleDir, 'build', 'Release');
const binary = path.join(releaseDir, 'better_sqlite3.node');
const cacheDir = path.join(__dirname, '..', 'node_modules', '.cache', 'tecton-native');

function hashOf(file) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
}

function cachePath(flavour) {
  return path.join(cacheDir, `${flavour}.node`);
}

// Which flavour is on disk right now, or null when it is neither (a fresh
// install, or a rebuild we did not perform).
function activeFlavour() {
  const current = hashOf(binary);
  if (!current) return null;
  for (const flavour of ['node', 'electron']) {
    if (hashOf(cachePath(flavour)) === current) return flavour;
  }
  return null;
}

function build(flavour) {
  // npx is a shell script on POSIX and a .cmd shim on Windows; Node refuses to
  // spawn a .cmd without a shell, so run through one.
  const command = flavour === 'node'
    ? 'npx --yes prebuild-install'
    : 'npx electron-builder install-app-deps';
  execSync(command, {
    cwd: flavour === 'node' ? moduleDir : path.join(__dirname, '..'),
    stdio: 'inherit',
  });
}

function install(flavour) {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.copyFileSync(binary, cachePath(flavour));
}

// Windows keeps the previous handle for a moment when a process has just
// exited, so a swap right after a build or a closed app can fail with EBUSY.
function copyWithRetry(from, to) {
  let lastError = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (attempt > 0) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
    try {
      fs.copyFileSync(from, to);
      return;
    } catch (err) {
      lastError = err;
      if (err.code !== 'EBUSY' && err.code !== 'EPERM') throw err;
    }
  }
  throw lastError;
}

function ensure(flavour) {
  if (!fs.existsSync(binary)) {
    // Nothing installed yet: leave it to `npm ci`.
    return;
  }
  if (activeFlavour() === flavour) return;

  const cached = cachePath(flavour);
  if (fs.existsSync(cached)) {
    copyWithRetry(cached, binary);
    return;
  }

  console.log(`[native] building the ${flavour} binding for ${MODULE}`);
  build(flavour);
  install(flavour);
}

if (require.main === module) {
  const [command, value] = process.argv.slice(2);
  // `save <flavour>` records a binary that was just built by an external
  // command (electron-builder, prebuild-install) without rebuilding it again.
  const flavour = command === 'save' ? value : command;
  if (!['node', 'electron'].includes(flavour)) {
    console.error('usage: node scripts/nativeBinding.js <node|electron|save <node|electron>>');
    process.exit(1);
  }
  if (command === 'save') {
    if (fs.existsSync(binary)) install(flavour);
  } else {
    ensure(flavour);
  }
}

module.exports = { ensure, activeFlavour };
