import { defineConfig, devices } from '@playwright/test';

// Browser E2E for the integrated demo journey (#8).
// Uses the locally installed Google Chrome (channel "chrome"), so no Playwright
// browser download is needed; GitHub's ubuntu runners also ship Chrome.
// Override with PW_CHANNEL=msedge, or PW_CHANNEL= (empty) after
// `npx playwright install chromium` to use the bundled Chromium.
const channel = process.env.PW_CHANNEL ?? 'chrome';
const PORT = 5174; // sample mode (no server)
const CONNECTED_PORT = 5175; // connected mode (app -> local API)
const API_PORT = 8788;
const DEMO_PORT = 5176; // production build (dist/), served under a sub-path like a static host
const reuse = !process.env.CI;
const connected = /connected\.spec\.ts$/;
const demo = /demo\.spec\.ts$/;

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
    { name: 'desktop', testIgnore: [connected, demo], use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) } },
    { name: 'mobile', testIgnore: [connected, demo], use: { ...devices['Pixel 7'], ...(channel ? { channel } : {}) }, grep: /@mobile/ },
    {
      // The shareable demo: the documented walkthrough (docs/DEMO.md) against the real production build.
      name: 'demo',
      testMatch: demo,
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}), baseURL: `http://localhost:${DEMO_PORT}/wayfare/` },
    },
    {
      name: 'connected',
      testMatch: connected,
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}), baseURL: `http://localhost:${CONNECTED_PORT}` },
    },
  ],
  webServer: [
    {
      // Sample mode: VITE_WAYFARE_API_URL is cleared so these tests never depend on a server or AI key.
      command: `npx vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: reuse,
      env: { VITE_WAYFARE_API_URL: '' },
      timeout: 60_000,
    },
    {
      // Fresh sample-mode production build of the current tree, served statically under /wayfare/.
      command: `npx vite build && npx vite preview --port ${DEMO_PORT} --strictPort --base /wayfare/`,
      url: `http://localhost:${DEMO_PORT}/wayfare/`,
      reuseExistingServer: reuse,
      env: { VITE_WAYFARE_API_URL: '' },
      timeout: 120_000,
    },
    {
      // Local API in memory. AI is forced off so E2E never makes paid model calls, even if a key is set.
      command: 'node server/node.ts',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: reuse,
      env: {
        PORT: String(API_PORT),
        WAYFARE_DATA_DIR: 'memory',
        WAYFARE_AI_PROVIDER: 'none',
        WAYFARE_ALLOWED_ORIGINS: `http://localhost:${CONNECTED_PORT}`,
        WAYFARE_SESSION_LIMIT_PER_HOUR: '1000',
      },
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${CONNECTED_PORT} --strictPort`,
      url: `http://localhost:${CONNECTED_PORT}`,
      reuseExistingServer: reuse,
      env: { VITE_WAYFARE_API_URL: `http://localhost:${API_PORT}` },
      timeout: 60_000,
    },
  ],
});
