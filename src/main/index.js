const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');
const logger = require('./logger');
const platform = require('./services/platform');
const cloudRuntime = require('./services/cloudRuntime');
const updater = require('./services/updater');
const integrationRuntime = require('./services/integrationRuntime');

// Global safety net: without these, a single unhandled rejection inside any
// async IPC handler or background task terminates the main process with no
// trace. We log instead, so the window stays alive and the failure is visible
// in the system logs.
process.on('uncaughtException', (error) => {
  logger.error('[uncaughtException]', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[unhandledRejection]', reason);
});

// IPC Handlers
require('./ipcHandlers');

let mainWindow;
let splashWindow;
let splashStartTime = 0;
let isQuitting = false;
let launchHidden = false;
let currentTheme = 'dark';

// Only one Tecton instance may run: two instances would write the same SQLite
// file and the same cloud snapshot. A second launch focuses the existing window.
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => platform.showWindow());

  app.whenReady().then(bootstrap).catch((error) => {
    logger.error('App ready handler failed:', error);
  });

  app.on('window-all-closed', () => {
    // With "close to tray" the window is hidden, not destroyed, so this only
    // fires on a real quit.
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    platform.destroy();
    // Stop accepting local API calls and cancel pending webhook retries so a
    // quit is not held open by an unreachable endpoint.
    integrationRuntime.shutdown().catch(() => {});
  });
}

// Theme-aware app icon. The badge that contrasts with the surface is the one
// that stays legible: a dark badge on the light taskbar and the light badge on
// the dark one. Same mapping as `splash.html` and `index.css` (`.logo-*`).
function themeIconPath(theme) {
  const iconFile = theme === 'light' ? 'tecton-tray-dark.ico' : 'tecton-tray-light.ico';
  return path.join(__dirname, '../../tecton_assets', iconFile);
}

async function readSetting(key, fallback) {
  try {
    const { getDB } = require('./database/db');
    const db = await getDB();
    const row = await db.get('SELECT setting_value FROM app_settings WHERE setting_key = ?', [key]);
    return row && row.setting_value !== undefined && row.setting_value !== null ? row.setting_value : fallback;
  } catch {
    return fallback;
  }
}

