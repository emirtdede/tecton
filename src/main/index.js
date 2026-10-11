const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const logger = require('./logger');

// IPC Handlers'ı dahil et
require('./ipcHandlers');

let mainWindow;
let splashWindow;
let splashStartTime = 0;
let isQuitting = false;

function createSplashWindow(theme) {
  splashStartTime = Date.now();
  splashWindow = new BrowserWindow({
    width: 300,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    icon: path.join(__dirname, '../../tecton_assets/tecton_dark.ico'),
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

function createWindow(theme) {
  createSplashWindow(theme);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    show: false,
    icon: path.join(__dirname, '../../tecton_assets/tecton_dark.ico'),
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

  // Security: CSP + navigation lockdown (Electron checklist #7, #13, #14)
  try {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'self'; object-src 'none'"]
        }
      });
    });
  } catch (_) { /* session not ready yet in some flows */ }

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Geliştirme ortamında Vite dev server'a bağlan, üretimde dosyayı yükle
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // Developer tools will not open automatically anymore. Use keyboard shortcuts or menu if needed.
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  let isReadyShown = false;
  const showMainWindow = () => {
    if (isReadyShown) return;
    isReadyShown = true;

    const elapsed = Date.now() - splashStartTime;
    const remainingDelay = Math.max(0, 2500 - elapsed);

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
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

  mainWindow.on('close', async (e) => {
    if (isQuitting) return;
    e.preventDefault();
    
    const shutdownStartTime = Date.now();
    
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system:shutdown-starting');
      }
    } catch (e) {
      logger.error('Failed to send shutdown event to renderer:', e);
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
        await db.run(`VACUUM INTO ?`, [destPath]);
        logger.info('Daily safe backup completed via VACUUM INTO:', destPath);

        const { verifyDbFile } = require('./database/dbCompat');
        const { loadOrCreateDbKey } = require('./services/keystore');
        let backupKey = null;
        try { backupKey = await loadOrCreateDbKey(); } catch (_) { /* plaintext fallback */ }
        const tempDbOk = verifyDbFile(destPath, backupKey);
        const checkResult = tempDbOk ? { integrity_check: 'ok' } : { integrity_check: 'failed' };

        if (checkResult && checkResult.integrity_check === 'ok') {
          logger.info('[Safe Backup] Backup integrity check passed.');
          await db.run("UPDATE app_settings SET setting_value = '1' WHERE setting_key = 'clean_shutdown'");
        } else {
          logger.error('[Safe Backup] Backup integrity check failed:', checkResult);
        }
      }
    } catch (err) {
      logger.error('Backup system error during shutdown:', err);
    }
    
    // Enforce conscious delay of 2.5 seconds (matching startup splash)
    const elapsed = Date.now() - shutdownStartTime;
    const remainingDelay = Math.max(0, 2500 - elapsed);
    if (remainingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
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
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.tecton.app');
  let theme = 'dark';
  try {
    const { getDB } = require('./database/db');
    const db = await getDB();
    const setting = await db.get("SELECT setting_value FROM app_settings WHERE setting_key = 'theme'");
    if (setting && setting.setting_value) {
      theme = setting.setting_value;
    }
  } catch (err) {
    logger.error('Failed to load theme from DB:', err);
  }

  createWindow(theme);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(theme);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
