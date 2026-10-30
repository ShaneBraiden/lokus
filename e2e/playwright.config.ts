import { defineConfig } from '@playwright/test';

/**
 * End-to-end journeys against a throwaway stack: the API on 4001 with a fresh PGlite database (wiped at start,
 * demo accounts seeded) and the Vite client on 5174 proxying to it. On Windows the installed Microsoft Edge is
 * used; elsewhere set PW_CHANNEL or run `npx playwright install chromium`.
 */
const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);

export default defineConfig({
  testDir: '.',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  outputDir: '../test-results',
  use: {
    baseURL: 'http://localhost:5174',
    channel,
    viewport: { width: 1360, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run e2e:server -w @lokus/server',
      cwd: '..',
      url: 'http://localhost:4001/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NODE_ENV: 'development', PGLITE_DIR: '.data/e2e-pglite', SEED_DEMO: 'true', REQUIRE_STAFF_MFA: 'false', APP_URL: 'http://localhost:5174', LOG_LEVEL: 'warn' },
    },
    {
      command: 'npm run e2e:web -w @lokus/client',
      cwd: '..',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { LOKUS_API_PROXY: 'http://localhost:4001' },
    },
  ],
});
