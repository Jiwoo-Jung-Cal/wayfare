import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createClock, createLocalRepository, createSampleExtractionService, DEMO_IDS as I, DEMO_TIMES as T,
  err, memoryStorage, unwrap, type FeatureContext } from '../../core/index.ts';
import { approveRecovery, prepareApproval } from './actions.ts';
import { computeComparison, triggerDemoDisruption } from './model.ts';
import { MoneyChart } from './page.tsx';

async function setup() {
  const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-chart-review', initialStage: 'booked' });
  const ctx: FeatureContext = { repo, clock: createClock({ mode: 'sample', current: T.clockStart }),
    extraction: createSampleExtractionService(() => T.clockStart), refresh: async () => {}, notifyActionRecorded: async () => {} };
  unwrap(await triggerDemoDisruption({ tripId: I.trip }, ctx));
  const render = async () => renderToStaticMarkup(createElement(MoneyChart, {
    data: unwrap(computeComparison(unwrap(await repo.snapshot()), I.trip, T.clockStart)), now: T.clockStart, tz: 'America/New_York',
  }));
  return { repo, ctx, render };
}

describe('r2 refund chart respects durable outcomes', () => {
  it('shows the canonical unrecorded deadline losses and accessible amounts', async () => {
    const { render } = await setup();
    const html = await render();
    expect(html).toContain('Hotel −$200');
    expect(html).toContain('Ride −$40');
    expect(html).toContain('Walk −$60');
    expect(html).toMatch(/aria-label="Money back over the next 72 hours: now \$820, [^"]*\$620[^"]*\$580[^"]*\$520/);
  });
  it('labels the axis in the same currency as the comparison', async () => {
    const { repo } = await setup();
    const snapshot = unwrap(await repo.snapshot());
    // A supported single-currency trip: no conversion or mixed-currency data.
    for (const booking of snapshot.bookings) if (!('unknown' in booking.paid)) booking.paid.currency = 'EUR';
    for (const policy of snapshot.policies) for (const tier of policy.refundTiers)
      if (!('unknown' in tier.refund)) tier.refund.currency = 'EUR';
    for (const quote of snapshot.quotes) quote.price.currency = 'EUR';
    const data = unwrap(computeComparison(snapshot, I.trip, T.clockStart));
    const html = renderToStaticMarkup(createElement(MoneyChart, { data, now: T.clockStart, tz: 'America/New_York' }));
    expect(html).toContain('now €820');
    expect(html).toContain('€300');
    expect(html).not.toContain('$');
  });
  it('does not advertise losses at future deadlines after all actions are recorded', async () => {
    const { ctx, render } = await setup();
    unwrap(await approveRecovery(unwrap(await prepareApproval(I.trip, 'cancel_trip', ctx)), ctx));
    const html = await render();
    expect(html).toContain('Money back over the next 72 hours: now $820');
    expect(html).not.toContain('wf-rr-mark');
  });
  it('only marks the unfinished booking after a partial approval', async () => {
    const { repo, ctx, render } = await setup();
    const write = repo.recordBookingAction.bind(repo);
    vi.spyOn(repo, 'recordBookingAction').mockImplementation(input => input.action.bookingId === I.bookings.transfer
      ? Promise.resolve(err('unavailable', 'Injected transfer failure')) : write(input));
    unwrap(await approveRecovery(unwrap(await prepareApproval(I.trip, 'cancel_trip', ctx)), ctx));
    const html = await render();
    expect(html).toContain('Ride −$40');
    expect(html).not.toContain('Hotel −$200');
    expect(html).not.toContain('Walk −$60');
    expect(html).toMatch(/aria-label="Money back over the next 72 hours: now \$820, [^"]*\$780"/);
  });
});
