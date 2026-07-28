import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  base: './',
  test: {
    exclude: [
      ...configDefaults.exclude,
      'tests/e2e/**',
      'tests/visual/**/*.spec.js',
      'tests/server/server-process.test.js',
    ],
  },
});
