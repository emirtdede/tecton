import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: [['html', { outputFolder: 'e2e/artifacts/html' }], ['list']],
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'electron', testMatch: /.*\.spec\.js/ }],
});
