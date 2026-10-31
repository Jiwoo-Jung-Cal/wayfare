// Integrated demo journey, driven through the real UI (sample mode).
// Shell-owned steps run now; steps that need the Wayfinder/ReRoute/TripWallet
// pages are test.fixme until those modules are merged (#4, #6, #7).

import { expect, test, type Page } from '@playwright/test';

const TRIP = '/#/trips/trip-demo-nyc';

const control = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const bookingRows = (page: Page) => page.getByRole('table').getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
const deadline = (page: Page, label: string) => page.getByRole('listitem').filter({ hasText: label });
const statusMessage = (page: Page) => page.locator('[aria-live="polite"]').filter({ hasText: /\w/ }).last();

test.describe('demo journey: shell steps', () => {
  test('load, import (no duplicates), disrupt, deadline boundary, reload, reset', async ({ page }) => {
    await page.goto(TRIP);
    await expect(page.getByRole('heading', { level: 1, name: 'San Francisco to New York' })).toBeVisible();
    await expect(page.getByText('Sample data: saved in this browser')).toBeVisible();
    await expect(page.getByText('Simulated: AI extraction')).toBeVisible();
    await expect(page.getByText(/No confirmed bookings yet/)).toBeVisible();

    // Import the four reviewed sample bookings; a repeat import must not duplicate.
    await control(page, 'Import sample bookings').click();
    await expect(statusMessage(page)).toHaveText('Saved 4 reviewed sample bookings.');
    await expect(bookingRows(page)).toHaveCount(4);
    await control(page, 'Import sample bookings').click();
    await expect(statusMessage(page)).toHaveText('Sample bookings were already imported; nothing duplicated.');
    await expect(bookingRows(page)).toHaveCount(4);
    for (const amount of ['$320.00', '$450.00', '$80.00', '$50.00']) {
      await expect(page.getByRole('cell', { name: amount, exact: true })).toBeVisible();
    }

    // Simulated outbound cancellation.
    await control(page, 'Trigger flight cancellation').click();
    await expect(page.getByText(/Disruption:.*Bayline Air cancelled BL 214/)).toBeVisible();

    // Frozen boundary: open one second before, passed exactly at 2026-11-19T23:00:00Z.
    await control(page, '1 s before hotel deadline').click();
    await expect(page.getByLabel('Active clock')).toContainText('2026-11-19T22:59:59Z');
    await expect(deadline(page, 'Hotel $400 refund deadline')).toContainText('Open');
    await control(page, 'At hotel deadline').click();
    await expect(page.getByLabel('Active clock')).toContainText('2026-11-19T23:00:00Z');
    await expect(deadline(page, 'Hotel $400 refund deadline')).toContainText('Passed');

    // Reload: state, clock and boundary persist.
    await page.reload();
    await expect(bookingRows(page)).toHaveCount(4);
    await expect(page.getByText(/Disruption:/)).toBeVisible();
    await expect(page.getByLabel('Active clock')).toContainText('2026-11-19T23:00:00Z');
    await expect(deadline(page, 'Hotel $400 refund deadline')).toContainText('Passed');

    // Reset affects only this workspace and asks for confirmation first.
    page.once('dialog', (d) => d.accept());
    await control(page, 'Clear workspace').click();
    await page.goto('/');
    await expect(page.getByText('No trips yet')).toBeVisible();
  });

  test('wallet load runs the claim-sync handoff and reports its state in words', async ({ page }) => {
    await page.goto(`${TRIP}/wallet`);
    await expect(page.getByText(/TripWallet is not connected yet/)).toBeVisible();
    await page.goto(TRIP);
    await expect(page.getByText(/Claim sync is pending: the TripWallet module is not connected yet/)).toBeVisible();
  });

  test('keyboard: skip link and main navigation are reachable', async ({ page }) => {
    await page.goto(TRIP);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'ReRoute' })).toBeVisible();
  });

  test('@mobile narrow layout has no horizontal scroll', async ({ page }) => {
    await page.goto(TRIP);
    await control(page, 'Import sample bookings').click();
    await expect(bookingRows(page)).toHaveCount(4);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('demo journey: feature steps (pending modules)', () => {
  test.fixme('select the nonstop plan in Wayfinder; dashboard shows it (Agent 2, #4)', async () => {});
  test.fixme('import a pasted confirmation through the intake review UI (Agent 2, #4)', async () => {});
  test.fixme('approve cancel-trip in ReRoute before the hotel deadline; $820 expected recovery (Agent 4, #6)', async () => {});
  test.fixme('TripWallet shows the $400 hotel claim; $250 receipt leaves $150; $150 resolves it (Agent 5, #7)', async () => {});
  test.fixme('completed state survives reload; repeated approval/receipt import does not double records', async () => {});
});