function createSplashWindow(theme) {
  splashStartTime = Date.now();
  splashWindow = new BrowserWindow({
    width: 300,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    icon: themeIconPath(theme),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'), { query: { theme } });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createWindow(theme, { hidden = false } = {}) {
  if (!hidden) createSplashWindow(theme);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    show: false,
    icon: themeIconPath(theme),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  // Content-Security-Policy: the renderer only loads its own bundle. Inline
  // scripts and remote origins are rejected outright, so an injected string
  // cannot execute or exfiltrate through a script tag.
  try {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'self'; object-src 'none'"],
        },
      });
    });
  } catch (error) {
    // Session is not ready in some flows; the window still opens hardened.
    logger.warn('CSP registration skipped:', error && error.message);
  }

  // Security hardening.
  //
  // Without these guards a compromised renderer (for example a stored XSS in a
  // user-supplied field) could navigate the whole app to an attacker-controlled
  // page, or spawn new Electron windows with preload access. Any external URL is
  // rejected and, when it is a real http(s) link, opened in the system browser
  // instead.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch((err) => logger.error('Failed to open external URL:', err));
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devServer = 'http://localhost:5173';
    // In development Vite navigates within its own origin (HMR full reloads).
    if (process.env.NODE_ENV === 'development' && url.startsWith(devServer)) return;

    // Production is a file:// bundle. Allow only files inside the app's own
    // dist directory - a blanket `file://` prefix check also allowed navigating
    // to any local file (e.g. file:///C:/Users/.../secrets.txt).
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'file:') {
        const distDir = path.resolve(__dirname, '../../dist');
        const target = path.resolve(fileURLToPath(parsed));
        const relative = path.relative(distDir, target);
        if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) return;
      }
    } catch (err) {
      // Malformed URL: fall through and block it.
    }

    event.preventDefault();
    logger.warn(`Blocked in-app navigation to: ${url}`);
  });

  // The renderer has no reason to request new windows or embed web content.
  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  // Deny every permission request (camera, microphone, geolocation, notifications,
  // clipboard-read, MIDI, ...). The renderer only uses localStorage and IPC; it
  // never calls getUserMedia/mediaDevices, so anything asking for a permission is
  // either a compromised renderer or a hijacked navigation. Electron defaults to
  // allowing some of these, so leaving them unset is not the safe default.
  try {
    const windowSession = mainWindow.webContents.session;
    if (typeof windowSession?.setPermissionRequestHandler === 'function') {
      windowSession.setPermissionRequestHandler((_wc, _permission, callback) => {
        callback(false);
      });
    }
    if (typeof windowSession?.setPermissionCheckHandler === 'function') {
      windowSession.setPermissionCheckHandler(() => false);
    }
  } catch (error) {
    logger.warn('Permission handler registration skipped:', error && error.message);
  }

  // Gelistirme ortaminda Vite dev server'a baglan, uretimde dosyayi yukle
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  let isReadyShown = false;
  const showMainWindow = () => {
    if (isReadyShown) return;
    isReadyShown = true;

    const elapsed = Date.now() - splashStartTime;
    const remainingDelay = hidden ? 0 : Math.max(0, 2500 - elapsed);

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      if (mainWindow && !mainWindow.isDestroyed() && !hidden) {
        mainWindow.show();
        mainWindow.maximize();
      }
    }, remainingDelay);
  };

  mainWindow.once('ready-to-show', () => {
    // 3 seconds safety fallback in case React app has an error or ready signal is delayed
    setTimeout(showMainWindow, 3000);
  });

  const handleAppReady = () => {
    showMainWindow();
  };

  ipcMain.on('window:app-ready', handleAppReady);

  // `close` is async (it awaits a DB backup before quitting). `isQuitting` is
  // only set at the very end, so a second close request during that window -
  // double-clicking the titlebar X, Alt+F4 twice, or an OS quit event - used to
  // start a *second* concurrent shutdown: two `VACUUM INTO` writes to the same
  // destPath (after one had already unlink()ed it) and a doubled 2.5 s delay.
  // `isShuttingDown` closes that window synchronously, before the first await.
  let isShuttingDown = false;

  mainWindow.on('close', async (e) => {
    // A completed shutdown has already released the window; a later close is
    // the real quit and must not be intercepted.
    if (isQuitting) return;
    if (isShuttingDown) {
      // A shutdown is already in progress: keep blocking the close, the
      // in-flight handler will close the window once it is done.
      e.preventDefault();
      return;
    }

    e.preventDefault();

    // "Close to tray": the window disappears but the app (and its background
    // sync) keeps running. The tray menu is the only way to really quit.
    const closeToTray = (await readSetting('close_to_tray', 'false')) === 'true';
    if (closeToTray) {
      try {
        await cloudRuntime.flush();
      } catch (err) {
        logger.error('Cloud flush on hide failed:', err);
      }
      mainWindow.hide();
      if (typeof platform.refreshTrayMenu === 'function') platform.refreshTrayMenu();
      return;
    }

    isShuttingDown = true;

    const shutdownStartTime = Date.now();

    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system:shutdown-starting');
      }
    } catch (err) {
      logger.error('Failed to send shutdown event to renderer:', err);
    }

    try {
      // Push the last debounced cloud snapshot before the DB is vacuumed.
      await cloudRuntime.flush();
    } catch (err) {
      logger.error('Cloud flush during shutdown failed:', err);
    }

    try {
      const { getDB } = require('./database/db');
      const db = await getDB();
      const setting = await db.get("SELECT setting_value FROM app_settings WHERE setting_key = 'cloud_sync_folder'");

      if (setting && setting.setting_value) {
        const fs = require('fs');
        const backupFolder = path.join(setting.setting_value, 'Database-Backups');

        const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const [year, month] = todayStr.split('-');
        const targetDir = path.join(backupFolder, year, month);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const destPath = path.join(targetDir, `elektronik-yevmiye-backup-${todayStr}.sqlite`);

        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        const escapedPath = destPath.replace(/'/g, "''");
        await db.run(`VACUUM INTO '${escapedPath}'`);
        logger.info('Daily safe backup completed via VACUUM INTO:', destPath);

        // Verify the copy with the same driver and key as the live database.
        // Opening the snapshot with an unrelated plaintext driver reported a
        // false "integrity failed" for every encrypted database.
        const { verifyDbFile } = require('./database/dbCompat');
        const { loadOrCreateDbKey } = require('./services/keystore');
        let backupKey = null;
        try {
          backupKey = await loadOrCreateDbKey();
        } catch {
          // Keystore unavailable: a plaintext copy is still verifiable.
        }
        const backupOk = verifyDbFile(destPath, backupKey);

        if (backupOk) {
          logger.info('[Safe Backup] Backup integrity check passed.');
          await db.run("UPDATE app_settings SET setting_value = '1' WHERE setting_key = 'clean_shutdown'");
        } else {
          logger.error('[Safe Backup] Backup integrity check failed:', destPath);
        }
      }
    } catch (err) {
      logger.error('Backup system error during shutdown:', err);
    }

    // Enforce conscious delay of 2.5 seconds (matching startup splash)
    const elapsed = Date.now() - shutdownStartTime;
    const remainingDelay = Math.max(0, 2500 - elapsed);
    if (remainingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingDelay));
    }

    isQuitting = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    ipcMain.off('window:app-ready', handleAppReady);
  });

  return mainWindow;
}

async function bootstrap() {
  app.setAppUserModelId('com.tecton.app');

  const theme = await readSetting('theme', 'dark');
  currentTheme = theme === 'light' ? 'light' : 'dark';
  const surface = currentTheme;

  platform.configure({
    database: () => require('./database/db').getDB(),
    window: () => mainWindow,
    onQuit: () => {
      isQuitting = true;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
      else app.quit();
    },
  });

  cloudRuntime.configure({ database: () => require('./database/db').getDB() });

  // Starts the loopback API (MCP/CLI/webhooks) unless the user disabled it.
  // Failure here is logged, never fatal: the desktop app must open regardless.
  integrationRuntime.init().catch((error) => {
    logger.error('Integration runtime failed to start:', error);
  });

  updater.init();

  try {
    platform.setSurface(surface);
    platform.setJumpList();
    platform.registerHotkey();
    launchHidden = await platform.applyStartupLaunchState();
    await platform.createTray();
  } catch (error) {
    logger.error('Platform integration failed:', error);
  }

  createWindow(theme, { hidden: launchHidden });
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Recreate immediately: macOS expects the window to exist by the time the
    // activation event returns. The theme is cached from bootstrap, so no async
    // setting read is needed.
    createWindow(currentTheme, { hidden: false });
  } else {
    platform.showWindow();
  }
});

module.exports = { themeIconPath };
