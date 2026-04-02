import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run in Node environment (not jsdom) — all tests are for Node.js services
    environment: 'node',
    // Find tests in src/main (unit) and src/test (integration)
    include: [
      'src/main/**/*.{test,spec}.{ts,js}',
      'src/test/**/*.{test,spec}.{ts,js}',
    ],
    // Longer timeout for integration tests that start real servers
    testTimeout: 10000,
  },
});
