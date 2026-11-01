import { defineConfig, devices } from '@playwright/test';

// Browser E2E for the integrated demo journey (#8).
// Uses the locally installed Google Chrome (channel "chrome"), so no Playwright
// browser download is needed; GitHub's ubuntu runners also ship Chrome.
// Override with PW_CHANNEL=msedge, or PW_CHANNEL= (empty) after
// `npx playwright install chromium` to use the bundled Chromium.
const channel = process.env.PW_CHANNEL ?? 'chrome';
const PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...(channel ? { channel } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) } },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...(channel ? { channel } : {}) }, grep: /@mobile/ },
  ],
  webServer: {
    // Sample mode: VITE_WAYFARE_API_URL is cleared so the E2E never depends on a server or AI key.
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { VITE_WAYFARE_API_URL: '' },
    timeout: 60_000,
  },
});
