// The demo-video script (docs/DEMO_VIDEO.md), scene by scene, from a fresh browser profile.
// Every input in the script is typed or clicked here, and every "you should see" line is
// asserted, so the script stays true to the app. Sample data; provider actions simulated.
import { expect, test, type Page } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ retries: 0 });

const T = '/#/trips/trip-demo-nyc';
const btn = (p: Page, name: string) => p.getByRole('button', { name, exact: true });
const plans = (p: Page) => p.getByRole('region', { name: 'Plan comparison' });
async function say(p: Page, text: string) {
  await p.getByLabel('Describe your trip').fill(text);
  await p.keyboard.press('Enter');
}

test('demo video script: every scene runs with the outputs the script lists', async ({ page: p }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));

  // Scene 1: Overview.
  await p.goto('/');
  await expect(p.getByLabel(/^Boarding pass for Bayline Air flight BL 214, cancelled by the airline/)).toBeVisible();
  await expect(p.getByRole('timer')).toContainText(/^(30h 00m 00s|29h 59m \d\ds)/);
  await expect(p.locator('.wf-ov-cta')).toContainText('By Thursday 6:00 PM ET. After that, the hotel refunds less.');
  await expect(p.locator('.wf-money-tiles')).toContainText('+$820');
  await expect(p.locator('.wf-money-tiles')).toContainText('−$80');
  await expect(p.locator('.wf-money-tiles')).toContainText('$900');
  const hotelPass = p.locator('.wf-pass').filter({ hasText: 'Harbor Line Hotel Midtown' });
  await hotelPass.click();
  await expect(hotelPass).toHaveAttribute('aria-expanded', 'true');
  await expect(hotelPass).toContainText('Cancel before Thu 6 PM: +$400 back.');
  // The pass slides open (the stack animates), it doesn't jump.
  expect(await hotelPass.locator('.wf-pass-bw').evaluate((e) => getComputedStyle(e).transitionProperty)).toContain('grid-template-rows');

  // Scene 2: notifications and demo sign-in.
  await p.getByRole('button', { name: /^Notifications/ }).click();
  const inbox = p.getByRole('region', { name: 'Notifications' });
  await expect(inbox).toContainText('Flight BL 214 cancelled');
  await expect(inbox).toContainText('After that, the hotel refunds $200 instead of $400.');
  await p.keyboard.press('Escape');
  await btn(p, 'Sign in').click();
  await p.getByRole('dialog', { name: 'Sign in to WayFare' }).getByRole('button', { name: 'Continue with Google' }).click();
  await expect(p.getByRole('button', { name: /Account: Jiwoo Jung \(demo\)/ })).toHaveText('JJ');

  // Scene 3: Plan with the assistant.
  await p.goto(`${T}/plan`);
  await expect(plans(p).getByRole('article')).toHaveCount(3);
  await expect(plans(p).getByRole('article').first()).toContainText('Red-eye + Brooklyn hotel');
  await say(p, '3 nights in New York for 2 people under $1,500, nonstop please');
  await expect(p.locator('.wf-msg').last()).toContainText('Here are 3 plans for New York, Nov 20 – Nov 23, for 2 travelers, with a $1,500 budget, most convenient first.');
  await expect(plans(p).getByRole('article').first()).toContainText('Nonstop + Midtown hotel · 2 travelers');
  await expect(plans(p).getByRole('article').first()).toContainText('$1,300');
  await btn(p, 'Price').click();
  await expect(plans(p).getByRole('article').first()).toContainText('$1,185');
  await say(p, 'Take us to Paris for 3 people');
  await expect(p.locator('.wf-msg').last()).toContainText('I don’t have sample trips for Paris yet. In this demo I can plan New York, Chicago or Tokyo from San Francisco.');
  await say(p, 'A weekend in Chicago for 2 people under $1,200');
  await expect(p.locator('.wf-msg').last()).toContainText('Choose one and I’ll add Chicago Weekend to your trips.');
  const chi = plans(p).getByRole('article').first();
  await expect(chi).toContainText('One stop + River North stay · 2 travelers');
  await expect(chi).toContainText('$836');
  await chi.getByRole('button', { name: 'Choose this plan' }).click();
  await expect(p.getByRole('status').filter({ hasText: 'Added Chicago Weekend to your trips. Plan saved. No reservation was made.' })).toBeVisible();
  await say(p, 'Tokyo in spring, just me, budget $3,000');
  const tyo = plans(p).getByRole('article').first();
  await expect(tyo).toContainText('One stop + Asakusa ryokan');
  await expect(tyo).toContainText('$2,140');
  await tyo.getByRole('button', { name: 'Choose this plan' }).click();
  await expect(p.getByRole('status').filter({ hasText: 'Added Tokyo in Spring to your trips.' })).toBeVisible();
  await p.getByRole('button', { name: 'Trip: NY Trip' }).click();
  const menu = p.getByRole('menu', { name: 'Trips' });
  await expect(menu).toContainText('Nov 20 – 23, 2026 · Needs attention');
  await expect(menu).toContainText('Dec 11 – 13, 2026 · Plan selected');
  await expect(menu).toContainText('Mar 27 – Apr 3, 2027 · Plan selected');
  await p.keyboard.press('Escape');

  // Scene 4: Import (booking intake).
  await p.goto(`${T}/import`);
  const sample = p.locator('label', { hasText: 'Sample document' }).locator('select');
  const review = p.locator('.wf-card').filter({ has: p.getByRole('heading', { name: 'Review before saving' }) });
  await sample.selectOption({ label: 'Gotham Rooftop Dinners GRD-1180' });
  await btn(p, 'Use sample document').click();
  await btn(p, 'Extract booking').click();
  await expect(review).toContainText('Terms unknown');
  await expect(review).toContainText('Missing terms do not mean a full refund or a nonrefundable booking.');
  await btn(p, 'Start over').click();
  await sample.selectOption({ label: 'Harbor Line Hotel HLH-48213 confirmation' });
  await btn(p, 'Use sample document').click();
  await btn(p, 'Extract booking').click();
  await review.getByLabel(/I reviewed the facts and confirm/).check();
  await btn(p, 'Save reviewed booking').click();
  await expect(p.getByRole('status').filter({ hasText: 'Already imported: Harbor Line Hotel Midtown HLH-48213. No duplicate was created' })).toBeVisible();
  await p.getByLabel('Paste booking confirmation').fill('Acme Air confirmation ZZ9, paid $10.00 USD on December 1.');
  await btn(p, 'Extract booking').click();
  await expect(p.getByRole('alert').first()).toContainText('Live AI extraction is not configured.');

  // Scene 5: Itinerary.
  await p.goto(`${T}/itinerary`);
  const rows = p.locator('.wf-row-b');
  await expect(rows).toHaveCount(4);
  await expect(rows.filter({ hasText: 'HLH-48213' })).toContainText('Refund deadline Thu, 6:00 PM EST · +$400 → +$200 · 30h 00m left');
  await expect(rows.filter({ hasText: 'BLA7Q2' })).toContainText('No deadline · the airline owes you +$320');

  // Scene 6: ReRoute, including the deadline cutoff.
  await p.goto(`${T}/reroute`);
  await expect(p.getByRole('radio', { name: /^Cancel the whole trip/ })).toContainText('+$820');
  await expect(p.getByRole('radio', { name: /^Keep the trip/ })).toContainText('−$360');
  expect(await p.locator('.wf-rr-mark').allTextContents()).toEqual(['Hotel −$200', 'Ride −$40', 'Walk −$60']);
  await p.locator('summary', { hasText: 'Demo controls' }).click();
  await btn(p, 'At hotel deadline').click();
  await expect(p.getByRole('radio', { name: /^Cancel the whole trip/ })).toContainText('+$620');
  await expect(p.getByRole('radio', { name: /^Cancel the whole trip/ })).toContainText('−$280');
  await btn(p, 'Reset clock').click();
  await expect(p.getByRole('radio', { name: /^Cancel the whole trip/ })).toContainText('+$820');

  // Scene 7: approve the cancellation (simulated).
  await btn(p, 'Review and confirm').click();
  const dialog = p.getByRole('dialog');
  await expect(dialog).toContainText('We’ll record 4 cancellations and start tracking your refunds. In this demo nothing is sent to a real company.');
  await expect(dialog.getByRole('button', { name: 'Cancel the trip', exact: true })).toBeDisabled();
  await dialog.getByLabel('I understand these are simulated actions').check();
  await dialog.getByRole('button', { name: 'Cancel the trip', exact: true }).click();
  await expect(p.locator('.wf-rr-foot [role=status]')).toHaveText('4 cancellations recorded.');

  // Scene 8: TripWallet and receipts.
  await p.goto(`${T}/wallet`);
  await expect(p.getByRole('main')).toContainText('+$820');
  const hotel = p.locator('.wf-wal-item').filter({ hasText: 'HLH-48213' });
  await p.locator('details.wf-wal-add summary').click();
  await btn(p, 'Load sample refund confirmation').click();
  const claim = p.getByRole('combobox', { name: /^Claim to confirm/ });
  await claim.selectOption((await claim.locator('option').filter({ hasText: 'HLH-48213' }).getAttribute('value'))!);
  await btn(p, 'Confirm reviewed evidence').click();
  await expect(hotel).toContainText('Company confirmed · not received yet');
  await btn(p, 'Load sample $250 receipt').click();
  await btn(p, 'Confirm reviewed evidence').click();
  await expect(p.getByText('Is this your hotel refund?')).toBeVisible();
  await p.getByRole('button', { name: /^Yes, that.s it$/ }).click();
  await expect(hotel).toContainText('Received $250.00 · $150.00 outstanding');
  await btn(p, 'Load sample $150 receipt').click();
  await btn(p, 'Confirm reviewed evidence').click();
  await p.getByRole('button', { name: /^Yes, that.s it$/ }).click();
  await expect(hotel).toContainText('Received $400.00');
  await expect(hotel).toContainText('100%');

  // Scene 9: Ask WayFare.
  await btn(p, 'Ask WayFare').click();
  const panel = p.getByRole('region', { name: 'WayFare assistant' });
  await panel.getByPlaceholder('Type your message…').fill('How much will I get back?');
  await p.keyboard.press('Enter');
  await expect(panel.locator('.wf-msg').last()).toContainText('You cancelled the trip, so +$820 is coming back and −$80 was lost to fees.');
  await panel.getByPlaceholder('Type your message…').fill('What’s my next deadline?');
  await p.keyboard.press('Enter');
  await expect(panel.locator('.wf-msg').last()).toContainText('You already cancelled, so refund deadlines no longer apply.');

  // Scene 10: reload keeps everything.
  await p.reload();
  await expect(p.locator('.wf-wal-item').filter({ hasText: 'HLH-48213' })).toContainText('Received $400.00');
  await p.goto(T);
  await expect(p.getByText('You chose to cancel. We recorded 4 cancellations.')).toBeVisible();
  expect(errors).toEqual([]);
});
