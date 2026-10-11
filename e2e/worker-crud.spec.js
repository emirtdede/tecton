const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

let app = null;
let window = null;

test.beforeAll(async () => {
  app = await electron.launch({ args: ['.'], env: { ...process.env, NODE_ENV: 'test' } });
  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  // Stub native dialogs so tests never block on OS UI
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: true, filePaths: [] });
    dialog.showSaveDialog = () => Promise.resolve({ canceled: true });
    dialog.showMessageBox = () => Promise.resolve({ response: 1, checkboxChecked: false });
  });
});

test.afterAll(async () => {
  if (app) await app.close();
});

test('worker CRUD round-trip via IPC', async () => {
  const result = await window.evaluate(async () => {
    const created = await window.api.db.create('workers', { full_name: 'E2E Test Iscisi', daily_wage: 1000 });
    if (!created.success) return { step: 'create', created };
    const rows = await window.api.db.read('workers', { full_name: 'E2E Test Iscisi' });
    const id = rows.length > 0 ? rows[0].id : null;
    if (!id) return { step: 'read', rows };
    const updated = await window.api.db.update('workers', id, { daily_wage: 1500 });
    const deleted = await window.api.db.delete('workers', id);
    return { step: 'done', created: created.success, updated: updated.success, deleted: deleted.success };
  });
  expect(result.step).toBe('done');
  expect(result.created).toBe(true);
  expect(result.updated).toBe(true);
  expect(result.deleted).toBe(true);
});

test('forbidden table is rejected (allowlist)', async () => {
  const rows = await window.evaluate(() => window.api.db.read('sqlite_master', {}));
  expect(Array.isArray(rows) ? rows.length : 0).toBe(0);
});
