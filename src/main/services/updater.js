/**
 * Application updater.
 *
 * Uses `electron-updater` against GitHub Releases. npm's `latest.yml` plus the
 * per-block `.blockmap` files give delta downloads; electron-updater verifies
 * the SHA-512 of every downloaded file before it is installed. Installation is
 * silent: the NSIS installer runs with `/S` so the update does not look like a
 * first-time setup.
 *
 * Microsoft Store builds update through the Store, so the updater is disabled
 * when `process.windowsStore` is true.
 */

const { app, BrowserWindow } = require('electron');
const logger = require('../logger');

let autoUpdater = null;
let initialized = false;
let lastStatus = { state: 'idle', version: null, percent: 0, message: null };

function broadcast(patch) {
  lastStatus = { ...lastStatus, ...patch };
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('update:status', lastStatus);
  }
  return lastStatus;
}

function updaterAvailable() {
  return !process.windowsStore && app.isPackaged;
}

/**
 * Why the updater cannot run, or null when it can.
 *
 * A Store build updates through the Store. A development or unpacked build has
 * no `latest.yml` next to it, so it must say so instead of pretending the Store
 * manages it.
 */
function unavailableReason() {
  if (process.windowsStore) return { state: 'disabled', message: 'store' };
  if (!app.isPackaged) return { state: 'unavailable', message: 'development' };
  return null;
}

function loadUpdater() {
  if (autoUpdater) return autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (error) {
    logger.warn('electron-updater is not available:', error.message);
    autoUpdater = null;
  }
  return autoUpdater;
}

function init() {
  if (initialized) return;
  initialized = true;
  const reason = unavailableReason();
  if (reason) {
    broadcast(reason);
    return;
  }

  const updater = loadUpdater();
  if (!updater) {
    broadcast({ state: 'unavailable', message: 'module' });
    return;
  }

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = logger;

  updater.on('checking-for-update', () => broadcast({ state: 'checking', message: null }));
  updater.on('update-available', (info) => {
    broadcast({ state: 'available', version: info && info.version, percent: 0 });
    try {
      require('./integrationRuntime').emitEvent('update.available', { version: info && info.version });
    } catch {
      // Webhooks are optional.
    }
  });
  updater.on('update-not-available', () => broadcast({ state: 'up-to-date', percent: 0 }));
  updater.on('download-progress', (progress) =>
    broadcast({ state: 'downloading', percent: Math.round(progress.percent || 0) })
  );
  updater.on('update-downloaded', (info) =>
    broadcast({ state: 'ready', version: info && info.version, percent: 100 })
  );
  updater.on('error', (error) => {
    logger.error('Updater error:', error);
    broadcast({ state: 'error', message: error && error.message ? error.message : 'update_failed' });
  });

  // Delayed start: let the app finish its own startup before touching the
  // network, and never run in development.
  setTimeout(() => {
    updater.checkForUpdates().catch((error) => logger.warn('Update check failed:', error.message));
  }, 15_000);
}

async function check() {
  const reason = unavailableReason();
  if (reason) return broadcast(reason);
  const updater = loadUpdater();
  if (!updater) return broadcast({ state: 'unavailable', message: 'module' });
  try {
    broadcast({ state: 'checking', message: null });
    const result = await updater.checkForUpdates();
    return { ok: true, result: result ? result.updateInfo : null, status: lastStatus };
  } catch (error) {
    logger.error('Manual update check failed:', error);
    return { ok: false, status: broadcast({ state: 'error', message: error.message }) };
  }
}

function install() {
  const updater = loadUpdater();
  if (!updater) return { ok: false, reason: 'unavailable' };
  // Silent install: no NSIS wizard, no "next next finish".
  setImmediate(() => updater.quitAndInstall(true, true));
  return { ok: true };
}

function getStatus() {
  return lastStatus;
}

module.exports = { check, getStatus, init, install, updaterAvailable, unavailableReason };
