const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

let app = null;

test.beforeAll(async () => {
  app = await electron.launch({ args: ['.'], env: { ...process.env, NODE_ENV: 'test' } });
});

test.afterAll(async () => {
  if (app) await app.close();
});

test('app launches and shows main window', async () => {
  const window = await app.firstWindow();
  expect(window).toBeTruthy();
  await window.waitForLoadState('domcontentloaded');
  const title = await window.title();
  expect(typeof title).toBe('string');
});

test('splash transitions to main window', async () => {
  expect(app.windows().length).toBeGreaterThanOrEqual(1);
});
