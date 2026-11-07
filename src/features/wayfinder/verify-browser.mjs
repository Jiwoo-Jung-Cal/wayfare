// Agent 2's bounded r2-final browser verification. Starts a sample-only Vite server.
// node src/features/wayfinder/verify-browser.mjs
// Optional: PW_EXECUTABLE_PATH, PW_CHANNEL, WAYFARE_VERIFY_OUTPUT (screenshots).
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

process.env.VITE_WAYFARE_API_URL = ''; // No model calls or credentials in this check.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false } });
await server.listen();
const base = server.resolvedUrls.local[0];
const output = process.env.WAYFARE_VERIFY_OUTPUT;
if (output) await mkdir(output, { recursive: true });
let browser;
const errors = [];
const button = (page, name) => page.getByRole('button', { name, exact: true });
const card = (page, title) => page.locator('.wf-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const cards = (page) => page.getByRole('region', { name: 'Plan comparison' }).getByRole('article');
const trip = '#/trips/trip-demo-nyc';
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const columns = (page, selector) => page.locator(selector).evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
const screenshot = async (page, name) => {
  if (!output) return;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true, animations: 'disabled' });
};
const snapshot = (page) => page.evaluate(async () => {
  const path = '/src/core/index.ts';
  const core = await import(path);
  const repo = core.createLocalRepository({ storage: localStorage, workspaceId: localStorage.getItem(core.ACTIVE_WORKSPACE_KEY) });
  const result = await repo.snapshot();
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
});

