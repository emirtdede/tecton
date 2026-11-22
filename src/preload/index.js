const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    appReady: () => ipcRenderer.send('window:app-ready'),
    setZoom: (factor) => ipcRenderer.invoke('window:set-zoom', { factor }),
    show: () => ipcRenderer.invoke('platform:show-window')
  },
  cloud: {
    status: () => ipcRenderer.invoke('cloud:status'),
    connect: (params) => ipcRenderer.invoke('cloud:connect', params),
    disconnect: () => ipcRenderer.invoke('cloud:disconnect'),
    syncNow: () => ipcRenderer.invoke('cloud:sync-now'),
    restore: () => ipcRenderer.invoke('cloud:restore'),
    openFolder: () => ipcRenderer.invoke('cloud:open-folder'),
    chooseFolder: () => ipcRenderer.invoke('cloud:choose-folder'),
    setAutoSync: (enabled) => ipcRenderer.invoke('cloud:set-auto-sync', { enabled })
  },
  platform: {
    info: () => ipcRenderer.invoke('platform:info'),
    setStartWithWindows: (enabled) => ipcRenderer.invoke('platform:set-start-with-windows', { enabled }),
    applyIcon: (surface) => ipcRenderer.invoke('platform:apply-icon', { surface }),
    launchRoute: () => ipcRenderer.invoke('platform:launch-route')
  },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    status: () => ipcRenderer.invoke('update:status'),
    onStatus: (callback) => {
      const subscription = (_event, status) => callback(status);
      ipcRenderer.on('update:status', subscription);
      return () => ipcRenderer.removeListener('update:status', subscription);
    }
  },
  integrations: {
    status: () => ipcRenderer.invoke('integrations:status'),
    setEnabled: (enabled) => ipcRenderer.invoke('integrations:set-enabled', { enabled }),
    copyConfig: () => ipcRenderer.invoke('integrations:copy-config'),
    openConfigFolder: () => ipcRenderer.invoke('integrations:open-config-folder'),
    webhooks: {
      list: () => ipcRenderer.invoke('integrations:webhooks:list'),
      save: (payload) => ipcRenderer.invoke('integrations:webhooks:save', payload),
      remove: (id) => ipcRenderer.invoke('integrations:webhooks:delete', { id }),
      test: (id) => ipcRenderer.invoke('integrations:webhooks:test', { id })
    }
  },
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    download: (model) => ipcRenderer.invoke('ai:download', { model }),
    remove: (model) => ipcRenderer.invoke('ai:delete', { model }),
    activate: (model) => ipcRenderer.invoke('ai:activate', { model }),
    deactivate: () => ipcRenderer.invoke('ai:deactivate'),
    ask: (question, locale) => ipcRenderer.invoke('ai:ask', { question, locale }),
    searchDocs: (query, locale, limit) => ipcRenderer.invoke('ai:docs-search', { query, locale, limit }),
    openRuntime: () => ipcRenderer.invoke('ai:open-runtime'),
    onDownloadProgress: (callback) => {
      const subscription = (_event, progress) => callback(progress);
      ipcRenderer.on('ai:download-progress', subscription);
      return () => ipcRenderer.removeListener('ai:download-progress', subscription);
    }
  },
  // Generic DB Operations (Zero-Code Change Architecture)
  db: {
    read: (table, conditions = {}) => ipcRenderer.invoke('db:read', { table, conditions }),
    create: (table, data) => ipcRenderer.invoke('db:create', { table, data }),
    createBulk: (table, dataList, logMessage) => ipcRenderer.invoke('db:create-bulk', { table, dataList, logMessage }),
    update: (table, id, data) => ipcRenderer.invoke('db:update', { table, id, data }),
    delete: (table, id) => ipcRenderer.invoke('db:delete', { table, id }),
    readDeleted: () => ipcRenderer.invoke('db:read-deleted'),
    restoreRecord: (table, id) => ipcRenderer.invoke('db:restore', { table, id }),
    readAllProjects: () => ipcRenderer.invoke('db:read-all-projects')
  },
  finance: {
    getBalance: (worker_id) => ipcRenderer.invoke('finance:get-balance', { worker_id }),
    getBalances: (worker_ids) => ipcRenderer.invoke('finance:get-balances', { worker_ids }),
    calculateWage: (params) => ipcRenderer.invoke('finance:calculate-wage', params),
    deleteTransaction: (id) => ipcRenderer.invoke('finance:delete-transaction', { id }),
    createAdvance: (data) => ipcRenderer.invoke('finance:create-advance', { data }),
    workerStatement: (params) => ipcRenderer.invoke('finance:worker-statement', params),
    companyReport: (year, month, projectId) => ipcRenderer.invoke('finance:company-report', { year, month, projectId }),
    groupStatement: (params) => ipcRenderer.invoke('finance:group-statement', params),
    deleteSubcontractorTransaction: (id) => ipcRenderer.invoke('subcontractor:delete-transaction', { id }),
    createSubcontractorTransaction: (data) => ipcRenderer.invoke('subcontractor:create-transaction', { data })
  },
  system: {
    backupDB: () => ipcRenderer.invoke('system:backup-db'),
    createSnapshot: () => ipcRenderer.invoke('system:create-snapshot'),
    restoreSnapshot: () => ipcRenderer.invoke('system:restore-snapshot'),
    readLogs: (startDate, endDate) => ipcRenderer.invoke('system:read-logs', { startDate, endDate }),
    vacuumDB: () => ipcRenderer.invoke('system:vacuum-db'),
    setCloudFolder: () => ipcRenderer.invoke('system:set-cloud-folder'),
    getWeather: (params) => ipcRenderer.invoke('system:get-weather', params),
    startLANServer: (params) => ipcRenderer.invoke('system:start-lan-server', params),
    stopLANServer: () => ipcRenderer.invoke('system:stop-lan-server'),
    restoreDBFile: (params) => ipcRenderer.invoke('system:restore-db-file', params),
    openOldBackupsFolder: () => ipcRenderer.invoke('system:open-old-backups-folder'),
    openLogsFolder: () => ipcRenderer.invoke('system:open-logs-folder'),
    infoReport: () => ipcRenderer.invoke('system:info-report'),
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
    savePhotoBase64: (params) => ipcRenderer.invoke('media:save-photo-base64', params),
    readPhoto: (params) => ipcRenderer.invoke('media:read-photo', params)
  }
});
