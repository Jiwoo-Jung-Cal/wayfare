// Wayfinder and intake states that the integrated journey does not cover.
// Ported from Agent 2's src/features/wayfinder/verify-browser.mjs (#4) so they
// run in CI. Overlapping steps (comparison, selection/replay/reload, hotel
// save/duplicate, malformed/unconfigured input) stay in journey.spec.ts.
// These tests set their own viewport widths, so they run in the desktop project only.

import { expect, test, type Page } from '@playwright/test';

const TRIP = '/#/trips/trip-demo-nyc';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const card = (page: Page, title: string) => page.locator('.wf-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const cards = (page: Page) => page.getByRole('region', { name: 'Plan comparison' }).getByRole('article');
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const columns = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe('Wayfinder and intake states (Agent 2, #4)', () => {
  test('Wayfinder: preference changes re-rank; stale, over-budget, invalid and unsupported inputs block selection', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${TRIP}/plan`);
    await button(page, 'Generate options').click();
    await expect(cards(page)).toHaveCount(3);
    await expect(cards(page).last()).toContainText('Known subtotal: $1,010.00');
    expect(await columns(page, '.wf-plan-route-fields')).toBe(4);
    expect(await columns(page, '.wf-plan-choice-fields')).toBe(3);
    expect(await columns(page, '.wf-plan-options')).toBe(3);

    // Changed preferences make the shown results stale until regenerated.
    await page.getByLabel(/^Prioritize/).selectOption('convenience');
    await expect(page.getByText(/Preferences changed/)).toBeVisible();
    await expect(cards(page).first().getByRole('button')).toBeDisabled();
    await button(page, 'Regenerate options').click();
    await expect(cards(page).first()).toContainText('Nonstop + Midtown hotel');

    // Dropping the paid activity changes totals; over-budget plans cannot be selected.
    await page.getByLabel(/^Prioritize/).selectOption('price');
    await page.getByLabel(/^Interest/).selectOption('free_time');
    await page.getByLabel(/^Budget for listed components/).fill('800');
    await button(page, 'Regenerate options').click();
    await expect(cards(page).first()).toContainText('$735.00');
    await expect(cards(page).first().getByRole('button')).toBeEnabled();
    await expect(cards(page).nth(1)).toContainText('Over component budget');
    await expect(cards(page).nth(1).getByRole('button')).toBeDisabled();

    // Invalid dates keep the previous results visible but not selectable.
    await page.getByLabel(/^End date/).fill('2026-11-19');
    await button(page, 'Regenerate options').click();
    await expect(page.getByLabel(/^End date/)).toHaveAttribute('aria-invalid', 'true');
    await expect(cards(page).first()).toContainText('$735.00');
    await expect(cards(page).first().getByRole('button')).toBeDisabled();

    // Unsupported destination is an explicit error, not invented candidates.
    await button(page, 'Use supported sample').click();
    await page.getByLabel(/^Destination/).fill('Paris');
    await button(page, 'Regenerate options').click();
    await expect(page.getByRole('alert')).toContainText('No sample candidates match');
    await expect(page.getByLabel(/^Destination/)).toHaveAttribute('aria-invalid', 'true');

    // Selection state is visible on the chosen card.
    await button(page, 'Use supported sample').click();
    await button(page, 'Regenerate options').click();
    const nonstop = cards(page).nth(1);
    await nonstop.getByRole('button').click();
    await expect(nonstop).toHaveAttribute('data-selected', 'true');
    await expect(nonstop.getByRole('button')).toHaveAttribute('data-variant', 'secondary');
    expect(errors).toEqual([]);
  });

  test('intake: field validation gates saving; evidence and original source stay visible; Start over keeps the text', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${TRIP}/import`);
    await button(page, 'Use sample document').click();
    const source = await page.getByLabel('Paste booking confirmation').inputValue();
    await button(page, 'Extract booking').click();
    const review = card(page, 'Review before saving');
    await expect(review).toContainText('High confidence');
    await expect(card(page, 'Original document')).toContainText(source);
    expect(await columns(page, '.wf-intake-layout')).toBe(2);
    expect(await columns(page, '.wf-intake-review-fields')).toBe(2);

    const save = button(page, 'Save reviewed booking');
    await expect(save).toBeDisabled();
    await review.getByLabel(/I reviewed the facts and confirm/).check();
    await expect(save).toBeEnabled();

    // Non-USD currency is rejected for this USD trip.
    const currency = review.getByLabel('Currency (USD trip)');
    await currency.fill('EUR');
    await expect(currency).toHaveAttribute('aria-invalid', 'true');
    await expect(save).toBeDisabled();
    await currency.fill('USD');

    // An impossible calendar date is rejected.
    const start = review.getByLabel('Start (UTC ISO instant)');
    const validStart = await start.inputValue();
    await start.fill('2026-02-30T20:00:00Z');
    await expect(start).toHaveAttribute('aria-invalid', 'true');
    await expect(save).toBeDisabled();
    await start.fill(validStart);

    // A required fact cannot be blank.
    const provider = review.getByLabel('Provider', { exact: true });
    await provider.fill('');
    await expect(save).toBeDisabled();
    await provider.fill('Harbor Line Hotel Midtown');
    await expect(save).toBeEnabled();

    await button(page, 'Start over').click();
    await expect(page.getByRole('heading', { name: 'Review before saving', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Paste booking confirmation')).toHaveValue(source);
    expect(errors).toEqual([]);
  });

  test('intake: a blank price and disputed policy save as unknown and survive reload (never $0)', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(`${TRIP}/import`);
    await button(page, 'Use sample document').click();
    await button(page, 'Extract booking').click();
    const review = card(page, 'Review before saving');
    await review.getByLabel('Paid amount (blank means unknown)').fill('');
    await review.getByLabel(/Policy terms are uncertain/).check();
    await review.getByLabel(/I reviewed the facts and confirm/).check();
    await button(page, 'Save reviewed booking').click();
    await expect(page.getByRole('status').filter({ hasText: 'Policy still needs review' })).toBeVisible();
    await page.reload();
    const saved = card(page, 'Saved bookings in this trip');
    await expect(saved).toContainText('Unknown');
    await expect(saved).not.toContainText('$0.00');
    expect(errors).toEqual([]);
  });

  test('populated plan and review layouts reflow at 1440–320 px with no horizontal scroll', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(`${TRIP}/import`);
    await button(page, 'Use sample document').click();
    await button(page, 'Extract booking').click();
    await card(page, 'Review before saving').getByLabel(/I reviewed the facts and confirm/).check();
    for (const width of [1023, 768, 767, 390, 360, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await overflow(page), `review overflow at ${width}px`).toBeLessThanOrEqual(0);
      expect(await columns(page, '.wf-intake-layout'), `intake layout at ${width}px`).toBe(1);
      expect(await columns(page, '.wf-intake-review-fields'), `review fields at ${width}px`).toBe(1);
      if (width < 768) {
        const saveBox = await button(page, 'Save reviewed booking').boundingBox();
        const actionsBox = await page.locator('.wf-intake-actions').boundingBox();
        expect(Math.abs(saveBox!.width - actionsBox!.width), `full-width save at ${width}px`).toBeLessThan(1);
      }
    }

    await page.goto(`${TRIP}/plan`);
    await button(page, 'Generate options').click();
    await expect(cards(page)).toHaveCount(3);
    for (const width of [1440, 1023, 768, 767, 390, 360, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await overflow(page), `plan overflow at ${width}px`).toBeLessThanOrEqual(0);
      expect(await columns(page, '.wf-plan-options'), `plan columns at ${width}px`).toBe(width < 768 ? 1 : 3);
    }
    await page.locator('.wf-plan-breakdowns details').first().evaluate((el) => { (el as HTMLDetailsElement).open = true; });
    expect(await overflow(page), 'expanded cost sources at 320px').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
