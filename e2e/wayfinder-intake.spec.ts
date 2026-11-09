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
  test('Wayfinder: preference changes re-rank; over-budget, unknown-price, invalid-date and unsupported inputs block selection', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${TRIP}/plan`);
    // The comparison for the trip's sample route is shown on arrival, as in the design reference.
    await expect(cards(page)).toHaveCount(3);
    await expect(cards(page).last()).toContainText('$1,010 + ?');
    await expect(cards(page).last()).toContainText('A price is still unknown');
    await expect(cards(page).last().getByRole('button', { name: 'Choose this plan' })).toBeDisabled();
    expect(await columns(page, '.wf-plan-options')).toBe(3);

    // "What matters most" re-ranks through the same generator.
    await page.getByRole('group', { name: 'What matters most' }).getByRole('button', { name: 'Convenience' }).click();
    await expect(cards(page).first()).toContainText('Nonstop + Midtown hotel');
    await expect(cards(page).first()).toContainText('Most convenient');

    // Dropping the paid activity changes totals; over-budget plans cannot be selected.
    await page.getByRole('group', { name: 'What matters most' }).getByRole('button', { name: 'Price' }).click();
    await page.getByRole('group', { name: 'Saturday morning' }).getByRole('button', { name: 'Free time' }).click();
    await page.getByLabel('Budget').fill('800');
    await expect(cards(page).first()).toContainText('$735');
    await expect(cards(page).first().getByRole('button', { name: 'Choose this plan' })).toBeEnabled();
    await expect(cards(page).nth(1)).toContainText('over budget');
    await expect(cards(page).nth(1).getByRole('button', { name: 'Choose this plan' })).toBeDisabled();

    // Invalid dates are refused in the picker; the shown results stay.
    await page.getByRole('button', { name: /Nov 20 – 23/ }).click();
    const dates = page.getByRole('dialog', { name: 'Dates' });
    await dates.getByLabel('Return').fill('2026-11-19');
    await dates.getByRole('button', { name: 'Done' }).click();
    await expect(dates.getByRole('alert')).toContainText('The return date must be after the leave date.');
    await page.keyboard.press('Escape');
    await expect(cards(page).first()).toContainText('$735');

    // Unsupported destination is an explicit error, not invented candidates.
    await page.getByRole('button', { name: /San Francisco → New York/ }).click();
    const route = page.getByRole('dialog', { name: 'Route' });
    await route.getByLabel('Destination').fill('Paris');
    await route.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('alert')).toContainText('No sample candidates match');
    await page.getByRole('button', { name: /San Francisco → Paris/ }).click();
    await expect(route.getByLabel('Destination')).toHaveAttribute('aria-invalid', 'true');
    await route.getByRole('button', { name: 'Use supported sample' }).click();
    await route.getByRole('button', { name: 'Done' }).click();
    await expect(cards(page)).toHaveCount(3);

    // Selection state is visible on the chosen card.
    const nonstop = cards(page).filter({ hasText: 'Nonstop + Midtown hotel' });
    await nonstop.getByRole('button', { name: 'Choose this plan' }).click();
    await expect(nonstop).toHaveAttribute('data-selected', 'true');
    await expect(nonstop.getByRole('button', { name: 'Selected plan' })).toHaveAttribute('data-variant', 'secondary');
    await expect(nonstop).toContainText('Saved to your trip. Nothing is booked or paid until you confirm.');
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
    const currency = review.getByLabel('Currency');
    await currency.fill('EUR');
    await expect(currency).toHaveAttribute('aria-invalid', 'true');
    await expect(save).toBeDisabled();
    await currency.fill('USD');

    const start = review.getByLabel('Starts');
    const validStart = await start.inputValue();
    // Times are reviewed as local wall time in the booking's zone (check-in 3:00 PM New York).
    expect(validStart).toBe('2026-11-20T15:00');
    // An end before the start is rejected.
    const end = review.getByLabel('Ends');
    const validEnd = await end.inputValue();
    await end.fill('2026-11-19T10:00');
    await expect(end).toHaveAttribute('aria-invalid', 'true');
    await end.fill(validEnd);
    // A blank start is rejected.
    await start.fill('');
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
    await review.getByLabel('Amount paid').fill('');
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
    await expect(cards(page)).toHaveCount(3);
    // r2-final: 3-up at full width, 2-up below 1000 px, 1-up below 760 px.
    for (const width of [1440, 1023, 999, 768, 759, 390, 360, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await overflow(page), `plan overflow at ${width}px`).toBeLessThanOrEqual(0);
      expect(await columns(page, '.wf-plan-options'), `plan columns at ${width}px`).toBe(width < 760 ? 1 : width < 1000 ? 2 : 3);
    }
    await page.locator('.wf-plan-options details').first().evaluate((el) => { (el as HTMLDetailsElement).open = true; });
    expect(await overflow(page), 'expanded cost sources at 320px').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
