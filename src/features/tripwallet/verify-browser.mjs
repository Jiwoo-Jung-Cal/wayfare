// Focused browser check: npx vite --host 127.0.0.1, then node src/features/tripwallet/verify-browser.mjs
// Seeds successful action fixtures only; actual wallet-load sync and all evidence controls run in the app.
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('link', { name: 'TripWallet', exact: true }).waitFor();
  await page.evaluate(async () => {
    const core = await import('/src/core/index.ts');
    const ws = localStorage.getItem(core.ACTIVE_WORKSPACE_KEY);
    const repo = core.createLocalRepository({ storage: localStorage, workspaceId: ws });
    core.unwrap(await repo.resetDemo('booked'));
    const fx = { workspaceId: ws, now: core.DEMO_TIMES.clockStart };
    core.unwrap(await repo.putDocument(await core.demoDocument(fx, core.DEMO_IDS.documents.disruptionNotice)));
    core.unwrap(await repo.recordDisruption(core.demoDisruption(fx)));
    for (const action of core.demoCancelTripActions(fx)) core.unwrap(await repo.recordBookingAction({ action, expectedBookingRevision: 1 }));
  });
  await page.goto('http://127.0.0.1:5173/#/trips/trip-demo-nyc/wallet');
  await page.reload();
  const hotel = page.locator('.wf-card').filter({ has: page.getByRole('heading', { name: 'Harbor Line Hotel Midtown', exact: true }) });
  await expect(hotel).toContainText('$400.00');
  await page.getByRole('button', { name: 'Load sample refund confirmation', exact: true }).click();
  const select = page.getByLabel('Claim to confirm');
  const hotelValue = await select.locator('option').filter({ hasText: 'HLH-48213' }).getAttribute('value');
  await select.selectOption(hotelValue);
  await page.getByRole('button', { name: 'Confirm reviewed evidence', exact: true }).click();
  await expect(hotel).toContainText('provider confirmed');
  for (const [amount, ref, state] of [['250', 'HLH-RF-0001', 'partially received'], ['150', 'HLH-RF-0002', 'received']]) {
    await page.getByRole('button', { name: `Load sample $${amount} receipt`, exact: true }).click();
    await page.getByRole('button', { name: 'Confirm reviewed evidence', exact: true }).click();
    await page.getByLabel(`Claim for receipt ${ref}`, { exact: true }).selectOption(hotelValue);
    await page.getByRole('button', { name: `Match receipt ${ref}`, exact: true }).click();
    await expect(hotel).toContainText(state);
    if (amount === '250') {
      await expect(hotel).toContainText('Outstanding $150.00');
      await page.getByRole('button', { name: 'Prepare follow-up draft for HLH-48213', exact: true }).click();
      await expect(page.getByLabel('Editable follow-up draft')).toHaveValue(/Outstanding: \$150.00/);
    }
  }
  await expect(hotel).toContainText('Outstanding $0.00');
  await page.getByRole('button', { name: 'Load sample $250 receipt', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm reviewed evidence', exact: true }).click();
  await page.reload();
  await expect(hotel).toContainText('Outstanding $0.00');
  await expect(hotel).toContainText('Received $400.00');
  await expect(page.getByText('8,000 points (Harbor Line Rewards)')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'TripWallet', exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/tripwallet-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  console.log('PASS: wallet-load action sync, confirmation, $250/$150 receipts, draft, duplicate import, reload, noncash display, mobile render; no page errors.');
} finally { await browser.close(); }
