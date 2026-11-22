import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/main/services/**/*.test.js',
      'src/main/utils/**/*.test.js',
      'src/renderer/src/config/**/*.test.js',
      'src/renderer/src/utils/**/*.test.js',
    ],
  },
});