try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {}),
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
    args: ['--disable-dev-shm-usage', '--disable-webgl'],
  });
  const observe = (page) => {
    page.setDefaultTimeout(10_000);
    page.on('pageerror', e => errors.push(e.message));
    return page;
  };
  const planningPage = async () => {
    const page = observe(await browser.newPage({ viewport: { width: 1440, height: 1000 } }));
    // An explicit QA seed keeps selection/import tests separate from the booked
    // first-visit scenario. Never reset an existing visitor's workspace.
    await page.addInitScript(() => {
      if (!localStorage.getItem('wayfare:v1:active-workspace')) {
        localStorage.setItem('wayfare:v1:first-stage', 'planning');
      }
    });
    return page;
  };
  const openRoute = async (page) => {
    await page.getByRole('button', { name: /→/ }).click();
    return page.getByRole('dialog', { name: 'Route', exact: true });
  };
  const supportedSample = async (page) => {
    const route = await openRoute(page);
    await button(route, 'Use supported sample').click();
    await button(route, 'Done').click();
    await expect(page.getByText('Preferences changed.', { exact: false })).toHaveCount(0);
    await expect(cards(page)).toHaveCount(3);
  };
  const choose = (plan) => plan.getByRole('button', { name: /^(Choose this plan|Selected plan)$/ });

  // Default startup is now a booked sample, with automatic comparison and a
  // working "View your trip" link. No obsolete Generate-options click is needed.
  const booked = observe(await browser.newPage({ viewport: { width: 1440, height: 1000 } }));
  await booked.goto(`${base}${trip}/plan`);
  await expect(cards(booked)).toHaveCount(3);
  const current = cards(booked).filter({ has: booked.getByRole('heading', { name: 'Nonstop + Midtown hotel', exact: true }) });
  await expect(current).toContainText('Your current trip');
  await expect(current).toContainText('· BOOKED');
  await current.getByRole('link', { name: 'View your trip', exact: true }).click();
  await expect(booked).toHaveURL(new RegExp(`${trip}$`));
  await expect(booked.getByRole('heading', { name: 'NY Trip', exact: true, level: 1 })).toBeVisible();
  // Plan's message styles must not turn shared Ask bubbles into flex columns.
  await expect(booked.locator('.wf-money-tiles')).toContainText('+$820');
  await button(booked, 'Ask WayFare').click();
  const assistantPanel = booked.getByRole('region', { name: 'WayFare assistant' });
  await button(assistantPanel, 'How much will I get back?').click();
  const refundReply = assistantPanel.locator('.wf-msg[data-who="ai"]').last();
  await expect(refundReply).toContainText('That’s +$820 back');
  await expect(refundReply).toHaveCSS('display', 'block');
  for (const width of [1440, 390, 320]) {
    await booked.setViewportSize({ width, height: 1000 });
    expect(await refundReply.evaluate(el => el.scrollWidth - el.clientWidth), `Ask refund reply overflow after Plan at ${width}`).toBeLessThanOrEqual(1);
  }
  await booked.close();

  const page = await planningPage();
  await page.goto(`${base}${trip}/plan`);
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).first()).toContainText('$815');
  await expect(cards(page).last()).toContainText('$1,010 + ?');
  await expect(cards(page).last()).toContainText('A price is still unknown');
  await expect(choose(cards(page).last())).toBeDisabled();
  expect(await columns(page, '.wf-plan-options')).toBe(3);
  await cards(page).last().locator('summary').click();
  await expect(cards(page).last()).toContainText('Known so far');
  await expect(cards(page).last()).toContainText('No quote received yet');
  await expect(cards(page).last()).toContainText('Not quoted');
  await expect(cards(page).last()).not.toContainText('$0');
  await screenshot(page, 'wayfinder-desktop');

  // Invalid drafts must not leave selectable plans priced against an old budget.
  const budget = page.getByLabel('Budget', { exact: true });
  for (const value of ['', '0', '-1000', '800.', '1.234', '999999999999999999999999']) {
    await budget.fill(value);
    await expect(budget).toHaveValue(value);
    await expect(budget).toHaveAttribute('aria-invalid', 'true');
    await expect(choose(cards(page).first())).toBeDisabled();
    await expect(cards(page).first()).toContainText('$815');
    await budget.fill('1000');
    await expect(budget).toHaveAttribute('aria-invalid', 'false');
    await expect(choose(cards(page).first())).toBeEnabled();
  }
  await budget.fill('814.99');
  await expect(cards(page).first()).toContainText('$0.01 over budget');
  await expect(choose(cards(page).first())).toBeDisabled();
  await budget.fill('1000.05');
  await expect(cards(page).first()).toContainText('$185.05 under budget');
  await expect(choose(cards(page).first())).toBeEnabled();
  await budget.fill('1000');

  const priority = page.getByRole('group', { name: 'What matters most', exact: true });
  await button(priority, 'Convenience').click();
  await expect(cards(page).first()).toContainText('Nonstop + Midtown hotel');
  await expect(cards(page).first()).toContainText('Most convenient');
  await button(priority, 'Flexibility').click();
  await expect(cards(page).first()).toContainText('Refundable fare + flexible hotel');
  await expect(choose(cards(page).first())).toBeDisabled();
  await button(priority, 'Price').click();
  await button(page.getByRole('group', { name: 'Saturday morning' }), 'Free time').click();
  await budget.fill('800');
  await expect(cards(page).first()).toContainText('$735');
  await expect(choose(cards(page).first())).toBeEnabled();
  await expect(cards(page).nth(1)).toContainText('over budget');
  await expect(choose(cards(page).nth(1))).toBeDisabled();
  await expect(page.locator('.wf-cmp-t tbody tr')).toHaveCount(3);

  // Invalid date drafts are refused; the current valid comparison is retained.
  await page.getByRole('button', { name: /Nov 20 – 23/ }).click();
  const dates = page.getByRole('dialog', { name: 'Dates', exact: true });
  for (const value of ['2026-11-20', '2026-11-19']) {
    await dates.getByLabel('Return', { exact: true }).fill(value);
    await button(dates, 'Done').click();
    await expect(dates.getByRole('alert')).toContainText('The return date must be after the leave date.');
  }
  await page.keyboard.press('Escape');
  await expect(cards(page).first()).toContainText('$735');
  await expect(choose(cards(page).first())).toBeEnabled();

  await page.getByRole('button', { name: /Nov 20 – 23/ }).click();
  await dates.getByLabel('Leave', { exact: true }).fill('2026-11-21');
  await dates.getByLabel('Return', { exact: true }).fill('2026-11-24');
  await button(dates, 'Done').click();
  await expect(page.getByRole('alert')).toContainText('No sample candidates match');
  await expect(choose(cards(page).first())).toBeDisabled();
  await supportedSample(page);

  // Unsupported routes preserve previous results and block selection.
  for (const [label, value] of [['Destination', 'Paris'], ['Origin', 'Los Angeles']]) {
    const route = await openRoute(page);
    await route.getByLabel(label, { exact: true }).fill(value);
    await button(route, 'Done').click();
    await expect(page.getByRole('alert')).toContainText('No sample candidates match');
    await expect(choose(cards(page).first())).toBeDisabled();
    await openRoute(page);
    await expect(route.getByLabel(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await button(route, 'Use supported sample').click();
    await button(route, 'Done').click();
    await expect(choose(cards(page).first())).toBeEnabled();
  }

  // Picker limits work; more travelers re-price the sample quotes as a group (Jiwoo, Nov 7).
  await button(page, '1 traveler').click();
  const travelers = page.getByRole('dialog', { name: 'Travelers', exact: true });
  await expect(button(travelers, 'Fewer adults')).toBeDisabled();
  await expect(button(travelers, 'Fewer children')).toBeDisabled();
  await button(travelers, 'More children').click();
  await button(travelers, 'Done').click();
  await expect(page.locator('.wf-ah')).toContainText('2 travelers (group pricing)');
  await expect(page.locator('.wf-ah')).not.toContainText('the final price updates for your group');
  // Saver for two: flights and walk per person, one room, one shuttle: $580 + $380 + $160 + $65.
  await expect(cards(page).first()).toContainText('$1,185');
  await button(page, '2 travelers').click();
  for (let n = 2; n < 9; n++) await button(travelers, 'More adults').click();
  await expect(button(travelers, 'More adults')).toBeDisabled();
  await expect(button(travelers, 'More children')).toBeDisabled();
  for (let n = 8; n > 1; n--) await button(travelers, 'Fewer adults').click();
  await button(travelers, 'Fewer children').click();
  await expect(button(travelers, 'Fewer adults')).toBeDisabled();
  await expect(button(travelers, 'Fewer children')).toBeDisabled();
  await button(travelers, 'Done').click();
  await expect(button(page, '1 traveler')).toBeVisible();

  // Prompt text cannot silently invent a different destination.
  await page.getByLabel('Describe your trip', { exact: true }).fill('A weekend in Paris');
  await button(page, 'Plan it').click();
  await expect(page.getByRole('log', { name: 'Conversation with WayFare' })).toContainText('I don’t have sample trips for Paris yet');
  await expect(page.locator('.wf-ah')).toContainText('plans for New York');
  await expect(cards(page).first()).toContainText('$815');
  const nonstop = cards(page).filter({ has: page.getByRole('heading', { name: 'Nonstop + Midtown hotel', exact: true }) });
  await choose(nonstop).click();
  await expect(page.getByRole('status').filter({ hasText: 'Plan saved.' })).toBeVisible();
  await expect(nonstop).toHaveAttribute('data-selected', 'true');
  await expect(button(nonstop, 'Selected plan')).toHaveAttribute('data-variant', 'secondary');
  await button(nonstop, 'Selected plan').click();
  await expect(page.getByRole('status').filter({ hasText: 'already selected' })).toBeVisible();
  await page.reload();
  await expect(nonstop).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('.wf-recent')).toContainText('Nonstop + Midtown hotel');
  await expect(page.locator('.wf-recent')).toContainText('nothing booked yet');
  await page.goto(`${base}${trip}`);
  await expect(page.getByText(/No confirmed bookings yet/)).toBeVisible();

  // The composer attach control must navigate to this trip's actual import route.
  await page.goto(`${base}${trip}/plan`);
  await button(page, 'Attach a booking confirmation').click();
  await expect(page).toHaveURL(new RegExp(`${trip}/import$`));
  await button(page, 'Use sample document').click();
  const source = await page.getByLabel('Paste booking confirmation').inputValue();
  await button(page, 'Extract booking').click();
  const review = card(page, 'Review before saving');
  await expect(review).toContainText('High confidence');
  await expect(review).toContainText('Hotel $400 refund deadline');
  await expect(card(page, 'Original document')).toContainText(source);
  await expect(button(page, 'Save reviewed booking')).toBeDisabled();
  await review.getByLabel(/I reviewed the facts and confirm/).check();
  await expect(button(page, 'Save reviewed booking')).toBeEnabled();
  await review.getByLabel('Currency (USD trip)').fill('EUR');
  await expect(review.getByLabel('Currency (USD trip)')).toHaveAttribute('aria-invalid', 'true');
  await expect(button(page, 'Save reviewed booking')).toBeDisabled();
  await review.getByLabel('Currency (USD trip)').fill('USD');
  const start = review.getByLabel('Start (UTC ISO instant)');
  const validStart = await start.inputValue();
  await start.fill('2026-02-30T20:00:00Z');
  await expect(start).toHaveAttribute('aria-invalid', 'true');
  await expect(button(page, 'Save reviewed booking')).toBeDisabled();
  await start.fill(validStart);
  await review.getByLabel('Provider', { exact: true }).fill('');
  await expect(button(page, 'Save reviewed booking')).toBeDisabled();
  await review.getByLabel('Provider', { exact: true }).fill('Harbor Line Hotel Midtown');
  await review.getByLabel('Booking title', { exact: true }).fill('Reviewed hotel stay');
  await expect(button(page, 'Save reviewed booking')).toBeEnabled();
  expect(await columns(page, '.wf-intake-layout')).toBe(2);
  expect(await columns(page, '.wf-intake-review-fields')).toBe(2);
  await screenshot(page, 'intake-desktop');
  await button(page, 'Save reviewed booking').click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved reviewed booking:' })).toBeVisible();
  await button(page, 'Save reviewed booking').click();
  await expect(page.getByRole('status').filter({ hasText: 'Already imported:' })).toBeVisible();
  await page.reload();
  await expect(card(page, 'Saved bookings in this trip')).toContainText('HLH-48213');
  const imported = await snapshot(page);
  expect(imported.bookings).toHaveLength(1);
  expect(imported.bookings[0].title).toBe('Reviewed hotel stay');
  await button(page, 'Use sample document').click();
  await button(page, 'Extract booking').click();
  await review.getByLabel(/I reviewed the facts and confirm/).check();

  for (const width of [1023, 768, 767, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await overflow(page), `review overflow at ${width}`).toBeLessThanOrEqual(0);
    expect(await columns(page, '.wf-intake-review-fields')).toBe(1);
    expect(await columns(page, '.wf-intake-layout')).toBe(1);
    const modeNotice = page.locator('.wf-alert').filter({ has: page.getByText('Sample mode: extraction is simulated', { exact: true }) });
    const noticeBox = await modeNotice.boundingBox();
    const reviewBox = await review.boundingBox();
    const originalBox = await card(page, 'Original document').boundingBox();
    expect(noticeBox).not.toBeNull();
    expect(reviewBox).not.toBeNull();
    expect(originalBox).not.toBeNull();
    expect(noticeBox.y + noticeBox.height, `sample notice must precede review at ${width}px`).toBeLessThanOrEqual(reviewBox.y);
    expect(originalBox.y, `original document stays below review at ${width}px`).toBeGreaterThanOrEqual(reviewBox.y + reviewBox.height);
    if (width < 768) {
      const saveWidth = (await button(page, 'Save reviewed booking').boundingBox()).width;
      const actionsWidth = (await page.locator('.wf-intake-actions').boundingBox()).width;
      expect(Math.abs(saveWidth - actionsWidth)).toBeLessThan(1);
    }
  }
  await screenshot(page, 'intake-mobile');
  await button(page, 'Start over').click();
  await expect(page.getByRole('heading', { name: 'Review before saving', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Paste booking confirmation')).toHaveValue(source);
  const pasted = 'Acme Air confirmation ZZ9 for one traveler, paid $10.00 USD on December 1.';
  await page.getByLabel('Paste booking confirmation').fill(pasted);
  await button(page, 'Extract booking').click();
  await expect(page.getByRole('alert')).toContainText('Live AI extraction is not configured');
  await expect(page.getByLabel('Paste booking confirmation')).toHaveValue(pasted);
  await expect(page.getByLabel('Paste booking confirmation')).toHaveAttribute('aria-invalid', 'true');
  await page.goto(`${base}${trip}/plan`);
  await expect(cards(page)).toHaveCount(3);
  for (const width of [1440, 1024, 1023, 1000, 999, 768, 760, 759, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await overflow(page), `plan overflow at ${width}`).toBeLessThanOrEqual(0);
    expect(await columns(page, '.wf-plan-options')).toBe(width < 760 ? 1 : width < 1000 ? 2 : 3);
    for (const [label, name] of [['Route', /San Francisco → New York/], ['Travelers', '1 traveler'], ['Dates', /Nov 20 – 23/]]) {
      await page.getByRole('button', { name, exact: typeof name === 'string' }).click();
      await expect(page.getByRole('dialog', { name: label, exact: true })).toBeVisible();
      expect(await overflow(page), `${label} picker overflow at ${width}`).toBeLessThanOrEqual(0);
      await page.keyboard.press('Escape');
    }
  }
  await page.locator('.wf-plan-options details').first().evaluate(el => { el.open = true; });
  expect(await overflow(page), 'expanded cost sources at 320').toBeLessThanOrEqual(0);
  await screenshot(page, 'wayfinder-mobile');

  // Both approved color modes retain readable source/review controls.
  await button(page, 'Dark mode').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 19, 20)');
  expect(await overflow(page), 'dark Plan at 320').toBeLessThanOrEqual(0);
  await screenshot(page, 'wayfinder-mobile-dark');
  await button(page, 'Light mode').click();

  // A separate workspace verifies unknown price and disputed policy survive save/reload.
  const other = await planningPage();
  await other.goto(`${base}${trip}/import`);
  await button(other, 'Use sample document').click();
  await button(other, 'Extract booking').click();
  const otherReview = card(other, 'Review before saving');
  await otherReview.getByLabel('Paid amount (blank means unknown)').fill('');
  await otherReview.getByLabel(/Policy terms are uncertain/).check();
  await otherReview.getByLabel(/I reviewed the facts and confirm/).check();
  await button(other, 'Save reviewed booking').click();
  await expect(other.getByRole('status').filter({ hasText: 'Policy still needs review' })).toBeVisible();
  await other.reload();
  await expect(card(other, 'Saved bookings in this trip')).toContainText('Unknown');
  await expect(card(other, 'Saved bookings in this trip')).not.toContainText('$0.00');
  const unknown = await snapshot(other);
  expect(unknown.bookings).toHaveLength(1);
  expect(unknown.bookings[0].paid.unknown).toBe(true);
  const policy = unknown.policies.find(p => p.id === unknown.bookings[0].policyId);
  expect(policy.reviewState).toBe('needs_review');
  expect(policy.refundTiers).toHaveLength(0);
  expect(errors).toEqual([]);
  console.log('PASS: r2-final automatic/booked and unbooked startup; route/date/traveler controls; immediate ranking and budget edits; invalid/unknown/over-budget blocking; group pricing and unsupported-destination replies; selection/replay/reload and Import navigation; intake validation, editable evidence, duplicate/reload, preserved errors and Unknown money/policy; 1440–320px grids, pickers and narrow notice/source order; no page errors.');
} finally {
  await browser?.close();
  await server.close();
}
