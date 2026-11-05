// Design-reference parity (design/exports/prototype/r2/index.html): what a first-time
// visitor sees, and the reference's shell behaviours (Ask WayFare, sign-in demo, bell,
// sample trips, toasts). Starts from an empty browser profile, like a real visitor.
import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('a first visit opens on the reference scenario: NY Trip, booked, flight cancelled by the airline @mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/trips\/trip-demo-nyc$/);
  await expect(page.getByRole('heading', { level: 1, name: 'NY Trip' })).toBeVisible();
  await expect(page.getByText('CANCELLED', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Decide within')).toBeVisible();
  // The footer carries the honest capability labels; demo controls start collapsed.
  await expect(page.locator('footer.wf-footer')).toContainText('every provider action is simulated');
  await expect(page.getByRole('button', { name: 'Import sample bookings' })).toBeHidden();
  await page.locator('summary', { hasText: 'Demo controls' }).click();
  await expect(page.getByRole('button', { name: 'Import sample bookings' })).toBeVisible();
});

test('Ask WayFare answers from this trip’s stored data and says its replies are scripted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask WayFare' }).click();
  const panel = page.getByRole('region', { name: 'WayFare assistant' });
  await expect(panel).toContainText('I know your NY Trip');
  await expect(panel).toContainText('Demo replies, written from this trip’s data. No AI model is used.');
  await panel.getByRole('button', { name: 'How much will I get back?' }).click();
  await expect(panel).toContainText('That’s +$820 back and −$80 you can’t recover.');
  await panel.getByRole('textbox', { name: 'Message' }).fill('when is my next deadline');
  await panel.getByRole('button', { name: 'Send' }).click();
  await expect(panel).toContainText('Your next deadline is Thursday');
  await panel.getByRole('link', { name: 'Open the calendar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Itinerary' })).toBeVisible();
  await panel.getByRole('button', { name: 'Minimize' }).click();
  await expect(page.getByRole('button', { name: 'Ask WayFare' })).toBeVisible();
});

test('sign-in and calendar sync are simulated demo states that say nothing is sent to Google', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign in to WayFare' });
  await expect(dialog).toContainText('no Google account is contacted');
  await expect(dialog.locator('input')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('button', { name: /Account: Sample Traveler \(demo\)/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Signed in' })).toBeVisible();
  await page.goto('/#/trips/trip-demo-nyc/itinerary');
  await page.getByRole('button', { name: 'Connect Google Calendar' }).click();
  await page.getByRole('dialog', { name: 'Connect Google Calendar' }).getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('button', { name: 'Synced with Google Calendar (demo)' })).toBeVisible();
});

test('bell lists the cancellation and the next decision; the trip menu offers the reference’s sample trips', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Notifications/ }).click();
  const inbox = page.getByRole('region', { name: 'Notifications' });
  await expect(inbox).toContainText('Flight BL 214 cancelled');
  await expect(inbox).toContainText('Decide by Thursday 6:00 PM');
  await expect(inbox).toContainText('the hotel refunds $200 instead of $400');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Trip: NY Trip' }).click();
  await page.getByRole('menuitemradio', { name: /Chicago Weekend/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Chicago Weekend' })).toBeVisible();
  await expect(page.getByText('This is a short sample.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to NY Trip' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'NY Trip' })).toBeVisible();
});

test('a browser that kept an empty workspace from an earlier visit also opens on the reference scenario, once', async ({ page }) => {
  // Earlier builds started new workspaces before any booking: recreate that browser state.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('wf-test-setup')) {
      sessionStorage.setItem('wf-test-setup', '1');
      localStorage.setItem('wayfare:v1:first-stage', 'planning');
    }
  });
  await page.goto('/');
  await expect(page.getByText(/No confirmed bookings yet/)).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('wayfare:v1:first-stage'));
  await page.reload();
  await expect(page.getByLabel(/^Boarding pass for Bayline Air flight BL 214, cancelled by the airline/)).toBeVisible();
  await expect(page.locator('.wf-money-tiles')).toContainText('+$820');

  // Afterwards the workspace is the visitor's own: clearing it is not undone on reload.
  await page.locator('summary', { hasText: 'Demo controls' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Clear workspace' }).click();
  // Demo controls finish asynchronously; navigate only once each reports done.
  await expect(page.getByText('This workspace was reset to "empty"')).toBeVisible();
  await page.goto('/');
  await page.reload();
  await expect(page.getByText('No trips yet')).toBeVisible();
  // The demo control brings the reference scenario back on demand.
  await page.getByRole('button', { name: 'Show the reference scenario' }).click();
  await expect(page.getByText(/Reference scenario loaded/)).toBeVisible();
  await page.goto('/');
  await expect(page.getByLabel(/^Boarding pass for Bayline Air flight BL 214/)).toBeVisible();
});

test('choosing a plan after the workspace is reset to planning is not labelled booked (Agent 3 finding)', async ({ page }) => {
  // The reference scenario starts booked; then Demo controls → Load sample trip removes every booking.
  await page.goto('/#/trips/trip-demo-nyc/plan');
  await expect(page.getByRole('region', { name: 'Plan comparison' }).getByRole('article')).toHaveCount(3);
  await page.locator('summary', { hasText: 'Demo controls' }).click();
  await page.getByRole('button', { name: 'Load sample trip' }).click();
  await expect(page.getByText('This workspace was reset to "planning"')).toBeVisible();
  const first = page.getByRole('region', { name: 'Plan comparison' }).getByRole('article').first();
  await first.getByRole('button', { name: 'Choose this plan' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Plan saved. No reservation was made.' })).toBeVisible();
  await expect(first).not.toContainText('BOOKED');
  await expect(first.getByRole('link', { name: 'View your trip' })).toHaveCount(0);
  await expect(first).toContainText('Nothing is booked or paid until you confirm.');
  await expect(page.getByText('plan selected, nothing booked yet')).toBeVisible();
});
