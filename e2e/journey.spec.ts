// Integrated demo journey, driven through the real UI (sample mode).
// Shell, Wayfinder, intake and TripWallet steps run now. ReRoute approval
// remains test.fixme until its module is delivered (#6).

import { expect, test, type Page } from '@playwright/test';

const TRIP = '/#/trips/trip-demo-nyc';

const control = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
// Bookings and their deadlines are listed in the Itinerary (design r2-final); open it first.
const ITIN = `${TRIP}/itinerary`;
const bookingRows = (page: Page) => page.locator('.wf-row-b');
const row = (page: Page, text: string) => bookingRows(page).filter({ hasText: text });
/** The hotel's own deadline line in the Itinerary: "… · 30h 00m left" while open, "… · passed" after. */
const hotelDeadline = (page: Page) => row(page, 'Harbor Line Hotel Midtown').locator('.wf-dlx');
const cancelledNote = (page: Page) => page.getByText('Bayline Air cancelled your flight. You don’t need to call anyone.');
const statusMessage = (page: Page) => page.locator('[aria-live="polite"]').filter({ hasText: /\w/ }).last();

test.describe('demo journey: shell steps', () => {
  test('load, import (no duplicates), disrupt, deadline boundary, reload, reset', async ({ page }) => {
    await page.goto(TRIP);
    await expect(page.getByRole('heading', { level: 1, name: 'NY Trip' })).toBeVisible();
    // Capability labels live in the footer, as in the design reference.
    const footer = page.locator('footer.wf-footer');
    await expect(footer).toContainText('sample trip with fictional providers, saved in this browser');
    await expect(footer).toContainText('every provider action is simulated');
    await expect(footer).toContainText('AI extraction is simulated');
    await expect(page.getByText(/No confirmed bookings yet/)).toBeVisible();

    // Import the four reviewed sample bookings; a repeat import must not duplicate.
    await page.goto(ITIN);
    await control(page, 'Import sample bookings').click();
    await expect(statusMessage(page)).toHaveText('Saved 4 reviewed sample bookings.');
    await expect(bookingRows(page)).toHaveCount(4);
    await control(page, 'Import sample bookings').click();
    await expect(statusMessage(page)).toHaveText('Sample bookings were already imported; nothing duplicated.');
    await expect(bookingRows(page)).toHaveCount(4);
    for (const [title, amount] of [['BL 214', '$320.00'], ['Harbor Line Hotel Midtown', '$450.00'], ['Skyline Walk', '$80.00'], ['transfer', '$50.00']]) {
      await expect(row(page, title!)).toContainText(amount!);
    }

    // Simulated outbound cancellation: the airline owes the fare; the Overview says what happened.
    await control(page, 'Trigger flight cancellation').click();
    await expect(row(page, 'BL 214')).toContainText('No deadline · the airline owes you +$320');
    await page.goto(TRIP);
    await expect(cancelledNote(page)).toBeVisible();

    // Frozen boundary: open one second before, passed exactly at 2026-11-19T23:00:00Z.
    await page.goto(ITIN);
    await control(page, '1 s before hotel deadline').click();
    await expect(page.getByLabel('Active clock')).toContainText('2026-11-19T22:59:59Z');
    await expect(hotelDeadline(page)).toContainText('+$400 → +$200 · 0h 00m left');
    await control(page, 'At hotel deadline').click();
    await expect(page.getByLabel('Active clock')).toContainText('2026-11-19T23:00:00Z');
    await expect(hotelDeadline(page)).toContainText('passed');

    // Reload: state, clock and boundary persist.
    await page.reload();
    await expect(bookingRows(page)).toHaveCount(4);
    await expect(page.getByLabel('Active clock')).toContainText('2026-11-19T23:00:00Z');
    await expect(hotelDeadline(page)).toContainText('passed');
    await page.goto(TRIP);
    await expect(cancelledNote(page)).toBeVisible();

    // Reset affects only this workspace and asks for confirmation first.
    page.once('dialog', (d) => d.accept());
    await control(page, 'Clear workspace').click();
    await page.goto('/');
    await expect(page.getByText('No trips yet')).toBeVisible();
  });

  test('wallet load runs the claim-sync handoff and reports its state in words', async ({ page }) => {
    await page.goto(`${TRIP}/wallet`);
    await expect(page.getByRole('heading', { level: 1, name: 'TripWallet', exact: true })).toBeVisible();
    await expect(page.getByText(/Refund claims up to date/)).toBeVisible();
    await page.goto(TRIP);
    await expect(page.getByText(/Refund claims up to date/)).toBeVisible();
  });

  test('keyboard: skip link and main navigation are reachable', async ({ page }) => {
    await page.goto(TRIP);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'ReRoute' })).toBeVisible();
  });

  test('r2 type scale renders at token size: root 16px, body 15px Figtree, H1 35px, 1140px content at 1440px', async ({ page }) => {
    // Every token is in rem; a non-default root font size silently rescales all of them (#4 comment 6587211156).
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(TRIP);
    const h1 = page.getByRole('heading', { level: 1, name: 'NY Trip' });
    await expect(h1).toBeVisible();
    const style = (selector: string, prop: 'fontSize' | 'fontFamily') => page.locator(selector).first().evaluate((el, p) => getComputedStyle(el)[p], prop);
    expect(await style('html', 'fontSize')).toBe('16px');
    expect(await style('body', 'fontSize')).toBe('15px');
    expect(await style('body', 'fontFamily')).toMatch(/^Figtree/);
    expect(await h1.evaluate((el) => getComputedStyle(el).fontSize)).toBe('35px');
    const contentWidth = await page.locator('#wf-content').evaluate((el) => {
      const s = getComputedStyle(el);
      return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    });
    expect(contentWidth).toBe(1140);
  });

  test('colour mode: the sun/moon toggle switches light and dark, and the choice survives reload', async ({ page }) => {
    await page.goto(TRIP);
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const mode = page.getByRole('group', { name: 'Colour mode' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await bg()).toBe('rgb(255, 255, 255)');
    await mode.getByRole('button', { name: 'Dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(mode.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(bg).toBe('rgb(18, 19, 20)');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await mode.getByRole('button', { name: 'Light mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('@mobile narrow layout has no horizontal scroll', async ({ page }) => {
    await page.goto(ITIN);
    await control(page, 'Import sample bookings').click();
    await expect(bookingRows(page)).toHaveCount(4);
    await expectNoOverflow(page, ['', 'itinerary', 'reroute', 'wallet']);
  });
});

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** Checks each route at the device width and at 360/320 px, so the result does not depend on platform fonts. */
async function expectNoOverflow(page: Page, routes: string[]) {
  const deviceWidth = page.viewportSize()?.width ?? 412;
  for (const width of [deviceWidth, 360, 320]) {
    await page.setViewportSize({ width, height: page.viewportSize()?.height ?? 900 });
    for (const route of routes) {
      await page.goto(route ? `${TRIP}/${route}` : TRIP);
      // Feature pages render an h1; unregistered feature routes render a titled placeholder.
      await expect(page.locator('#wf-content').locator('h1, .wf-alert strong').first()).toBeVisible();
      expect(await horizontalOverflow(page), `/${route} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
}
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

    await page.goto(ITIN);
    await expect(bookingRows(page)).toHaveCount(1);
    await expect(row(page, 'Harbor Line Hotel Midtown')).toContainText('$450.00');
    await expect(hotelDeadline(page)).toContainText('left');

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
    await expectNoOverflow(page, ['plan', 'import']);
  });
});

/** Reads this visitor's stored workspace through the shared repository (assertions only; never writes). */
async function storedWorkspace(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/core/index.ts';
    const core = await import(/* @vite-ignore */ path) as typeof import('../src/core/index.ts');
    const repo = core.createLocalRepository({ storage: localStorage, workspaceId: localStorage.getItem(core.ACTIVE_WORKSPACE_KEY)! });
    const s = core.unwrap(await repo.snapshot());
    const cash = (xs: { amountMinor?: number }[]) => xs.reduce((n, m) => n + (m.amountMinor ?? Number.NaN), 0);
    return {
      actions: s.actions.length,
      claims: s.claims.length,
      receipts: s.receipts.length,
      expectedMinor: cash(s.claims.map((c) => c.expected as { amountMinor?: number })),
      hotelExpectedMinor: (s.claims.find((c) => c.bookingId === core.DEMO_IDS.bookings.hotel)?.expected as { amountMinor?: number } | undefined)?.amountMinor,
      bookingStates: s.bookings.map((b) => b.state).sort(),
    };
  });
}

/** Dashboard → demo controls → ReRoute: real imports and the ReRoute-owned disruption trigger. */
async function startReRoute(page: Page) {
  await page.goto(TRIP);
  await control(page, 'Import sample bookings').click();
  await expect(statusMessage(page)).toHaveText('Saved 4 reviewed sample bookings.');
  await control(page, 'Trigger flight cancellation').click();
  await expect(cancelledNote(page)).toBeVisible();
  await page.getByRole('link', { name: 'See what to do' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'ReRoute' })).toBeVisible();
}

async function approveCancelTrip(page: Page) {
  await control(page, 'Review cancel-trip actions').click();
  const dialog = page.getByRole('dialog');
  await expect(control(page, 'Approve actions')).toBeDisabled();
  await dialog.getByLabel('I understand these are simulated actions').check();
  await control(page, 'Approve actions').click();
  await expect(card(page, 'Simulated actions recorded')).toContainText('4 recorded; 0 unfinished.');
}

test.describe('demo journey: ReRoute approval to TripWallet (Agents 4 and 5, #6/#7)', () => {
  test.describe.configure({ retries: 0 });

  test('approve cancel-trip in ReRoute before the hotel deadline; the shell syncs $820 of claims into TripWallet and the dashboard', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await startReRoute(page);
    await expect(card(page, 'Cancel the trip')).toContainText('$820.00');
    await approveCancelTrip(page);
    // The shell, not ReRoute, created the claims; the claim-sync status reports it in words.
    // Sync runs after each recorded action, so the last run's split varies; the total is fixed.
    await expect(page.getByRole('status').filter({ hasText: /Refund claims up to date \(\d created, \d already tracked\)/ })).toBeVisible();
    await expect.poll(async () => (await storedWorkspace(page)).claims).toBe(4);
    expect(await storedWorkspace(page)).toMatchObject({
      actions: 4, claims: 4, receipts: 0, expectedMinor: 82000, hotelExpectedMinor: 40000,
      bookingStates: ['cancelled', 'cancelled', 'cancelled', 'cancelled'],
    });

    // ReRoute's own link must stay inside this trip (route-relative links once resolved to /#/).
    await page.getByRole('main').getByRole('link', { name: 'Open TripWallet' }).click();
    await expect(page).toHaveURL(/#\/trips\/trip-demo-nyc\/wallet$/);
    await expect(page.getByRole('heading', { level: 1, name: 'TripWallet', exact: true })).toBeVisible();
    await expect(card(page, 'Harbor Line Hotel Midtown')).toContainText('$400.00');

    // The Overview reports the recorded choice; the Itinerary shows every booking cancelled.
    await page.goto(TRIP);
    await expect(page.getByText('You chose to cancel. We recorded 4 cancellations.')).toBeVisible();
    await expect(page.locator('.wf-money-tiles')).toContainText('+$820');
    await page.goto(ITIN);
    await expect(bookingRows(page)).toHaveCount(4);
    for (const r of await bookingRows(page).all()) await expect(r).toContainText('Cancelled');
    expect(errors).toEqual([]);
  });

  test('at the hotel cutoff the shared clock gives $620; completed state survives reload; repeat approval, trigger and receipt import do not double records', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await startReRoute(page);
    // Shared demo clock exactly at the exclusive cutoff: hotel falls to the $200 tier.
    await control(page, 'At hotel deadline').click();
    await expect(page.getByLabel('Active clock')).toContainText('2026-11-19T23:00:00Z');
    await expect(card(page, 'Cancel the trip')).toContainText('$620.00');
    await approveCancelTrip(page);
    await expect.poll(async () => (await storedWorkspace(page)).claims).toBe(4);
    expect(await storedWorkspace(page)).toMatchObject({ actions: 4, expectedMinor: 62000, hotelExpectedMinor: 20000 });

    // Reload: recorded state persists and approval cannot run again.
    await page.reload();
    await expect(card(page, 'Recorded actions')).toContainText('Harbor Line Hotel');
    await expect(control(page, 'Review cancel-trip actions')).toBeDisabled();
    // Re-triggering the disruption from the dashboard is a no-op.
    await page.goto(TRIP);
    await control(page, 'Trigger flight cancellation').click();
    await expect(cancelledNote(page)).toHaveCount(1);

    // Wallet load re-runs claim sync (idempotent); importing the same receipt twice stores it once.
    await page.goto(`${TRIP}/wallet`);
    await expect(page.getByRole('status').filter({ hasText: '0 created, 4 already tracked' })).toBeVisible();
    for (let i = 0; i < 2; i++) {
      await control(page, 'Load sample $150 receipt').click();
      await control(page, 'Confirm reviewed evidence').click();
      await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
    }
    await page.reload();
    expect(await storedWorkspace(page)).toMatchObject({ actions: 4, claims: 4, receipts: 1, expectedMinor: 62000 });
    expect(errors).toEqual([]);
  });
});

test.describe('TripWallet integration', () => {
  test.describe.configure({ retries: 0 });

  test('canonical action fixtures sync; hotel receipts reconcile through the real controls', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(TRIP);
    await expect(page.getByRole('heading', { level: 1, name: 'NY Trip' })).toBeVisible();
    // ReRoute's UI is not delivered. Seed only its canonical durable output;
    // wallet-load sync, evidence review and every receipt operation use real UI.
    await page.evaluate(async () => {
      const path = '/src/core/index.ts';
      const core = await import(/* @vite-ignore */ path) as typeof import('../src/core/index.ts');
      const workspaceId = localStorage.getItem(core.ACTIVE_WORKSPACE_KEY)!;
      const repo = core.createLocalRepository({ storage: localStorage, workspaceId });
      core.unwrap(await repo.resetDemo('booked'));
      const fx = { workspaceId, now: core.DEMO_TIMES.clockStart };
      core.unwrap(await repo.putDocument(await core.demoDocument(fx, core.DEMO_IDS.documents.disruptionNotice)));
      core.unwrap(await repo.recordDisruption(core.demoDisruption(fx)));
      for (const action of core.demoCancelTripActions(fx)) core.unwrap(await repo.recordBookingAction({ action, expectedBookingRevision: 1 }));
    });
    await page.goto(`${TRIP}/wallet`);
    const hotel = card(page, 'Harbor Line Hotel Midtown');
    await expect(hotel).toContainText('$400.00');
    await control(page, 'Load sample refund confirmation').click();
    const claimSelect = page.getByRole('combobox', { name: /^Claim to confirm/ });
    const hotelId = await claimSelect.locator('option').filter({ hasText: 'HLH-48213' }).getAttribute('value');
    expect(hotelId).toBeTruthy();
    await claimSelect.selectOption(hotelId!);
    await control(page, 'Confirm reviewed evidence').click();
    await expect(hotel).toContainText('provider confirmed');
    for (const [amount, reference, state] of [['250', 'HLH-RF-0001', 'partially received'], ['150', 'HLH-RF-0002', 'received']]) {
      await control(page, `Load sample $${amount} receipt`).click();
      await control(page, 'Confirm reviewed evidence').click();
      await page.getByRole('combobox', { name: new RegExp(`^Claim for receipt ${reference}\\b`) }).selectOption(hotelId!);
      await control(page, `Match receipt ${reference}`).click();
      await expect(hotel).toContainText(state!);
      if (amount === '250') {
        await expect(hotel).toContainText('Outstanding $150.00');
        await control(page, 'Prepare follow-up draft for HLH-48213').click();
        await expect(page.getByLabel('Editable follow-up draft')).toHaveValue(/Outstanding: \$150.00/);
      }
    }
    await expect(hotel).toContainText('Outstanding $0.00');
    await control(page, 'Load sample $250 receipt').click();
    await control(page, 'Confirm reviewed evidence').click();
    await page.reload();
    await expect(hotel).toContainText('Received $400.00');
    await expect(hotel).toContainText('Outstanding $0.00');
    await expect(page.getByText('8,000 points (Harbor Line Rewards)')).toBeVisible();
    // A populated wallet exercises long claim IDs, capability labels and evidence.
    for (const width of [390, 360, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole('heading', { level: 1, name: 'TripWallet', exact: true })).toBeVisible();
      expect(await horizontalOverflow(page), `reconciled wallet at ${width}px`).toBeLessThanOrEqual(0);
    }
    await hotel.getByText('Action, evidence and allocation history', { exact: true }).click();
    await expect(hotel.locator('details').first()).toHaveAttribute('open', '');
    expect(await horizontalOverflow(page), 'expanded evidence at 320px').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
