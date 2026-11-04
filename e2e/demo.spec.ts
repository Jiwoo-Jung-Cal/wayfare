// The documented demo walkthrough (docs/DEMO.md), run against the real sample-mode
// production build served under /wayfare/ (the "demo" project in playwright.config.ts).
// Every step uses real controls; nothing is seeded. Provider actions and extraction are simulated.

import { expect, test, type Page } from '@playwright/test';

const TRIP = '#/trips/trip-demo-nyc';
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const card = (page: Page, title: string) => page.locator('.wf-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

test.describe.configure({ retries: 0 });

test('demo walkthrough on the production build: plan, intake, disruption, approval, TripWallet, receipts, reload', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 0. Provenance: the page and version.json name the same source commit; the build is sample mode.
  await page.goto('./');
  const meta = await page.locator('meta[name="wayfare-source"]').getAttribute('content');
  const version = await (await request.get('version.json')).json() as { source: string; dirty: boolean; mode: string };
  expect(version.mode).toBe('sample');
  expect(meta).toBe(`${version.source}${version.dirty ? '-dirty' : ''}; mode=sample`);
  await expect(page.locator('footer.wf-footer')).toContainText('sample trip with fictional providers, saved in this browser');
  await expect(page.locator('footer.wf-footer')).toContainText('every provider action is simulated');

  // 1. Planning: compare sample plans and select one (a plan is not a booking).
  await page.goto(`./${TRIP}/plan`);
  await button(page, 'Generate options').click();
  const nonstop = page.getByRole('region', { name: 'Plan comparison' }).getByRole('article').filter({ hasText: 'Nonstop + Midtown hotel' });
  await nonstop.getByRole('button', { name: 'Select plan' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Plan saved. No reservation was made.' })).toBeVisible();
  await page.goto(`./${TRIP}`);
  await expect(card(page, 'Selected plan')).toContainText('Nonstop + Midtown hotel');

  // 2. Intake: review and save the hotel confirmation (simulated extraction), then import the rest.
  await page.goto(`./${TRIP}/import`);
  await page.locator('label', { hasText: 'Sample document' }).locator('select').selectOption({ label: 'Harbor Line Hotel HLH-48213 confirmation' });
  await button(page, 'Use sample document').click();
  await button(page, 'Extract booking').click();
  const review = card(page, 'Review before saving');
  await expect(review).toContainText('Simulated: this extraction');
  await review.getByLabel(/I reviewed the facts and confirm/).check();
  await button(page, 'Save reviewed booking').click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved reviewed booking: Harbor Line Hotel Midtown HLH-48213.' })).toBeVisible();
  await page.goto(`./${TRIP}/itinerary`);
  await button(page, 'Import sample bookings').click();
  await expect(page.locator('.wf-row-b')).toHaveCount(4);

  // 3. Disruption (simulated) -> Overview -> ReRoute comparison.
  await button(page, 'Trigger flight cancellation').click();
  await page.goto(`./${TRIP}`);
  await expect(page.getByText('Bayline Air cancelled your flight. You don’t need to call anyone.')).toBeVisible();
  await page.getByRole('link', { name: 'See what to do' }).click();
  await expect(page.getByRole('radio', { name: /^Keep the trip/ })).toContainText('−$360');
  await expect(page.getByRole('radio', { name: /^Cancel the whole trip/ })).toContainText('+$820');

  // 4. Approval: explicit acknowledgement; four simulated actions; the shell syncs claims.
  await button(page, 'Review and confirm').click();
  await page.getByRole('dialog').getByLabel('I understand these are simulated actions').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel the trip', exact: true }).click();
  await expect(page.locator('.wf-rr-foot [role=status]')).toHaveText('4 cancellations recorded.');
  await expect(page.getByRole('status').filter({ hasText: /Refund claims up to date/ })).toBeVisible();

  // 5. TripWallet: hotel claim $400; provider confirmation; two receipts reconcile it to $0.
  await page.getByRole('main').getByRole('link', { name: 'Open TripWallet' }).click();
  await expect(page).toHaveURL(/#\/trips\/trip-demo-nyc\/wallet$/);
  const hotel = card(page, 'Harbor Line Hotel Midtown');
  await expect(hotel).toContainText('$400.00');
  await button(page, 'Load sample refund confirmation').click();
  const claimSelect = page.getByRole('combobox', { name: /^Claim to confirm/ });
  const hotelId = await claimSelect.locator('option').filter({ hasText: 'HLH-48213' }).getAttribute('value');
  await claimSelect.selectOption(hotelId!);
  await button(page, 'Confirm reviewed evidence').click();
  await expect(hotel).toContainText('provider confirmed');
  for (const [amount, reference, outstanding] of [['250', 'HLH-RF-0001', '150'], ['150', 'HLH-RF-0002', '0']]) {
    await button(page, `Load sample $${amount} receipt`).click();
    await button(page, 'Confirm reviewed evidence').click();
    await page.getByRole('combobox', { name: new RegExp(`^Claim for receipt ${reference}\\b`) }).selectOption(hotelId!);
    await button(page, `Match receipt ${reference}`).click();
    await expect(hotel).toContainText(`Outstanding $${outstanding}.00`);
  }

  // 6. Reload: everything persists in this browser's workspace.
  await page.reload();
  await expect(hotel).toContainText('Received $400.00');
  await expect(hotel).toContainText('Outstanding $0.00');
  await page.goto(`./${TRIP}`);
  await expect(page.getByText('You chose to cancel. We recorded 4 cancellations.')).toBeVisible();
  expect(errors).toEqual([]);
});
