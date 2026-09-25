import { defineConfig, devices } from '@playwright/test';
import { PORT } from './e2e/settings.mjs';

// Browser tests. Run `npm run test:e2e` from the top of the project: it builds the screens first,
// because the test server serves client/dist.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // The tests share one database and build on each other's courses, so they run one at a time
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The Chrome already on the machine (and on GitHub's runners), so no browser download is needed
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' }, testMatch: /smoke/ },
  ],
  webServer: {
    command: 'node e2e/start-server.mjs',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
