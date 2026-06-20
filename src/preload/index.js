const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    appReady: () => ipcRenderer.send('window:app-ready')
  },
  // Generic DB Operations (Zero-Code Change Architecture)
  db: {
    read: (table, conditions = {}) => ipcRenderer.invoke('db:read', { table, conditions }),
    create: (table, data) => ipcRenderer.invoke('db:create', { table, data }),
    createBulk: (table, dataList, logMessage) => ipcRenderer.invoke('db:create-bulk', { table, dataList, logMessage }),
    update: (table, id, data) => ipcRenderer.invoke('db:update', { table, id, data }),
    delete: (table, id) => ipcRenderer.invoke('db:delete', { table, id }),
    transactionDelete: (id) => ipcRenderer.invoke('db:transaction:delete', { id }),
    readDeleted: () => ipcRenderer.invoke('db:read-deleted'),
    restoreRecord: (table, id) => ipcRenderer.invoke('db:restore', { table, id }),
    readAllProjects: () => ipcRenderer.invoke('db:read-all-projects')
  },
  finance: {
    getBalance: (worker_id) => ipcRenderer.invoke('finance:get-balance', { worker_id }),
    calculateWage: (params) => ipcRenderer.invoke('finance:calculate-wage', params),
    deleteTransaction: (id) => ipcRenderer.invoke('finance:delete-transaction', { id }),
    createAdvance: (data) => ipcRenderer.invoke('finance:create-advance', { data }),
    workerReport: (worker_id, year, month) => ipcRenderer.invoke('finance:worker-report', { worker_id, year, month }),
    workerStatement: (params) => ipcRenderer.invoke('finance:worker-statement', params),
    companyReport: (year, month, projectId) => ipcRenderer.invoke('finance:company-report', { year, month, projectId }),
    groupStatement: (params) => ipcRenderer.invoke('finance:group-statement', params)
  },
  system: {
    backupDB: () => ipcRenderer.invoke('system:backup-db'),
    readLogs: (startDate, endDate) => ipcRenderer.invoke('system:read-logs', { startDate, endDate }),
    vacuumDB: () => ipcRenderer.invoke('system:vacuum-db'),
    setCloudFolder: () => ipcRenderer.invoke('system:set-cloud-folder'),
    getWeather: (params) => ipcRenderer.invoke('system:get-weather', params),
    startLANServer: (params) => ipcRenderer.invoke('system:start-lan-server', params),
    stopLANServer: () => ipcRenderer.invoke('system:stop-lan-server'),
    restoreDBFile: (params) => ipcRenderer.invoke('system:restore-db-file', params),
    openOldBackupsFolder: () => ipcRenderer.invoke('system:open-old-backups-folder'),
    openLogsFolder: () => ipcRenderer.invoke('system:open-logs-folder'),
    changeDesktopIcon: (params) => ipcRenderer.invoke('system:change-desktop-icon', params),
    onPhotoUploaded: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('lan:photo-uploaded', subscription);
      return () => {
        ipcRenderer.removeListener('lan:photo-uploaded', subscription);
      };
    },
    onShutdownStarting: (callback) => {
      const subscription = () => callback();
      ipcRenderer.on('system:shutdown-starting', subscription);
      return () => {
        ipcRenderer.removeListener('system:shutdown-starting', subscription);
      };
    }
  },
  media: {
    selectPhoto: () => ipcRenderer.invoke('media:select-photo'),
    savePhoto: (params) => ipcRenderer.invoke('media:save-photo', params),
    savePhotoBase64: (params) => ipcRenderer.invoke('media:save-photo-base64', params),
    readPhoto: (params) => ipcRenderer.invoke('media:read-photo', params)
  }
});
