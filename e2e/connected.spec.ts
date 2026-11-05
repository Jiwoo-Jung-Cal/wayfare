// Connected mode, driven through the real UI: app -> local WayFare API (in memory, AI off).
// Proves server-side persistence and per-visitor workspace isolation in a real browser:
// each browser context is a separate visitor with its own guest session.

import { expect, test, type Page } from '@playwright/test';

const TRIP = '/#/trips/trip-demo-nyc';

const control = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
// Bookings are listed in the Itinerary; the Overview says what happened to the flight.
const bookingRows = (page: Page) => page.locator('.wf-row-b');
const cancelledNote = (page: Page) => page.getByText('Bayline Air cancelled your flight. You don’t need to call anyone.');
const workspaceId = async (page: Page) => (await page.getByText(/^Workspace ws-/).textContent())!.replace('Workspace ', '').trim();

test('two visitors get isolated server workspaces; reset is scoped; state survives reload', async ({ browser }) => {
  const visitorA = await (await browser.newContext()).newPage();
  const visitorB = await (await browser.newContext()).newPage();

  await visitorA.goto(`${TRIP}/itinerary`);
  await expect(visitorA.locator('footer.wf-footer')).toContainText('server workspace');
  await control(visitorA, 'Import sample bookings').click();
  await expect(bookingRows(visitorA)).toHaveCount(4);
  await control(visitorA, 'Trigger flight cancellation').click();
  await expect(visitorA.getByText(/ReRoute recorded disruption/)).toBeVisible();
  await visitorA.goto(TRIP);
  await expect(cancelledNote(visitorA)).toBeVisible();

  // Workspace data lives on the server, not in the browser.
  const localKeys = await visitorA.evaluate(() => Object.keys(localStorage));
  expect(localKeys.some((k) => k.startsWith('wayfare:v1:workspace:'))).toBe(false);
  expect(localKeys.some((k) => k.startsWith('wayfare:v1:session:'))).toBe(true);

  // Visitor B has a different workspace and sees none of A's records.
  await visitorB.goto(TRIP);
  await expect(visitorB.locator('footer.wf-footer')).toContainText('server workspace');
  await expect(visitorB.getByText(/No confirmed bookings yet/)).toBeVisible();
  await expect(cancelledNote(visitorB)).toHaveCount(0);
  expect(await workspaceId(visitorB)).not.toBe(await workspaceId(visitorA));

  // B clears only B's workspace.
  visitorB.once('dialog', (d) => d.accept());
  await control(visitorB, 'Clear workspace').click();
  await expect(visitorB.getByText('This workspace was reset to "empty"')).toBeVisible();
  await visitorB.goto('/');
  await expect(visitorB.getByText('No trips yet')).toBeVisible();

  // A's server workspace is untouched and survives a reload.
  await visitorA.reload();
  await expect(cancelledNote(visitorA)).toBeVisible();
  await visitorA.goto(`${TRIP}/itinerary`);
  await expect(bookingRows(visitorA)).toHaveCount(4);
});

test('intake extraction runs on the server and never fakes unrecognized text', async ({ page }) => {
  await page.goto(`${TRIP}/import`);
  await expect(page.locator('footer.wf-footer')).toContainText('server workspace');
  await page.locator('label', { hasText: 'Sample document' }).locator('select').selectOption({ label: 'Harbor Line Hotel HLH-48213 confirmation' });
  await control(page, 'Use sample document').click();
  await control(page, 'Extract booking').click();
  // Server request IDs start with "req-" (browser-only sample extraction uses "sample-").
  await expect(page.getByText(/^Request req-/)).toBeVisible();
  await expect(page.getByText('Simulated: this extraction')).toBeVisible();

  await page.getByLabel('Paste booking confirmation').fill('Acme Air confirmation ZZ9 for one traveler, paid $10.00 USD on December 1.');
  await control(page, 'Extract booking').click();
  await expect(page.getByRole('alert')).toContainText('Live AI extraction is not configured');
  await expect(page.getByRole('alert')).toContainText('request req-');
});
