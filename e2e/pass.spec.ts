// Boarding pass: always drawn (placeholders until a flight is booked) and the stub tear works
// at every window size (hover on desktop, tap/focus on touch, stacked below 1000 px).
import { expect, test, type Page } from '@playwright/test';

const TRIP = '/#/trips/trip-demo-nyc';
const stubTransform = (page: Page) => page.locator('.wf-bp-stub').evaluate((el) => getComputedStyle(el).transform);
const control = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('before any booking the pass shows placeholders, then fills in once the flight is booked', async ({ page }) => {
  await page.goto(TRIP);
  const pass = page.getByLabel('Boarding pass placeholder: no flight booked yet');
  await expect(pass).toBeVisible();
  await expect(pass).toContainText('WAYFARE');
  await expect(pass.locator('.wf-bp-grid')).toContainText('PASSENGERNot set');
  await expect(pass).not.toContainText('SFO');
  await expect(pass).not.toContainText('CANCELLED');

  await control(page, 'Import sample bookings').click();
  await expect(page.getByLabel(/^Boarding pass for Bayline Air flight BL 214$/)).toBeVisible();
  await expect(page.locator('.wf-bp')).toContainText('Demo Traveler');
});

test('the empty home page shows the placeholder pass', async ({ page }) => {
  await page.goto(TRIP);
  page.once('dialog', (d) => d.accept());
  await control(page, 'Clear workspace').click();
  await expect(page.getByText('This workspace was reset to "empty"', { exact: false })).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('No trips yet')).toBeVisible();
  await expect(page.getByLabel('Boarding pass placeholder: no flight booked yet')).toBeVisible();
});

test('the stub tears on hover in a non-maximised 1024 px window and on tap when stacked @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto(TRIP);
  await page.emulateMedia({ reducedMotion: 'reduce' }); // no transition: read the end state at once
  expect(await stubTransform(page)).toBe('none');
  await page.locator('.wf-bp-hit').hover();
  await expect.poll(() => stubTransform(page)).not.toBe('none');
  await page.mouse.move(0, 0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.wf-bp').evaluate((el) => (el as HTMLElement).blur());
  await expect.poll(() => stubTransform(page)).toBe('none');
  await page.locator('.wf-bp-stub').click();
  await expect.poll(() => stubTransform(page)).not.toBe('none');
});
