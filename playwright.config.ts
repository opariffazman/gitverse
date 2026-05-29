import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e config.
 *
 * The app is served by Vite under the `/gitverse/` base path (see vite.config.ts),
 * so `baseURL` includes that path and specs navigate with a relative URL
 * (`page.goto('./')`) which resolves to the base path rather than the origin root.
 *
 * `webServer` boots the Vite dev server and tears it down when the run ends;
 * `reuseExistingServer` lets a manually-running `npm run dev` be reused locally.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173/gitverse/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/gitverse/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
