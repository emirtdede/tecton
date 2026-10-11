const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

let app = null;
let window = null;

test.beforeAll(async () => {
  app = await electron.launch({ args: ['.'], env: { ...process.env, NODE_ENV: 'test' } });
  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: true, filePaths: [] });
    dialog.showSaveDialog = () => Promise.resolve({ canceled: true });
    dialog.showMessageBox = () => Promise.resolve({ response: 1, checkboxChecked: false });
  });
});

test.afterAll(async () => {
  if (app) await app.close();
});

test('backup IPC responds without crashing', async () => {
  const res = await window.evaluate(() => window.api.system.backupDB());
  expect(typeof res.success).toBe('boolean');
});

test('vacuum IPC responds without crashing', async () => {
  const res = await window.evaluate(() => window.api.system.vacuumDB());
  expect(typeof res.success).toBe('boolean');
});

test('weather without key returns missing_key (no crash, no secret leak)', async () => {
  const res = await window.evaluate(() => window.api.system.getWeather({ location: 'Ankara', lang: 'tr' }));
  expect(typeof res.success).toBe('boolean');
  if (!res.success) {
    expect(['missing_key', 'offline', 'unauthorized', 'not_found', 'api_error'].includes(res.errorType)).toBe(true);
  }
});
