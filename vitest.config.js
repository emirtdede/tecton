import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // jsdom needs a real origin before it exposes localStorage/sessionStorage;
    // the default opaque about:blank origin leaves them undefined.
    environmentOptions: { jsdom: { url: 'http://localhost:5173/' } },
    include: [
      'src/main/**/*.test.js',
      'src/main/services/**/*.test.js',
      'src/main/utils/**/*.test.js',
      'src/preload/**/*.test.js',
      'src/renderer/src/config/**/*.test.js',
      'src/renderer/src/utils/**/*.test.js',
      'src/renderer/src/components/**/*.test.jsx',
      'src/renderer/src/*.test.jsx',
    ],
    setupFiles: ['src/renderer/src/testSetup.js'],
    // Each jsdom suite costs a few hundred MB. On a many-core machine the
    // default fork pool (cores - 1) spawns enough of them in parallel to hit
    // the OS memory limit, which surfaces as an unrelated "worker exited
    // unexpectedly" failure. Cap the pool so a full run is deterministic.
    poolOptions: {
      forks: { minForks: 1, maxForks: 4 },
    },
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
