// Feature-owned real-control browser journey. Uses installed Chrome on the CI
// runner; skips explicitly when no supported local browser exists. No fixture
// action records are seeded: imports, disruption and approval use actual UI.
import { existsSync, mkdirSync } from 'node:fs';
import { test } from 'vitest';
import { chromium, expect, type Page } from '@playwright/test';
import { createServer } from 'vite';
import { DEMO_EXPECTED as E } from '../../core/index.ts';

const executablePath = process.env.PW_EXECUTABLE_PATH;
const available = !!executablePath || existsSync('/opt/google/chrome/chrome') || existsSync('/usr/bin/google-chrome');
const button = (p: Page, name: string) => p.getByRole('button', { name, exact: true });
const trip = '#/trips/trip-demo-nyc';
const option = (p: Page, name: string) => p.getByRole('radio', { name: new RegExp(`^${name}`) });
const recordedNote = (p: Page) => p.locator('.wf-rr-foot [role=status]');
// Shell test preferences (Agent 1, design parity): start before any booking, with demo controls open.
const prefs = (c: import('@playwright/test').BrowserContext) =>
  c.addInitScript(() => {
    localStorage.setItem('wayfare:v1:first-stage', 'planning');
    localStorage.setItem('wayfare:v1:demo-controls', 'open');
  });

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/core/index.ts';
    const core = await new Function('path', 'return import(path)')(path) as typeof import('../../core/index.ts');
    return core.unwrap(await core.createLocalRepository({ storage: localStorage, workspaceId: localStorage.getItem(core.ACTIVE_WORKSPACE_KEY)! }).snapshot());
  });
}

