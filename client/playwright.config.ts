import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.SMART_ERD_E2E_BASE_URL ?? 'http://localhost:3000';
const browserChannel = process.env.SMART_ERD_E2E_BROWSER_CHANNEL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    ...(browserChannel ? { channel: browserChannel } : {}),
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
});
