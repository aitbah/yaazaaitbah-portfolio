import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive the whole stack, so they expect it to be running:
 *
 *   docker compose up -d
 *   npx playwright test
 *
 * They are not part of `npm test`, which must stay runnable without Docker.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  // A failing flow should say so once, not be retried into a green run.
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
});
