import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/landing',
  use: {
    baseURL: 'http://localhost:4174',
  },
  webServer: {
    command: 'npm run build:landing && npx vite preview --config vite.config.landing.ts --port 4174',
    port: 4174,
    reuseExistingServer: true,
  },
});
