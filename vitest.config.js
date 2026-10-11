import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/main/services/**/*.test.js', 'src/renderer/src/utils/*.test.js', 'src/renderer/src/components/**/*.test.jsx'],
    setupFiles: ['src/renderer/src/testSetup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['**/*.test.*', '**/locales/**', 'src/main/splash.html'],
      thresholds: { lines: 50, functions: 50, branches: 45 },
    },
  },
});
