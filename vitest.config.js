import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/main/**/*.test.js', 'src/preload/**/*.test.js', 'src/renderer/src/utils/*.test.js', 'src/renderer/src/components/**/*.test.jsx', 'src/renderer/src/*.test.jsx'],
    setupFiles: ['src/renderer/src/testSetup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['**/*.test.*', '**/locales/**', 'src/main/splash.html', 'src/main/test-helpers/**'],
      // Ratchet gates (measured 2026-10-11: lines ~55.2 / functions ~35.2 /
      // branches ~39.5 after main-process integration tests). Raise toward
      // 80/80/70 as renderer component suites land (backlog: Settings*,
      // WorkerProfile, CashRegister, App.jsx, import/export utils).
      thresholds: { lines: 50, functions: 34, branches: 38 },
    },
  },
});
