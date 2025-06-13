import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,  // Reduced from 30s since commands exit quickly now
    hookTimeout: 5000,   // Reduced for faster feedback
    globalSetup: './test/setup.js',
    include: ['test/**/*.test.js'],
    reporters: ['verbose'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    // Retry flaky tests once
    retry: 1
  }
});