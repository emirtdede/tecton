/**
 * Windows platform integration.
 *
 * Everything OS-facing lives here so the window lifecycle in `index.js` stays
 * readable: system tray, start-with-Windows, the global hotkey, the taskbar Jump
 * List and the app icon that Windows shows on the taskbar and shortcuts.
 */

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { app, Tray, Menu, globalShortcut, nativeImage, shell } = require('electron');
const logger = require('../logger');

const HOTKEY = 'CommandOrControl+Alt+N';

let tray = null;
let getDB = null;
let getMainWindow = null;
let quit = null;
let surface = 'dark';

function configure({ database, window, onQuit }) {
  getDB = database;
  getMainWindow = window;
  quit = onQuit;
}

function assetsDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'tecton_assets')
    : path.join(__dirname, '../../../tecton_assets');
}

function iconPath(kind = surface, ext = 'png') {
  const file = kind === 'light' ? `tecton-tray-dark.${ext}` : `tecton-tray-light.${ext}`;
  return path.join(assetsDir(), file);
}

/**
 * Language picked on the installer's first page.
 *
 * The installer is a per-user NSIS package, so the key lands in the same HKCU
 * hive the app runs under. Missing key (dev run, portable copy) means null and
 * the app falls back to the Windows display language.
 */
function readInstallerLanguage() {
  if (process.platform !== 'win32') return null;
  try {
    const output = execFileSync(
      'reg',
      ['query', 'HKCU\\Software\\Tecton', '/v', 'InstallerLanguage'],
      { encoding: 'utf8', windowsHide: true, timeout: 3000 }
    );
    const match = output.match(/InstallerLanguage\s+REG_SZ\s+([A-Za-z-]+)/i);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}


async function readSetting(key, fallback) {
  try {
    const db = await getDB();
    const row = await db.get('SELECT setting_value FROM app_settings WHERE setting_key = ?', [key]);
    return row && row.setting_value !== undefined && row.setting_value !== null ? row.setting_value : fallback;
  } catch {
    return fallback;
  }
}

async function writeSetting(key, value) {
  try {
    const db = await getDB();
    const row = await db.get('SELECT id FROM app_settings WHERE setting_key = ?', [key]);
    if (row) await db.run('UPDATE app_settings SET setting_value = ? WHERE id = ?', [String(value), row.id]);
  } catch (error) {
    logger.error(`Failed to persist ${key}:`, error);
  }
}

function showWindow() {
  const win = getMainWindow && getMainWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/**
 * Start with Windows.
 *
 * Electron registers this in the user's Run key. `--hidden` (and the persisted
 * `start_minimized`) make it a silent tray start rather than a window popping up
 * during login.
 */
function applyLoginItem(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      openAsHidden: true,
      path: process.execPath,
      args: ['--hidden'],
    });
  } catch (error) {
    logger.error('Failed to set login item:', error);
  }
}

async function syncStartupSettings() {
  const autostart = (await readSetting('autostart', 'false')) === 'true';
  applyLoginItem(autostart);
}

function registerHotkey() {
  try {
    globalShortcut.unregisterAll();
    const registered = globalShortcut.register(HOTKEY, showWindow);
    if (!registered) logger.warn(`Global hotkey ${HOTKEY} could not be registered (already in use).`);
    return registered;
  } catch (error) {
    logger.error('Failed to register global hotkey:', error);
    return false;
  }
}

function setJumpList() {
  if (process.platform !== 'win32') return;
  try {
    app.setJumpList([
      {
        type: 'tasks',
        items: [
          {
            type: 'task',
            title: 'Open Tecton',
            description: 'Open the Tecton dashboard',
            program: process.execPath,
            args: '',
            iconPath: iconPath(surface, 'ico'),
            iconIndex: 0,
          },
          {
            type: 'task',
            title: 'Tecton - Security',
            description: 'Open Tecton security and backups',
            program: process.execPath,
            args: '--route=settings_security',
            iconPath: iconPath(surface, 'ico'),
            iconIndex: 0,
          },
        ],
      },
    ]);
  } catch (error) {
    logger.error('Failed to set jump list:', error);
  }
}

async function refreshTrayMenu() {
  if (!tray) return;
  const autostart = (await readSetting('autostart', 'false')) === 'true';
  const closeToTray = (await readSetting('close_to_tray', 'true')) === 'true';

  const menu = Menu.buildFromTemplate([
    { label: 'Open Tecton', click: showWindow },
    { type: 'separator' },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: autostart,
      click: async (item) => {
        applyLoginItem(item.checked);
        await writeSetting('autostart', item.checked ? 'true' : 'false');
      },
    },
    {
      label: 'Close to tray',
      type: 'checkbox',
      checked: closeToTray,
      click: async (item) => {
        await writeSetting('close_to_tray', item.checked ? 'true' : 'false');
      },
    },
    {
      label: 'Open data folder',
      click: () => shell.openPath(app.getPath('userData')),
    },
    { type: 'separator' },
    { label: 'Quit Tecton', click: () => (quit ? quit() : app.quit()) },
  ]);

  tray.setContextMenu(menu);
}

async function createTray() {
  try {
    const image = nativeImage.createFromPath(iconPath(surface, 'png'));
    tray = new Tray(image.isEmpty() ? iconPath(surface, 'ico') : image);
    tray.setToolTip('Tecton');
    tray.on('click', showWindow);
    tray.on('double-click', showWindow);
    await refreshTrayMenu();
  } catch (error) {
    logger.error('Failed to create tray:', error);
  }
}

/** Recolours the tray icon when the user switches between light and dark. */
function setSurface(nextSurface) {
  surface = nextSurface === 'light' ? 'light' : 'dark';
  if (tray) {
    try {
      const image = nativeImage.createFromPath(iconPath(surface, 'png'));
      if (!image.isEmpty()) tray.setImage(image);
    } catch (error) {
      logger.error('Failed to recolor tray icon:', error);
    }
  }
  setJumpList();
}

async function applyStartupLaunchState() {
  await syncStartupSettings();
  const hiddenArg = process.argv.includes('--hidden');
  const startMinimized = (await readSetting('start_minimized', 'false')) === 'true';
  return hiddenArg || startMinimized;
}

function destroy() {
  try {
    globalShortcut.unregisterAll();
  } catch {
    /* nothing to release */
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = {
  HOTKEY,
  applyLoginItem,
  applyStartupLaunchState,
  configure,
  createTray,
  destroy,
  iconPath,
  readInstallerLanguage,
  refreshTrayMenu,
  registerHotkey,
  setJumpList,
  setSurface,
  showWindow,
  syncStartupSettings,
};
