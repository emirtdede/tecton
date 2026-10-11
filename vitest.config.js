import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/main/services/**/*.test.js', 'src/renderer/src/utils/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['**/*.test.*', '**/locales/**', 'src/main/splash.html'],
      thresholds: { lines: 80, functions: 80, branches: 70 },
    },
  },
});