test.skipIf(!available)('ReRoute actual approval → shell claims → receipts; keyboard, narrow layout, stale preview, partial failure and reload', async () => {
  const server = await createServer({ root: process.cwd(), mode: 'test', server: { host: '127.0.0.1', port: 0 }, define: { 'import.meta.env.VITE_WAYFARE_API_URL': JSON.stringify('') } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : { channel: 'chrome' }), args: ['--no-sandbox'] });
  const errors: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await prefs(context);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  async function start(p: Page) {
    await p.goto(base + trip);
    await button(p, 'Import sample bookings').click();
    await expect(p.getByText('Saved 4 reviewed sample bookings.')).toBeVisible();
    await button(p, 'Trigger flight cancellation').click();
    await expect(p.getByText('Bayline Air cancelled your flight. You don’t need to call anyone.')).toBeVisible();
    await p.goto(base + trip + '/reroute');
    await expect(option(p, 'Cancel the whole trip')).toContainText('+$820');
  }
  try {
    await start(page);
    await expect(option(page, 'Keep the trip')).toContainText('−$360');
    // Hold the chart in place while loading and quote warnings change the layout.
    // This keeps the pointer over the same chart through the real clock refresh.
    const chartPosition = await page.addStyleTag({
      content: '.wf-rr-chart { position: fixed; top: 160px; left: 40px; width: 640px; z-index: 100; }',
    });
    await page.locator('.wf-rr-chart svg rect').hover({ position: { x: 1, y: 25 } });
    const tooltip = page.locator('.wf-rr-tip');
    await expect(tooltip).toContainText('+$820');
    await button(page, 'At hotel deadline').evaluate(el => (el as HTMLButtonElement).click());
    await expect(option(page, 'Cancel the whole trip')).toContainText('+$620');
    await expect(tooltip).toContainText('+$620');
    expect((await snapshot(page)).actions).toHaveLength(0);
    await button(page, 'Reset clock').evaluate(el => (el as HTMLButtonElement).click());
    await expect(option(page, 'Cancel the whole trip')).toContainText('+$820');
    await expect(tooltip).toContainText('+$820');
    await chartPosition.evaluate(el => (el as HTMLStyleElement).remove());
    await page.mouse.move(0, 0);

    const cancelChoice = option(page, 'Cancel the whole trip');
    const keepChoice = option(page, 'Keep the trip');
    await expect(cancelChoice).toHaveAttribute('tabindex', '0');
    await expect(keepChoice).toHaveAttribute('tabindex', '-1');
    await cancelChoice.focus(); await page.keyboard.press('ArrowRight');
    await expect(keepChoice).toBeFocused(); await expect(keepChoice).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(cancelChoice).toBeFocused(); await expect(cancelChoice).toHaveAttribute('aria-checked', 'true');
    await button(page, 'Review and confirm').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(button(page, 'Cancel the trip')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(button(page, 'Review and confirm')).toBeFocused();
    for (const width of [1440, 1023, 1000, 760, 759, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      expect(await page.locator('.wf-reroute-options').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(width < 760 ? 1 : 2);
    }
    // A chart can fit until its pointer tooltip opens near an edge.
    const chart = page.locator('.wf-rr-chart svg');
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await chart.scrollIntoViewIfNeeded();
      const box = (await chart.boundingBox())!;
      for (const x of [0.96, 0.09]) {
        await page.mouse.move(box.x + box.width * x, box.y + box.height * 0.4);
        const tip = page.locator('.wf-rr-tip');
        await expect(tip).toBeVisible();
        const bounds = (await tip.boundingBox())!;
        expect(bounds.x, `tooltip left edge at ${width}px`).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width, `tooltip right edge at ${width}px`).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      }
    }
    await page.mouse.move(0, 0);
    await button(page, 'Review and confirm').click();
    await page.getByLabel('I understand these are simulated actions').check();
    await button(page, 'Cancel the trip').focus(); await page.keyboard.press('Enter');
    await expect(recordedNote(page)).toHaveText('4 cancellations recorded.');
    await expect.poll(async () => (await snapshot(page)).claims.length).toBe(4);
    await expect(page.locator('.wf-rr-mark')).toHaveCount(0);
    const recorded = await snapshot(page);
    expect(recorded.actions.length).toBe(4);
    expect(recorded.claims.reduce((sum, c) => sum + ('amountMinor' in c.expected ? c.expected.amountMinor : NaN), 0)).toBe(E.cancelTripOption.expectedCashRecovery.amountMinor);
    await page.reload();
    await expect(recordedNote(page)).toHaveText('4 cancellations recorded.');
    await expect(button(page, 'Trip cancelled')).toBeDisabled();
    await page.getByRole('link', { name: 'Open TripWallet' }).click();
    await expect(page).toHaveURL(new RegExp(trip + '/wallet$'));
    await expect(page.getByRole('heading', { name: 'TripWallet', exact: true })).toBeVisible();
    const hotel = page.locator('.wf-wal-item').filter({ hasText: 'HLH-48213' });
    await expect(hotel).toContainText('$400.00');
    await page.locator('details.wf-wal-add summary').click();
    await button(page, 'Load sample refund confirmation').click();
    const select = page.getByRole('combobox', { name: /^Claim to confirm/ });
    const hotelId = await select.locator('option').filter({ hasText: 'HLH-48213' }).getAttribute('value');
    await select.selectOption(hotelId!);
    await button(page, 'Confirm reviewed evidence').click();
    for (const [amount, reference, after] of [['250', 'HLH-RF-0001', 'Received $250.00 · $150.00 outstanding'], ['150', 'HLH-RF-0002', 'Received $400.00']]) {
      await button(page, `Load sample $${amount} receipt`).click();
      await button(page, 'Confirm reviewed evidence').click();
      await page.getByRole('combobox', { name: new RegExp(`^Claim for receipt ${reference}\\b`) }).selectOption(hotelId!);
      await button(page, `Match receipt ${reference}`).click();
      await expect(hotel).toContainText(after!);
    }
    await page.reload(); await expect(hotel).toContainText('Received $400.00'); await expect(hotel).toContainText('100%');
    const finished = await snapshot(page);
    expect(finished.claims.length).toBe(4); expect(finished.receipts.length).toBe(2);
    expect(finished.claims.reduce((sum, c) => sum + ('amountMinor' in c.outstanding ? c.outstanding.amountMinor : NaN), 0)).toBe(E.cancelTripOption.expectedCashRecovery.amountMinor - E.hotelClaim.expected.amountMinor);

    // Separate visitor: another tab advances the clock while approval is open.
    const staleContext = await browser.newContext(); await prefs(staleContext); const stale = await staleContext.newPage();
    stale.on('pageerror', e => errors.push(e.message)); await start(stale);
    await button(stale, 'Review and confirm').click();
    await stale.getByLabel('I understand these are simulated actions').check();
    await stale.evaluate(async () => {
      const path = '/src/core/index.ts'; const c = await new Function('path', 'return import(path)')(path) as typeof import('../../core/index.ts');
      c.unwrap(await c.createLocalRepository({ storage: localStorage, workspaceId: localStorage.getItem(c.ACTIVE_WORKSPACE_KEY)! }).setClock({ mode: 'sample', current: c.DEMO_TIMES.hotelDeadline }));
    });
    await button(stale, 'Cancel the trip').click();
    await expect(stale.getByRole('dialog')).toContainText('preview changed or expired');
    await expect(stale.getByRole('dialog')).toContainText('$620.00');
    expect((await snapshot(stale)).actions.length).toBe(0);
    await expect(button(stale, 'Cancel the trip')).toBeDisabled();
    await stale.getByLabel('I understand these are simulated actions').check(); await button(stale, 'Cancel the trip').click();
    await expect(recordedNote(stale)).toHaveText('4 cancellations recorded.');
    await staleContext.close();

    // Inject exactly one repository transport failure; retry goes through UI
    // after reload so in-memory approval state cannot mask durability defects.
    const partialContext = await browser.newContext(); await prefs(partialContext); const partial = await partialContext.newPage();
    partial.on('pageerror', e => errors.push(e.message)); await start(partial);
    await partial.evaluate(async () => {
      const path = '/src/core/index.ts'; const c = await new Function('path', 'return import(path)')(path) as typeof import('../../core/index.ts');
      const original = c.StoreRepository.prototype.recordBookingAction;
      let failed = false;
      c.StoreRepository.prototype.recordBookingAction = async function(input) {
        if (!failed && input.action.bookingId === c.DEMO_IDS.bookings.transfer) { failed = true; return c.err('unavailable', 'Injected transfer failure'); }
        return original.call(this, input);
      };
    });
    await button(partial, 'Review and confirm').click(); await partial.getByLabel('I understand these are simulated actions').check(); await button(partial, 'Cancel the trip').click();
    await expect(partial.locator('.wf-rr-result')).toContainText('3 recorded; 1 unfinished.');
    await expect(partial.locator('.wf-rr-mark')).toHaveText(['Ride −$40']);
    const successes = (await snapshot(partial)).actions;
    await partial.reload(); await button(partial, 'Review and confirm').click();
    await expect(partial.getByRole('dialog')).toContainText('3 already recorded; 1 left to record.');
    await partial.getByLabel('I understand these are simulated actions').check(); await button(partial, 'Cancel the trip').click();
    await expect(recordedNote(partial)).toHaveText('4 cancellations recorded.');
    await expect.poll(async () => (await snapshot(partial)).claims.length).toBe(4);
    expect((await snapshot(partial)).actions.slice(0, 3)).toEqual(successes);
    // Review-needed state must offer a working route back to intake.
    const reviewContext = await browser.newContext(); await prefs(reviewContext); const reviewPage = await reviewContext.newPage();
    reviewPage.on('pageerror', e => errors.push(e.message)); await start(reviewPage);
    await reviewPage.evaluate(async () => {
      const c = await new Function('path', 'return import(path)')('/src/core/index.ts') as typeof import('../../core/index.ts');
      const repo = c.createLocalRepository({ storage: localStorage, workspaceId: localStorage.getItem(c.ACTIVE_WORKSPACE_KEY)! });
      const policy = c.unwrap(await repo.getPolicy(c.DEMO_IDS.policies.hotel));
      c.unwrap(await repo.savePolicy({ ...policy, reviewState: 'needs_review' }, { expectedRevision: policy.revision }));
    });
    await reviewPage.reload();
    await expect(option(reviewPage, 'Cancel the whole trip')).toContainText('Unknown');
    await expect(button(reviewPage, 'Review and confirm')).toBeDisabled();
    await reviewPage.getByRole('link', { name: 'Review policy in intake', exact: true }).click();
    await expect(reviewPage).toHaveURL(new RegExp(trip + '/import$'));
    await reviewContext.close();

    // The newly selectable continue choice still performs only a replacement.
    const keepContext = await browser.newContext(); await prefs(keepContext); const keepPage = await keepContext.newPage();
    keepPage.on('pageerror', e => errors.push(e.message)); await start(keepPage);
    await option(keepPage, 'Keep the trip').click(); await button(keepPage, 'Keep the trip').click();
    await expect(keepPage.getByRole('dialog')).toContainText('$940.00');
    await keepPage.getByLabel('I understand these are simulated actions').check();
    await keepPage.getByRole('dialog').getByRole('button', { name: 'Keep the trip', exact: true }).click();
    await expect(recordedNote(keepPage)).toHaveText('1 action recorded.');
    const kept = await snapshot(keepPage);
    expect(kept.actions).toHaveLength(1); expect(kept.actions[0]!.action).toBe('replace');
    expect(kept.bookings.filter(b => b.id !== kept.actions[0]!.bookingId).every(b => b.state === 'confirmed')).toBe(true);
    await keepContext.close();
    expect(errors).toEqual([]);
    await partialContext.close();
  } catch (error) {
    mkdirSync('test-results/reroute', { recursive: true });
    for (const [i, p] of browser.contexts().flatMap(c => c.pages()).entries()) await p.screenshot({ path: `test-results/reroute/failure-${i}.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); await server.close(); }
}, 90_000);
