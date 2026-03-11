import { defineConfig, devices } from '@playwright/test';

const chromiumArgs = ['--disable-dev-shm-usage'];
if (process.env.CI) {
  chromiumArgs.push('--no-sandbox');
}

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    launchOptions: {
      args: chromiumArgs,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 5173',
    url: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
  },
});
