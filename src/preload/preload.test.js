// Unit tests for src/preload/index.js: the context-bridge surface.
// The preload runs in its own world; here we capture exposeInMainWorld and
// drive every api group against a recording ipcRenderer.

import {
  seedNativeElectron,
} from '../main/test-helpers/electronMock.js';

const stub = seedNativeElectron();

const exposed = {};
const invoked = [];
const listeners = {};

stub.contextBridge.exposeInMainWorld = (key, value) => {
  exposed[key] = value;
};
stub.ipcRenderer.invoke = async (channel, payload) => {
  invoked.push([channel, payload]);
  return { channel };
};
stub.ipcRenderer.send = (...args) => {
  invoked.push(['send', args]);
};
stub.ipcRenderer.on = (channel, fn) => {
  listeners[channel] = fn;
};
stub.ipcRenderer.removeListener = (channel) => {
  delete listeners[channel];
};

await import('./index.js');

beforeEach(() => {
  invoked.length = 0;
});

describe('preload bridge', () => {
  it('exposes window/db/finance/system/media namespaces', () => {
    expect(Object.keys(exposed)).toEqual(['api']);
    expect(Object.keys(exposed.api).sort()).toEqual(['db', 'finance', 'media', 'system', 'window']);
    expect(typeof exposed.api.db.createBulk).toBe('function');
    expect(typeof exposed.api.system.onPhotoUploaded).toBe('function');
    expect(typeof exposed.api.system.onShutdownStarting).toBe('function');
  });

  it('routes window controls through invoke/send', async () => {
    await exposed.api.window.minimize();
    await exposed.api.window.maximize();
    await exposed.api.window.close();
    exposed.api.window.appReady();
    expect(invoked.map(([c]) => c)).toEqual([
      'window:minimize',
      'window:maximize',
      'window:close',
      'send',
    ]);
  });

  it('routes generic DB calls with table payloads', async () => {
    await exposed.api.db.read('workers', { full_name: 'A' });
    await exposed.api.db.create('workers', { full_name: 'A' });
    await exposed.api.db.createBulk('workers', [{ full_name: 'A' }], 'msg');
    await exposed.api.db.update('workers', 1, { full_name: 'B' });
    await exposed.api.db.delete('workers', 1);
    await exposed.api.db.transactionDelete(2);
    await exposed.api.db.readDeleted();
    await exposed.api.db.restoreRecord('workers', 3);
    await exposed.api.db.readAllProjects();
    const channels = invoked.map(([c]) => c);
    expect(channels).toEqual([
      'db:read',
      'db:create',
      'db:create-bulk',
      'db:update',
      'db:delete',
      'db:transaction:delete',
      'db:read-deleted',
      'db:restore',
      'db:read-all-projects',
    ]);
    expect(invoked[0][1]).toEqual({ table: 'workers', conditions: { full_name: 'A' } });
  });

  it('routes finance calls', async () => {
    await exposed.api.finance.getBalance(1);
    await exposed.api.finance.getBalances([1, 2]);
    await exposed.api.finance.calculateWage({ daily_wage: 1 });
    await exposed.api.finance.deleteTransaction(5);
    await exposed.api.finance.createAdvance({ amount: 1 });
    await exposed.api.finance.workerReport(1, 2023, 9);
    await exposed.api.finance.workerStatement({ worker_id: 1 });
    await exposed.api.finance.companyReport(2023, 9, 1);
    await exposed.api.finance.groupStatement({ project_id: 1 });
    expect(invoked.map(([c]) => c)).toEqual([
      'finance:get-balance',
      'finance:get-balances',
      'finance:calculate-wage',
      'finance:delete-transaction',
      'finance:create-advance',
      'finance:worker-report',
      'finance:worker-statement',
      'finance:company-report',
      'finance:group-statement',
    ]);
  });

  it('routes system + media calls and manages subscriptions', async () => {
    await exposed.api.system.backupDB();
    await exposed.api.system.readLogs('2026-01-01', '2026-01-31');
    await exposed.api.system.vacuumDB();
    await exposed.api.system.setCloudFolder();
    await exposed.api.system.getWeather({ location: 'Ankara' });
    await exposed.api.system.setWeatherKey('ABC123XYZ9');
    await exposed.api.system.isWeatherConfigured();
    await exposed.api.system.startLANServer({ projectId: 1 });
    await exposed.api.system.stopLANServer();
    await exposed.api.system.restoreDBFile({ filePath: '/tmp/x' });
    await exposed.api.system.openOldBackupsFolder();
    await exposed.api.system.openLogsFolder();
    await exposed.api.system.changeDesktopIcon({ theme: 'dark' });
    await exposed.api.media.selectPhoto();
    await exposed.api.media.savePhoto({ projectId: 1 });
    await exposed.api.media.savePhotoBase64({ projectId: 1 });
    await exposed.api.media.readPhoto({ relativePath: 'a/b.jpg' });
    const channels = invoked.map(([c]) => c);
    expect(channels).toContain('system:backup-db');
    expect(channels).toContain('system:restore-db-file');
    expect(channels).toContain('media:read-photo');

    const seen = [];
    const offPhoto = exposed.api.system.onPhotoUploaded((d) => seen.push(d));
    listeners['lan:photo-uploaded']({}, { ok: true });
    expect(seen).toEqual([{ ok: true }]);
    offPhoto();
    expect(listeners['lan:photo-uploaded']).toBeUndefined();

    let shutdown = false;
    const offShutdown = exposed.api.system.onShutdownStarting(() => {
      shutdown = true;
    });
    listeners['system:shutdown-starting']();
    expect(shutdown).toBe(true);
    offShutdown();
    expect(listeners['system:shutdown-starting']).toBeUndefined();
  });
});
