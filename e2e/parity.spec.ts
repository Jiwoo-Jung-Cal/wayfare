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
  await expect(page.getByRole('button', { name: /Account: Jiwoo Jung \(demo\)/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Signed in' })).toBeVisible();
  await page.goto('/#/trips/trip-demo-nyc/itinerary');
  await page.getByRole('button', { name: 'Connect Google Calendar' }).click();
  await page.getByRole('dialog', { name: 'Connect Google Calendar' }).getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('button', { name: 'Synced with Google Calendar (demo)' })).toBeVisible();
});

test('bell lists the cancellation and the next decision; the trip menu lists only this workspace’s trips', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Notifications/ }).click();
  const inbox = page.getByRole('region', { name: 'Notifications' });
  await expect(inbox).toContainText('Flight BL 214 cancelled');
  await expect(inbox).toContainText('Decide by Thursday 6:00 PM');
  await expect(inbox).toContainText('the hotel refunds $200 instead of $400');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Trip: NY Trip' }).click();
  const menu = page.getByRole('menu', { name: 'Trips' });
  await expect(menu.getByRole('menuitemradio')).toHaveCount(1);
  await expect(menu).not.toContainText('Chicago');
  await expect(menu).not.toContainText('Tokyo');
});

test('the Plan assistant plans Chicago for two and Tokyo; choosing a plan adds each trip @mobile', async ({ page }) => {
  await page.goto('/#/trips/trip-demo-nyc/plan');
  await expect(page.getByRole('region', { name: 'Plan comparison' }).getByRole('article')).toHaveCount(3);
  await page.getByLabel('Describe your trip').fill('A weekend in Chicago for 2 people under $1,200');
  await page.keyboard.press('Enter');
  // While the reply is pending WayFare shows a typing indicator and the send button spins.
  await expect(page.getByLabel('WayFare is typing')).toBeVisible();
  await expect(page.getByRole('button', { name: 'WayFare is replying' })).toBeDisabled();
  await expect(page.getByLabel('WayFare is typing')).toBeHidden();
  const log = page.getByRole('log', { name: 'Conversation with WayFare' });
  await expect(log).toContainText('Here are 3 plans for Chicago, Dec 11 – Dec 13, for 2 travelers');
  await expect(log).toContainText('No AI model is used');
  const plans = page.getByRole('region', { name: 'Plan comparison' });
  await expect(plans).toContainText('I found 3 plans for Chicago');
  // Group pricing: the cheapest Chicago plan for one is $573; for two it is $836.
  const first = plans.getByRole('article').first();
  await expect(first).toContainText('One stop + River North stay · 2 travelers');
  await expect(first).toContainText('$836');
  await first.getByRole('button', { name: 'Choose this plan' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Added Chicago Weekend to your trips. Plan saved. No reservation was made.' })).toBeVisible();

  await page.getByLabel('Describe your trip').fill('Tokyo in spring, just me, budget $3,000');
  await page.keyboard.press('Enter');
  await expect(plans).toContainText('I found 3 plans for Tokyo');
  await plans.getByRole('article').first().getByRole('button', { name: 'Choose this plan' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Added Tokyo in Spring to your trips.' })).toBeVisible();

  await page.getByRole('button', { name: 'Trip: NY Trip' }).click();
  const menu = page.getByRole('menu', { name: 'Trips' });
  await expect(menu).toContainText('Chicago Weekend');
  await expect(menu).toContainText('Dec 11 – 13, 2026 · Plan selected');
  await expect(menu).toContainText('Tokyo in Spring');
  await menu.getByRole('menuitemradio', { name: /Chicago Weekend/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Chicago Weekend' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trip: Chicago Weekend' })).toBeVisible();
  // Added trips survive a reload.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Chicago Weekend' })).toBeVisible();
});

test('the destination can be typed in the route popover, and travelers re-price the plans', async ({ page }) => {
  await page.goto('/#/trips/trip-demo-nyc/plan');
  await expect(page.getByRole('region', { name: 'Plan comparison' }).getByRole('article')).toHaveCount(3);
  await page.getByRole('button', { name: /^Route:/ }).click();
  const dest = page.getByLabel('Destination');
  await dest.fill('');
  await dest.pressSequentially('Tokyo');
  await expect(dest).toHaveValue('Tokyo');
  await page.getByRole('dialog', { name: 'Route' }).getByRole('button', { name: 'Done' }).click();
  const plans = page.getByRole('region', { name: 'Plan comparison' });
  await expect(plans).toContainText('I found 3 plans for Tokyo, Mar 27 – Apr 3 · 1 traveler.');
  await page.getByRole('button', { name: /1 traveler/ }).click();
  await page.getByRole('button', { name: 'More adults' }).click();
  await page.getByRole('button', { name: 'More adults' }).click();
  await page.getByRole('dialog', { name: 'Travelers' }).getByRole('button', { name: 'Done' }).click();
  await expect(plans).toContainText('3 travelers (group pricing)');
});

test('the decision countdown ticks every second on the Overview', async ({ page }) => {
  await page.goto('/');
  const timer = page.getByRole('timer');
  await expect(timer).toContainText(/^30h 00m 00s|^29h 59m \d\ds/);
  const first = await timer.innerText();
  await expect.poll(() => timer.innerText(), { timeout: 4000 }).not.toBe(first);
  await expect(timer).toContainText(/29h 59m \d\ds/);
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
