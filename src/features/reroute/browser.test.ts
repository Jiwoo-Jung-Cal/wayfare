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
const card = (p: Page, name: string) => p.locator('.wf-card').filter({ has: p.getByRole('heading', { name, exact: true }) });
const trip = '#/trips/trip-demo-nyc';
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
    await expect(p.getByText(/Disruption:.*Bayline Air cancelled/)).toBeVisible();
    await p.goto(base + trip + '/reroute');
    await expect(card(p, 'Cancel the trip')).toContainText('$820.00');
  }
  try {
    await start(page);
    await expect(card(page, 'Continue the trip')).toContainText('$940.00');
    await button(page, 'Review cancel-trip actions').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(button(page, 'Approve actions')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(button(page, 'Review cancel-trip actions')).toBeFocused();
    for (const width of [1440, 1023, 767, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      expect(await page.locator('.wf-reroute-options').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(width < 1024 ? 1 : 2);
    }
    await button(page, 'Review cancel-trip actions').click();
    await page.getByLabel('I understand these are simulated actions').check();
    await button(page, 'Approve actions').focus(); await page.keyboard.press('Enter');
    await expect(card(page, 'Simulated actions recorded')).toContainText('4 recorded; 0 unfinished.');
    await expect.poll(async () => (await snapshot(page)).claims.length).toBe(4);
    const recorded = await snapshot(page);
    expect(recorded.actions.length).toBe(4);
    expect(recorded.claims.reduce((sum, c) => sum + ('amountMinor' in c.expected ? c.expected.amountMinor : NaN), 0)).toBe(E.cancelTripOption.expectedCashRecovery.amountMinor);
    await page.reload();
    await expect(card(page, 'Recorded actions')).toContainText('Harbor Line Hotel');
    await expect(button(page, 'Review cancel-trip actions')).toBeDisabled();
    await page.getByRole('link', { name: 'Open TripWallet' }).click();
    await expect(page).toHaveURL(new RegExp(trip + '/wallet$'));
    await expect(page.getByRole('heading', { name: 'TripWallet', exact: true })).toBeVisible();
    const hotel = card(page, 'Harbor Line Hotel Midtown');
    await expect(hotel).toContainText('$400.00');
    await button(page, 'Load sample refund confirmation').click();
    const select = page.getByRole('combobox', { name: /^Claim to confirm/ });
    const hotelId = await select.locator('option').filter({ hasText: 'HLH-48213' }).getAttribute('value');
    await select.selectOption(hotelId!);
    await button(page, 'Confirm reviewed evidence').click();
    for (const [amount, reference, outstanding] of [['250', 'HLH-RF-0001', '150'], ['150', 'HLH-RF-0002', '0']]) {
      await button(page, `Load sample $${amount} receipt`).click();
      await button(page, 'Confirm reviewed evidence').click();
      await page.getByRole('combobox', { name: new RegExp(`^Claim for receipt ${reference}\\b`) }).selectOption(hotelId!);
      await button(page, `Match receipt ${reference}`).click();
      await expect(hotel).toContainText(`Outstanding $${outstanding}.00`);
    }
    await page.reload(); await expect(hotel).toContainText('Outstanding $0.00');
    const finished = await snapshot(page);
    expect(finished.claims.length).toBe(4); expect(finished.receipts.length).toBe(2);
    expect(finished.claims.reduce((sum, c) => sum + ('amountMinor' in c.outstanding ? c.outstanding.amountMinor : NaN), 0)).toBe(E.cancelTripOption.expectedCashRecovery.amountMinor - E.hotelClaim.expected.amountMinor);

    // Separate visitor: another tab advances the clock while approval is open.
    const staleContext = await browser.newContext(); await prefs(staleContext); const stale = await staleContext.newPage();
    stale.on('pageerror', e => errors.push(e.message)); await start(stale);
    await button(stale, 'Review cancel-trip actions').click();
    await stale.getByLabel('I understand these are simulated actions').check();
    await stale.evaluate(async () => {
      const path = '/src/core/index.ts'; const c = await new Function('path', 'return import(path)')(path) as typeof import('../../core/index.ts');
      c.unwrap(await c.createLocalRepository({ storage: localStorage, workspaceId: localStorage.getItem(c.ACTIVE_WORKSPACE_KEY)! }).setClock({ mode: 'sample', current: c.DEMO_TIMES.hotelDeadline }));
    });
    await button(stale, 'Approve actions').click();
    await expect(stale.getByRole('dialog')).toContainText('preview changed or expired');
    await expect(stale.getByRole('dialog')).toContainText('$620.00');
    expect((await snapshot(stale)).actions.length).toBe(0);
    await expect(button(stale, 'Approve actions')).toBeDisabled();
    await stale.getByLabel('I understand these are simulated actions').check(); await button(stale, 'Approve actions').click();
    await expect(card(stale, 'Simulated actions recorded')).toContainText('4 recorded; 0 unfinished.');
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
    await button(partial, 'Review cancel-trip actions').click(); await partial.getByLabel('I understand these are simulated actions').check(); await button(partial, 'Approve actions').click();
    await expect(card(partial, 'Some actions are not recorded')).toContainText('3 recorded; 1 unfinished.');
    const successes = (await snapshot(partial)).actions;
    await partial.reload(); await button(partial, 'Review cancel-trip actions').click();
    await expect(partial.getByRole('dialog')).toContainText('Approve 1 cancel-trip actions?');
    await partial.getByLabel('I understand these are simulated actions').check(); await button(partial, 'Approve actions').click();
    await expect(card(partial, 'Simulated actions recorded')).toContainText('4 recorded; 0 unfinished.');
    await expect.poll(async () => (await snapshot(partial)).claims.length).toBe(4);
    expect((await snapshot(partial)).actions.slice(0, 3)).toEqual(successes);
    expect(errors).toEqual([]);
    await partialContext.close();
  } catch (error) {
    mkdirSync('test-results/reroute', { recursive: true });
    for (const [i, p] of browser.contexts().flatMap(c => c.pages()).entries()) await p.screenshot({ path: `test-results/reroute/failure-${i}.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); await server.close(); }
}, 90_000);
