import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Pixelator E2E smoke tests.
 *
 * - Chromium only (Pixelator is desktop-only).
 * - Tests run against the production bundle via `npm run preview` on :4173
 *   (not `vite dev`) so deploy-breaking bugs are caught.
 * - Single worker locally because the app's state lives in localStorage;
 *   parallel workers would step on each other through shared storage state
 *   unless we isolate more aggressively, which isn't worth it for 5 tests.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Build + serve the prod bundle. One command keeps the config simple;
    // no extra npm script required.
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
