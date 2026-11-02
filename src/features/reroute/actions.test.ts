import { describe, expect, it, vi } from 'vitest';
import { ActionRecordSchema, addDuration, createClock, createLocalRepository, createSampleExtractionService, DEMO_EXPECTED as E,
  DEMO_IDS as I, DEMO_TIMES as T, demoCancelTripActions, err, memoryStorage, unwrap, type FeatureContext } from '../../core/index.ts';
import { approveRecovery, prepareApproval } from './actions.ts';
import { triggerDemoDisruption } from './model.ts';

async function setup() {
  const storage = memoryStorage();
  const repo = createLocalRepository({ storage, workspaceId: 'ws-reroute-actions', initialStage: 'booked' });
  const notifyActionRecorded = vi.fn(async () => {});
  const ctx: FeatureContext = { repo, clock: createClock({ mode: 'sample', current: T.clockStart }), extraction: createSampleExtractionService(() => T.clockStart), refresh: async () => {}, notifyActionRecorded };
  unwrap(await triggerDemoDisruption({ tripId: I.trip }, ctx));
  return { repo, ctx, storage, notifyActionRecorded };
}

describe('explicit simulated approval', () => {
  it('actual approval produces four canonical durable cash outcomes and notifies shell, not direct claims', async () => {
    const { repo, ctx, notifyActionRecorded } = await setup();
    const preview = unwrap(await prepareApproval(I.trip, 'cancel_trip', ctx));
    expect(unwrap(await repo.listActions(I.trip))).toEqual([]);
    const result = unwrap(await approveRecovery(preview, ctx));
    expect(result.stale).toBe(false); expect(result.outcomes.map(o => o.status)).toEqual(Array(4).fill('recorded'));
    const actions = unwrap(await repo.listActions(I.trip));
    // Fixture used only as contract expectation, never to execute approval.
    const expected = demoCancelTripActions({ workspaceId: 'ws-reroute-actions', now: T.clockStart });
    for (const action of actions) {
      expect(ActionRecordSchema.safeParse(action).success).toBe(true);
      const e = expected.find(a => a.bookingId === action.bookingId)!;
      expect(action.expectedRecovery[0]).toMatchObject({ kind: 'cash_refund', value: e.expectedRecovery[0]!.value, method: 'original_payment', refundTierId: e.expectedRecovery[0]!.refundTierId, dueAt: null });
      expect(action.result.status).toBe('simulated');
      expect(notifyActionRecorded).toHaveBeenCalledWith({ tripId: I.trip, actionRecordId: action.id });
    }
    expect(unwrap(await repo.listClaims(I.trip))).toEqual([]); // only the shell/TripWallet may create claims
  });
  it.each(['deadline', 'booking', 'policy', 'quote'])('requires renewed confirmation after changed %s', async mode => {
    const { repo, ctx } = await setup();
    const kind = mode === 'quote' ? 'continue' : 'cancel_trip';
    const p = unwrap(await prepareApproval(I.trip, kind, ctx));
    if (mode === 'deadline') unwrap(await repo.setClock({ mode: 'sample', current: T.hotelDeadline }));
    if (mode === 'booking') { const b = unwrap(await repo.getBooking(I.bookings.hotel)); unwrap(await repo.saveBooking({ ...b, title: 'Updated hotel' }, { expectedRevision: b.revision })); }
    if (mode === 'policy') { const policy = unwrap(await repo.getPolicy(I.policies.hotel)); unwrap(await repo.savePolicy({ ...policy, reviewState: 'needs_review' }, { expectedRevision: policy.revision })); }
    if (mode === 'quote') { const q = unwrap(await repo.listQuotes(I.trip))[0]!; unwrap(await repo.saveQuote({ ...q, id: 'quote-new-flight', createdAt: addDuration(T.clockStart, { seconds: 1 }), price: { ...q.price, amountMinor: q.price.amountMinor + 100 } })); }
    expect(unwrap(await approveRecovery(p, ctx)).stale).toBe(true);
    expect(unwrap(await repo.listActions(I.trip))).toEqual([]);
    if (mode === 'deadline') {
      const fresh = unwrap(await prepareApproval(I.trip, kind, ctx));
      expect(fresh.option.bookingActions.find(a => a.bookingId === I.bookings.hotel)!.expectedRecovery).toEqual(E.hotelDeadline.recoveryAtOrAfter);
      expect(unwrap(await approveRecovery(fresh, ctx)).outcomes.every(o => o.status === 'recorded')).toBe(true);
    }
  });
  it('double clicks, replay, regenerated preview and reload cannot record duplicates', async () => {
    const { repo, ctx, storage, notifyActionRecorded } = await setup();
    const p = unwrap(await prepareApproval(I.trip, 'cancel_trip', ctx));
    await Promise.all([approveRecovery(p, ctx), approveRecovery(p, ctx)]);
    expect(unwrap(await repo.listActions(I.trip))).toHaveLength(4);
    const reloaded = createLocalRepository({ storage, workspaceId: 'ws-reroute-actions' });
    const rctx = { ...ctx, repo: reloaded };
    const again = unwrap(await prepareApproval(I.trip, 'cancel_trip', rctx));
    expect(unwrap(await approveRecovery(again, rctx)).outcomes.every(o => o.status === 'already_recorded')).toBe(true);
    expect(unwrap(await reloaded.listActions(I.trip))).toHaveLength(4);
    expect(notifyActionRecorded.mock.calls.length).toBeGreaterThanOrEqual(8);
  });
  it('preserves success on partial write failure and only writes unfinished work on retry', async () => {
    const { repo, ctx, storage } = await setup();
    const write = repo.recordBookingAction.bind(repo);
    const spy = vi.spyOn(repo, 'recordBookingAction').mockImplementation(async input => input.action.bookingId === I.bookings.transfer ? err('unavailable', 'Injected write failure') : write(input));
    const p = unwrap(await prepareApproval(I.trip, 'cancel_trip', ctx));
    const result = unwrap(await approveRecovery(p, ctx));
    expect(result.outcomes.filter(o => o.status === 'failed')).toHaveLength(1);
    const saved = unwrap(await repo.listActions(I.trip)); expect(saved).toHaveLength(3);
    spy.mockRestore();
    const reloaded = createLocalRepository({ storage, workspaceId: 'ws-reroute-actions' });
    const rctx = { ...ctx, repo: reloaded }; const retrySpy = vi.spyOn(reloaded, 'recordBookingAction');
    const retry = unwrap(await prepareApproval(I.trip, 'cancel_trip', rctx));
    const completed = unwrap(await approveRecovery(retry, rctx));
    expect(retrySpy).toHaveBeenCalledTimes(1); expect(completed.outcomes.filter(o => o.status === 'already_recorded')).toHaveLength(3);
    expect(unwrap(await reloaded.listActions(I.trip)).slice(0, 3)).toEqual(saved);
  });
  it('detects a deadline crossed midway without losing earlier success', async () => {
    const { repo, ctx } = await setup();
    ctx.notifyActionRecorded = async () => { unwrap(await repo.setClock({ mode: 'sample', current: T.hotelDeadline })); };
    const p = unwrap(await prepareApproval(I.trip, 'cancel_trip', ctx));
    const result = unwrap(await approveRecovery(p, ctx));
    expect(result.stale).toBe(true); expect(unwrap(await repo.listActions(I.trip))).toHaveLength(1);
    const retry = unwrap(await prepareApproval(I.trip, 'cancel_trip', ctx));
    expect(unwrap(await approveRecovery(retry, ctx)).outcomes.filter(o => o.status === 'recorded')).toHaveLength(3);
  });
  it('preserves recorded refunds across later cutoffs and preserves action if notification fails', async () => {
    const { repo, ctx } = await setup();
    ctx.notifyActionRecorded = async () => { throw Error('Injected notification failure'); };
    const p = unwrap(await prepareApproval(I.trip, 'cancel_trip', ctx));
    expect(unwrap(await approveRecovery(p, ctx)).outcomes.every(o => o.notificationPending)).toBe(true);
    unwrap(await repo.setClock({ mode: 'sample', current: addDuration(T.hotelDeadline, { seconds: 1 }) }));
    expect(unwrap(await prepareApproval(I.trip, 'cancel_trip', ctx)).option.expectedCashRecovery).toEqual(E.cancelTripOption.expectedCashRecovery);
    expect(unwrap(await repo.listActions(I.trip))).toHaveLength(4);
  });
  it('continue records replacement only; unrelated bookings and noncash assets remain intact', async () => {
    const { repo, ctx } = await setup(); const initial = unwrap(await repo.snapshot());
    const p = unwrap(await prepareApproval(I.trip, 'continue', ctx));
    const r = unwrap(await approveRecovery(p, ctx)); expect(r.outcomes).toHaveLength(1);
    expect(r.outcomes[0]!.action).toMatchObject({ action: 'replace', replacementQuoteId: I.quotes.replacementFlight, resultingBookingState: 'replaced' });
    const after = unwrap(await repo.snapshot()); expect(after.assets).toEqual(initial.assets);
    expect(after.bookings.filter(b => b.id !== I.bookings.flight)).toEqual(initial.bookings.filter(b => b.id !== I.bookings.flight));
    expect(unwrap(await prepareApproval(I.trip, 'cancel_trip', ctx)).option.constraints.length).toBeGreaterThan(0);
  });
});
