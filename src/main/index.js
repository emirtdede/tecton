const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// IPC Handlers'ı dahil et
require('./ipcHandlers');

let mainWindow;
let splashWindow;
let splashStartTime = 0;

function createSplashWindow(theme) {
  splashStartTime = Date.now();
  splashWindow = new BrowserWindow({
    width: 300,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
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
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Geliştirme ortamında Vite dev server'a bağlan, üretimde dosyayı yükle
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
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

  mainWindow.on('closed', () => {
    mainWindow = null;
    ipcMain.off('window:app-ready', handleAppReady);
  });
}

app.whenReady().then(async () => {
  let theme = 'dark';
  try {
    const { getDB } = require('./database/db');
    const db = await getDB();
    const setting = await db.get("SELECT setting_value FROM app_settings WHERE setting_key = 'theme'");
    if (setting && setting.setting_value) {
      theme = setting.setting_value;
    }
  } catch (err) {
    console.error('Failed to load theme from DB:', err);
  }

  createWindow(theme);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(theme);
    }
  });
});

function processBackupArchiving(backupFolder) {
  try {
    const fs = require('fs');
    const path = require('path');
    const AdmZip = require('adm-zip');

    if (!fs.existsSync(backupFolder)) return;

    const files = fs.readdirSync(backupFolder);
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentYearMonth = `${currentYear}-${currentMonth}`;

    // 1. Group daily backup files by month for files of PREVIOUS months
    const dailyBackupRegex = /^elektronik-yevmiye-backup-(\d{4}-\d{2})-\d{2}\.sqlite$/;
    const monthlyGroups = {};

    files.forEach(file => {
      const match = file.match(dailyBackupRegex);
      if (match) {
        const fileYearMonth = match[1];
        if (fileYearMonth < currentYearMonth) {
          if (!monthlyGroups[fileYearMonth]) {
            monthlyGroups[fileYearMonth] = [];
          }
          monthlyGroups[fileYearMonth].push(file);
        }
      }
    });

    // Archive each previous month's daily backups
    for (const [yearMonth, fileList] of Object.entries(monthlyGroups)) {
      if (fileList.length === 0) continue;
      
      const zipPath = path.join(backupFolder, `elektronik-yevmiye-backup-${yearMonth}.zip`);
      const zip = new AdmZip();

      fileList.forEach(file => {
        const filePath = path.join(backupFolder, file);
        zip.addLocalFile(filePath);
      });

      zip.writeZip(zipPath);
      console.log(`Archived ${fileList.length} daily backups for ${yearMonth} to ${zipPath}`);

      // Delete original SQLite files
      fileList.forEach(file => {
        try {
          fs.unlinkSync(path.join(backupFolder, file));
        } catch (err) {
          console.error(`Failed to delete daily backup file ${file}:`, err);
        }
      });
    }

    // 2. Organize previous years' ZIP archives into yearly folders
    const zipArchiveRegex = /^elektronik-yevmiye-backup-(\d{4})-\d{2}\.zip$/;
    const updatedFiles = fs.readdirSync(backupFolder);

    updatedFiles.forEach(file => {
      const match = file.match(zipArchiveRegex);
      if (match) {
        const fileYear = parseInt(match[1], 10);
        if (fileYear < currentYear) {
          const yearFolder = path.join(backupFolder, String(fileYear));
          if (!fs.existsSync(yearFolder)) {
            fs.mkdirSync(yearFolder, { recursive: true });
          }
          const srcPath = path.join(backupFolder, file);
          const destPath = path.join(yearFolder, file);
          fs.renameSync(srcPath, destPath);
          console.log(`Moved yearly archive ${file} to ${yearFolder}`);
        }
      }
    });

  } catch (err) {
    console.error('Backup archiving error:', err);
  }
}

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    try {
      const { getDB } = require('./database/db');
      const db = await getDB();
      const setting = await db.get("SELECT setting_value FROM app_settings WHERE setting_key = 'cloud_sync_folder'");
      
      if (setting && setting.setting_value) {
        const fs = require('fs');
        const isDev = process.env.NODE_ENV === 'development';
        const dbPath = isDev 
          ? path.join(__dirname, '../../database.sqlite')
          : path.join(app.getPath('userData'), 'elektronik-yevmiye.sqlite');
          
        const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const destPath = path.join(setting.setting_value, `elektronik-yevmiye-backup-${todayStr}.sqlite`);
        
        fs.copyFileSync(dbPath, destPath);
        console.log('Daily backup completed:', destPath);

        // Process archiving and sorting
        processBackupArchiving(setting.setting_value);
      }
    } catch (err) {
      console.error('Backup system error:', err);
    }
    app.quit();
  }
});
