import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    // Test files share one database and truncate it between tests, so they must not overlap.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
