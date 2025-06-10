import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    globalSetup: './test/setup.js',
    include: ['test/**/*.test.js'],
    reporters: ['verbose'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});