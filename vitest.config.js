import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Packaging rebuilds the native SQLite addon for the Electron ABI; tests
    // need the Node one. Swapping happens once, in the main process.
    globalSetup: './scripts/vitestGlobalSetup.js',
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
    // The Windows CI runner can be 30x slower than a dev machine for the
    // encrypted-DB integration tests (native module load + temp file I/O on a
    // scanned volume), where a single test has been seen at 3.5 s. The default
    // 5 s per-test budget produced random failures on an otherwise green tree,
    // so allow a real margin without letting a true hang run forever.
    testTimeout: 20000,
    hookTimeout: 20000,
    // Each jsdom suite costs a few hundred MB. On a many-core machine the
    // default worker pool (cores - 1) spawns enough of them in parallel to hit
    // the OS memory limit, which surfaces as an unrelated "worker exited
    // unexpectedly" failure. Cap the pool so a full run is deterministic.
    maxWorkers: 4,
    minWorkers: 1,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['**/*.test.*', '**/locales/**', 'src/main/splash.html', 'src/main/test-helpers/**'],
      // Ratchet gates, re-measured 2026-11-23 after the main + development
      // merge (46.3 / 29.3 / 32.3 on the combined tree): the renderer now
      // carries the full page set, which pulled the previous main-only
      // 50/34/38 numbers down. Keep these just under the measured values so a
      // regression fails the gate, and raise them as suites are added.
      thresholds: { lines: 45, functions: 28, branches: 31 },
    },
  },
});
