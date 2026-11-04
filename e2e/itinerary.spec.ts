// Itinerary (r2-final §3): calendar + whole-trip list from stored bookings and policy deadlines.
import { expect, test } from '@playwright/test';

const TRIP = '/#/trips/trip-demo-nyc';

test('itinerary lists every booking with its own deadline; day selection highlights, never filters @mobile', async ({ page }) => {
  await page.goto(`${TRIP}/itinerary`);
  await expect(page.getByRole('heading', { level: 1, name: 'Itinerary' })).toBeVisible();
  await expect(page.getByText('No bookings yet')).toBeVisible();

  await page.getByRole('button', { name: 'Import sample bookings', exact: true }).click();
  await page.getByRole('button', { name: 'Trigger flight cancellation', exact: true }).click();
  const rows = page.locator('.wf-row-b');
  await expect(rows).toHaveCount(4);

  const hotel = rows.filter({ hasText: 'Harbor Line Hotel Midtown' });
  await expect(hotel).toContainText('Refund deadline Thu, 6:00 PM EST · +$400 → +$200 · 30h 00m left');
  await expect(hotel).toContainText('At risk');
  await expect(rows.filter({ hasText: 'BL 214' })).toContainText('No deadline · the airline owes you +$320');

  // Selecting a day highlights its entries and keeps the whole list.
  await page.getByRole('button', { name: /^Saturday, Nov 21/ }).click();
  await expect(rows).toHaveCount(4);
  await expect(rows.filter({ hasText: 'Skyline Walk' })).toHaveAttribute('data-hl', 'true');
  await expect(rows.filter({ hasText: 'BL 214' })).not.toHaveAttribute('data-hl', 'true');

  // Category chips toggle.
  await page.getByRole('button', { name: 'Rides', exact: true }).click();
  await expect(rows).toHaveCount(3);
  await page.getByRole('button', { name: 'Rides', exact: true }).click();

  // Details drawer with Google's public template link (no sign-in).
  await hotel.click();
  const drawer = page.getByRole('dialog', { name: 'Harbor Line Hotel Midtown, 3 nights' });
  await expect(drawer).toContainText('“6:00 PM ET on November 19, 2026”');
  const href = await drawer.getByRole('link', { name: /Add to Google Calendar/ }).getAttribute('href');
  expect(href).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&/);
  expect(href).toContain('dates=20261120%2F20261123');
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();

  // Calendar sync is a labelled demo with nothing connected.
  await page.getByRole('button', { name: 'Connect Google Calendar' }).click();
  await expect(page.getByRole('dialog', { name: 'Connect Google Calendar' })).toContainText('no Google account is contacted');
});
