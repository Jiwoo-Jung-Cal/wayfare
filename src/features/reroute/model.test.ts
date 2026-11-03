import { describe, expect, it } from 'vitest';
import { addDuration, createClock, createLocalRepository, createSampleExtractionService, DEMO_EXPECTED as E, DEMO_IDS as I, DEMO_TIMES as T,
  memoryStorage, RecoveryOptionSchema, subtract, unwrap, unknownValue, type FeatureContext } from '../../core/index.ts';
import { analyzeImpacts, computeComparison, eligibility, loadComparison, triggerDemoDisruption } from './model.ts';

export async function setup() {
  const storage = memoryStorage();
  const repo = createLocalRepository({ storage, workspaceId: 'ws-reroute-test', initialStage: 'booked' });
  const ctx: FeatureContext = { repo, clock: createClock({ mode: 'sample', current: T.clockStart }), extraction: createSampleExtractionService(() => T.clockStart), refresh: async () => {}, notifyActionRecorded: async () => {} };
  unwrap(await triggerDemoDisruption({ tripId: I.trip }, ctx));
  return { repo, ctx, storage };
}

describe('ReRoute comparison and CancelClock', () => {
  it('persists one source-backed disruption and two schema-valid canonical choices without changing bookings/assets', async () => {
    const { repo, ctx } = await setup();
    const before = unwrap(await repo.snapshot());
    expect(unwrap(await triggerDemoDisruption({ tripId: I.trip }, ctx)).disruptionId).toBe(I.disruption);
    const result = unwrap(await loadComparison(I.trip, ctx));
    const [cont, cancel] = result.options;
    for (const option of result.options) expect(RecoveryOptionSchema.safeParse(option).success).toBe(true);
    expect(cont).toMatchObject({ extraCashNeeded: E.continueOption.extraCashNeeded, expectedCashRecovery: E.continueOption.expectedCashRecovery,
      cashPaidBeforeRefunds: E.continueOption.cashPaidBeforeRefunds, forecastCost: E.continueOption.forecastCost, constraints: [] });
    expect(cancel).toMatchObject({ expectedCashRecovery: E.cancelTripOption.expectedCashRecovery, forecastCost: E.cancelTripOption.forecastUnrecovered, constraints: [] });
    const after = unwrap(await repo.snapshot());
    expect(after.recoveryOptions).toHaveLength(2); expect(after.disruptions).toHaveLength(1);
    expect(after.bookings).toEqual(before.bookings); expect(after.assets).toEqual(before.assets); expect(after.actions).toEqual([]);
  });
  it.each([-1, 0, 1])('uses half-open hotel tiers at cutoff %+i seconds', async offset => {
    const { repo } = await setup(); const now = addDuration(T.hotelDeadline, { seconds: offset });
    const r = unwrap(computeComparison(unwrap(await repo.snapshot()), I.trip, now));
    const hotel = r.options[1]!.bookingActions.find(a => a.bookingId === I.bookings.hotel)!;
    expect(hotel.expectedRecovery).toEqual(offset < 0 ? E.hotelDeadline.recoveryBefore : E.hotelDeadline.recoveryAtOrAfter);
    const delta = subtract(E.hotelDeadline.recoveryBefore, E.hotelDeadline.recoveryAtOrAfter);
    expect(r.options[1]!.expectedCashRecovery).toEqual(offset < 0 ? E.cancelTripOption.expectedCashRecovery : subtract(E.cancelTripOption.expectedCashRecovery, delta));
    expect(r.deadlines[0]!.status).toBe(offset < 0 ? 'Closing soon' : 'Passed');
  });
  it('does not give traveler cancellation the provider entitlement', async () => {
    const { repo } = await setup(); const s = unwrap(await repo.snapshot()); const b = s.bookings[0]!;
    expect(eligibility(b, s.policies[0], T.clockStart, 'provider_cancels').amount).toEqual(E.bookingsPaid.flight);
    expect(eligibility(b, s.policies[0], T.clockStart, 'traveler_cancels').tier?.id).toBe(I.tiers.flightTravelerCancels);
    s.disruptions[0]!.id = 'dis-other-cancel';
    expect(unwrap(computeComparison(s, I.trip, T.clockStart)).options[1]!.bookingActions[0]!.refundTierId).toBe(I.tiers.flightTravelerCancels);
  });
  it('traces transitive dependencies but preserves unrelated and earlier bookings', async () => {
    const { repo } = await setup(); const s = unwrap(await repo.snapshot());
    const unrelated = { ...s.bookings[2]!, id: 'bk-unaffected', dependsOn: [] };
    const past = { ...s.bookings[2]!, id: 'bk-past', startsAt: T.clockStart, endsAt: T.clockStart };
    const transitive = { ...s.bookings[2]!, id: 'bk-transitive', dependsOn: [I.bookings.hotel] };
    const impacts = analyzeImpacts([...s.bookings, unrelated, past, transitive], s.disruptions[0]!);
    expect(impacts.filter(i => i.affected).map(i => i.booking.id)).toEqual([...s.bookings.map(b => b.id), transitive.id]);
  });
  it.each(['unreviewed', 'unknown-paid', 'currency', 'missing-policy', 'overlap'])('keeps %s incomplete instead of treating unknown as zero', async mode => {
    const { repo } = await setup(); const s = unwrap(await repo.snapshot());
    if (mode === 'unreviewed') s.policies[1]!.reviewState = 'needs_review';
    if (mode === 'unknown-paid') s.bookings[1]!.paid = unknownValue('missing payment');
    if (mode === 'currency') s.bookings[1]!.paid = { amountMinor: 45000, currency: 'EUR' };
    if (mode === 'missing-policy') s.policies.splice(1, 1);
    if (mode === 'overlap') s.policies[1]!.refundTiers.push({ ...s.policies[1]!.refundTiers[0]!, id: 'tier-overlap' });
    const o = unwrap(computeComparison(s, I.trip, T.clockStart)).options[1]!;
    expect(o.expectedCashRecovery).toHaveProperty('unknown', true); expect(o.forecastCost).toHaveProperty('unknown', true); expect(o.constraints.length).toBeGreaterThan(0);
  });
  it.each(['missing', 'expired', 'changed-currency'])('rejects %s replacement quote without blocking cancel', async mode => {
    const { repo } = await setup(); const s = unwrap(await repo.snapshot());
    if (mode === 'missing') s.quotes = [];
    if (mode === 'expired') s.quotes[0]!.validUntil = T.clockStart;
    if (mode === 'changed-currency') s.quotes[0]!.price.currency = 'EUR';
    const [cont, cancel] = unwrap(computeComparison(s, I.trip, T.clockStart)).options;
    expect(cont!.extraCashNeeded).toHaveProperty('unknown', true); expect(cancel!.expectedCashRecovery).toEqual(E.cancelTripOption.expectedCashRecovery);
  });
});
