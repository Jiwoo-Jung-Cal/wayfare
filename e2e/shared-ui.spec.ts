// Shared UI regressions (Agent 1): ErrorState keys for repeated issue paths, and monospace inputs.
import { expect, test } from '@playwright/test';

const TRIP = '/#/trips/trip-demo-nyc';

test('two validation issues on the same path render without a duplicate-key warning', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(`${TRIP}/plan`);
  await expect(page.getByRole('region', { name: 'Plan comparison' }).getByRole('article')).toHaveCount(3);
  // "-1000" breaks both budget rules (format and positive amount): two issues, both on "budget".
  await page.getByLabel('Budget').fill('-1000');
  const alert = page.getByRole('alert').filter({ hasText: 'budget:' });
  await expect(alert.getByRole('listitem')).toHaveCount(2);
  await expect(alert.getByRole('listitem').nth(0)).toContainText('budget');
  await expect(alert.getByRole('listitem').nth(1)).toContainText('budget');
  expect(consoleErrors.filter((e) => /same key/i.test(e))).toEqual([]);
});

test('the intake evidence textarea uses IBM Plex Mono', async ({ page }) => {
  await page.goto(`${TRIP}/import`);
  const family = await page.getByLabel('Paste booking confirmation').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/^"?IBM Plex Mono"?/);
  // Ordinary inputs keep the sans family.
  await page.goto(`${TRIP}/wallet`);
  await page.locator('details.wf-wal-add summary').click();
  const sans = await page.getByLabel('Reviewed amount').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(sans).toMatch(/^"?Figtree"?/);
});
