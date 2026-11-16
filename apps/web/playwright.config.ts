import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiDirectory = path.resolve(configDirectory, '../api');
const apiPort = process.env.E2E_API_PORT ?? '4300';
const webPort = process.env.E2E_WEB_PORT ?? '5173';
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://scienpay_app:scienpay_dev_password_change_me@localhost:55432/scienpay_test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run start',
      cwd: apiDirectory,
      url: `http://127.0.0.1:${apiPort}/api/v1/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: apiPort,
        DATABASE_URL: databaseUrl,
        DISABLE_LOGIN_RATE_LIMIT: 'true',
      } as Record<string, string>,
    },
    {
      command: `npm run dev -- --port ${webPort} --strictPort`,
      url: `http://127.0.0.1:${webPort}`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
      } as Record<string, string>,
    },
  ],
});
