import { defineConfig, devices } from '@playwright/test';

// Browser tests of the built app (npm run build first). They run in CI on every
// push before the site is deployed, and locally with:
//   npm run build && npm run test:e2e
// On Windows without a downloaded Chromium, use the installed Edge:
//   set PW_CHANNEL=msedge && npm run test:e2e
// BASE_PATH must match the build (CI builds for /<repo>/).
const base = process.env.BASE_PATH ?? '/';
const port = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://localhost:${port}${base}`,
    channel: process.env.PW_CHANNEL || undefined,
    // the service worker would cache between tests; each test starts clean
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
