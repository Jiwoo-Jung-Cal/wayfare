// Agent 2's bounded r1-draft browser verification. Starts a sample-only Vite server.
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
const screenshot = async (page, name) => { if (output) await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true }); };

try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {}),
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
    args: ['--disable-dev-shm-usage', '--disable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}${trip}/plan`);
  await button(page, 'Generate options').click();
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).first()).toContainText('$815.00');
  await expect(cards(page).last()).toContainText('Known subtotal: $1,010.00');
  await expect(cards(page).last().getByRole('button')).toBeDisabled();
  expect(await columns(page, '.wf-plan-route-fields')).toBe(4);
  expect(await columns(page, '.wf-plan-choice-fields')).toBe(3);
  expect(await columns(page, '.wf-plan-options')).toBe(3);
  await screenshot(page, 'wayfinder-desktop');

  await page.getByLabel(/^Prioritize/).selectOption('convenience');
  await expect(page.getByText(/Preferences changed/)).toBeVisible();
  await expect(cards(page).first().getByRole('button')).toBeDisabled();
  await button(page, 'Regenerate options').click();
  await expect(cards(page).first()).toContainText('Nonstop + Midtown hotel');
  await page.getByLabel(/^Prioritize/).selectOption('price');
  await page.getByLabel(/^Interest/).selectOption('free_time');
  await page.getByLabel(/^Budget for listed components/).fill('800');
  await button(page, 'Regenerate options').click();
  await expect(cards(page).first()).toContainText('$735.00');
  await expect(cards(page).first().getByRole('button')).toBeEnabled();
  await expect(cards(page).nth(1)).toContainText('Over component budget');
  await expect(cards(page).nth(1).getByRole('button')).toBeDisabled();
  await page.getByLabel(/^End date/).fill('2026-11-19');
  await button(page, 'Regenerate options').click();
  await expect(page.getByLabel(/^End date/)).toHaveAttribute('aria-invalid', 'true');
  await expect(cards(page).first()).toContainText('$735.00');
  await expect(cards(page).first().getByRole('button')).toBeDisabled();
  await button(page, 'Use supported sample').click();
  await page.getByLabel(/^Destination/).fill('Paris');
  await button(page, 'Regenerate options').click();
  await expect(page.getByRole('alert')).toContainText('No sample candidates match');
  await expect(page.getByLabel(/^Destination/)).toHaveAttribute('aria-invalid', 'true');
  await button(page, 'Use supported sample').click();
  await button(page, 'Regenerate options').click();
  const nonstop = cards(page).nth(1);
  await nonstop.getByRole('button').click();
  await expect(page.getByRole('status').filter({ hasText: 'Plan saved.' })).toBeVisible();
  await expect(nonstop).toHaveAttribute('data-selected', 'true');
  await expect(nonstop.getByRole('button')).toHaveAttribute('data-variant', 'secondary');
  await button(page, 'Selected plan').click();
  await expect(page.getByRole('status').filter({ hasText: 'already selected' })).toBeVisible();
  await page.reload();
  await expect(card(page, 'Saved selected plan')).toContainText('Nonstop + Midtown hotel');
  await page.goto(`${base}${trip}`);
  await expect(page.getByText(/No confirmed bookings yet/)).toBeVisible();

  await page.goto(`${base}${trip}/import`);
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
  await button(page, 'Generate options').click();
  for (const width of [1440, 1023, 768, 767, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await overflow(page), `plan overflow at ${width}`).toBeLessThanOrEqual(0);
    expect(await columns(page, '.wf-plan-options')).toBe(width < 768 ? 1 : 3);
  }
  await page.locator('.wf-plan-breakdowns details').first().evaluate(el => { el.open = true; });
  expect(await overflow(page), 'expanded cost sources at 320').toBeLessThanOrEqual(0);
  await screenshot(page, 'wayfinder-mobile');

  // A separate workspace verifies unknown price and disputed policy survive save/reload.
  const other = await browser.newPage();
  other.on('pageerror', e => errors.push(e.message));
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
  expect(errors).toEqual([]);
  console.log('PASS: r1-draft comparison, preference changes, stale/invalid/unknown/over-budget states, selection/replay/reload; intake field validation, evidence/original source, edits, save/replay/reload, Start over, preserved errors, unknown money/policy; populated 1440/1023/768/767/390/360/320px layouts; narrow mode notice before review and original document after; no page errors.');
} finally {
  await browser?.close();
  await server.close();
}
