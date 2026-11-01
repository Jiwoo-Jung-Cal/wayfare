// Integrated demo journey, driven through the real UI (sample mode).
// Shell, Wayfinder and intake steps run now; steps that need the ReRoute and
// TripWallet pages are test.fixme until those modules are merged (#6, #7).

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
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const card = (page: Page, heading: string) => page.locator('.wf-card').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
const planCard = (page: Page, label: string) =>
  page.getByRole('region', { name: 'Plan comparison' }).getByRole('article').filter({ has: page.getByRole('heading', { name: new RegExp(`\\d\\. ${label.replace(/[+]/g, '\\+')}$`) }) });
const status = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });
const sampleSelect = (page: Page) => page.locator('label', { hasText: 'Sample document' }).locator('select');

test.describe('demo journey: Wayfinder and intake (Agent 2, #4)', () => {
  test('compare plans, select the nonstop plan; dashboard shows it after reload; reselect is a no-op', async ({ page }) => {
    await page.goto(`${TRIP}/plan`);
    await control(page, 'Generate options').click();
    await expect(page.getByRole('region', { name: 'Plan comparison' }).getByRole('article')).toHaveCount(3);
    await expect(planCard(page, 'Red-eye + Brooklyn hotel')).toContainText('$815.00');
    await expect(planCard(page, 'Nonstop + Midtown hotel')).toContainText('$900.00');
    // Unknown price is not free: the flexible plan cannot be selected.
    const flex = planCard(page, 'Refundable fare + flexible hotel');
    await expect(flex).toContainText('Unknown');
    await expect(flex.getByRole('button', { name: 'Select plan' })).toBeDisabled();

    await planCard(page, 'Nonstop + Midtown hotel').getByRole('button', { name: 'Select plan' }).click();
    await expect(status(page, 'Plan saved. No reservation was made.')).toBeVisible();

    await page.goto(TRIP);
    await expect(card(page, 'Selected plan')).toContainText('Nonstop + Midtown hotel');
    await expect(card(page, 'Selected plan')).toContainText('$900.00');
    // A selected plan is not a booking.
    await expect(page.getByText(/No confirmed bookings yet/)).toBeVisible();

    await page.reload();
    await expect(card(page, 'Selected plan')).toContainText('Nonstop + Midtown hotel');
    await page.goto(`${TRIP}/plan`);
    await expect(card(page, 'Saved selected plan')).toContainText('Nonstop + Midtown hotel');
    await control(page, 'Generate options').click();
    await planCard(page, 'Nonstop + Midtown hotel').getByRole('button', { name: 'Selected plan' }).click();
    await expect(status(page, 'This plan is already selected.')).toBeVisible();
  });

  test('paste-and-review intake saves the hotel once, keeps evidence, and handles unknown/malformed/unconfigured input', async ({ page }) => {
    await page.goto(`${TRIP}/import`);
    await sampleSelect(page).selectOption({ label: 'Harbor Line Hotel HLH-48213 confirmation' });
    await control(page, 'Use sample document').click();
    await control(page, 'Extract booking').click();

    const review = card(page, 'Review before saving');
    await expect(review).toContainText('Simulated: this extraction');
    await expect(review.getByLabel(/^Booking reference/)).toHaveValue('HLH-48213');
    await expect(review).toContainText('Total charged: $450.00 USD');
    await expect(review).toContainText('Hotel $400 refund deadline');
    await expect(review).toContainText('2026-11-19T23:00:00Z (exclusive)');

    await review.getByLabel(/I reviewed the facts and confirm/).check();
    await control(page, 'Save reviewed booking').click();
    await expect(status(page, 'Saved reviewed booking: Harbor Line Hotel Midtown HLH-48213.')).toBeVisible();
    await control(page, 'Save reviewed booking').click();
    await expect(status(page, 'Already imported: Harbor Line Hotel Midtown HLH-48213. No duplicate was created')).toBeVisible();

    await page.goto(TRIP);
    await expect(bookingRows(page)).toHaveCount(1);
    await expect(page.getByRole('cell', { name: '$450.00', exact: true })).toBeVisible();
    await expect(deadline(page, 'Hotel $400 refund deadline')).toContainText('Open');

    // Unknown policy stays unknown; no invented refund rule.
    await page.goto(`${TRIP}/import`);
    await sampleSelect(page).selectOption({ label: 'Gotham Rooftop Dinners GRD-1180' });
    await control(page, 'Use sample document').click();
    await control(page, 'Extract booking').click();
    await expect(page.getByText('No usable refund rules were extracted.')).toBeVisible();
    await expect(page.getByText(/Refundability: unknown/)).toBeVisible();

    // Malformed document and unrecognized text are explicit errors; input is preserved.
    await sampleSelect(page).selectOption({ label: 'Malformed document' });
    await control(page, 'Use sample document').click();
    await control(page, 'Extract booking').click();
    await expect(page.getByRole('alert')).toContainText('does not look like a booking confirmation');
    const pasted = 'Acme Air confirmation ZZ9 for one traveler, paid $10.00 USD on December 1.';
    await page.getByLabel('Paste booking confirmation').fill(pasted);
    await control(page, 'Extract booking').click();
    await expect(page.getByRole('alert')).toContainText('Live AI extraction is not configured');
    await expect(page.getByLabel('Paste booking confirmation')).toHaveValue(pasted);
  });

  test('@mobile plan and import pages have no horizontal scroll', async ({ page }) => {
    for (const route of ['plan', 'import']) {
      await page.goto(`${TRIP}/${route}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await horizontalOverflow(page), `/${route}`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('demo journey: feature steps (pending modules)', () => {
  test.fixme('approve cancel-trip in ReRoute before the hotel deadline; $820 expected recovery (Agent 4, #6)', async () => {});
  test.fixme('TripWallet shows the $400 hotel claim; $250 receipt leaves $150; $150 resolves it (Agent 5, #7)', async () => {});
  test.fixme('completed state survives reload; repeated approval/receipt import does not double records', async () => {});
});
