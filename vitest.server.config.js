import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/server/server-process.test.js'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
