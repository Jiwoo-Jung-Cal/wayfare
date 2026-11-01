import { describe, it, expect } from 'vitest';
import {
  createLocalRepository, memoryStorage, createClock, createSampleExtractionService, unwrap,
  DEMO_TIMES, DEMO_IDS, demoCancelTripActions, demoDocument, demoDisruption, demoReceipts,
  usd, sampleDocuments, type FeatureContext,
} from '../../core/index.ts';
import { syncClaimsFromActions, allocateReceipt, claimState, confirmClaim, followUpDraft, matchCandidates, walletSummary, assetEligibility } from './ledger.ts';
import { importReviewedEvidence } from './evidence.ts';

async function setup() {
  const storage = memoryStorage();
  const repo = createLocalRepository({ storage, workspaceId: 'ws-wallet-test', initialStage: 'booked' });
  const clock = createClock({ mode: 'sample', current: DEMO_TIMES.clockStart });
  const ctx: FeatureContext = { repo, clock, extraction: createSampleExtractionService(() => clock.now()), refresh: async () => {}, notifyActionRecorded: async () => {} };
  const fx = { workspaceId: 'ws-wallet-test', now: clock.now() };
  unwrap(await repo.putDocument(await demoDocument(fx, DEMO_IDS.documents.disruptionNotice)));
  unwrap(await repo.recordDisruption(demoDisruption(fx)));
  for (const action of demoCancelTripActions(fx)) unwrap(await repo.recordBookingAction({ action, expectedBookingRevision: 1 }));
  const sync = unwrap(await syncClaimsFromActions({ tripId: DEMO_IDS.trip }, ctx));
  const hotel = () => repo.listClaims(DEMO_IDS.trip).then(unwrap).then(rows => rows.find(c => c.bookingId === DEMO_IDS.bookings.hotel)!);
  const receipts = demoReceipts(fx);
  for (const r of receipts) {
    unwrap(await repo.putDocument(await demoDocument(fx, r.sourceDocumentId!)));
    unwrap(await repo.putReceipt(r));
  }
  unwrap(await repo.putDocument(await demoDocument(fx, DEMO_IDS.documents.hotelRefundConfirmation)));
  const confirm = (dollars = 400) => hotel().then(c => confirmClaim({ tripId: DEMO_IDS.trip, claimId: c.id, documentId: DEMO_IDS.documents.hotelRefundConfirmation, amount: usd(dollars), dueAt: DEMO_TIMES.hotelRefundDue }, ctx));
  const allocate = async (index: number, claimId?: string) => allocateReceipt({ tripId: DEMO_IDS.trip, claimId: claimId ?? (await hotel()).id, receiptId: receipts[index]!.id }, ctx);
  return { ctx, storage, sync, fx, hotel, receipts, confirm, allocate };
}

describe('TripWallet ledger', () => {
  it('syncs four cash components once; expected, confirmed and received stay distinct', async () => {
    const { ctx, sync } = await setup();
    expect(sync).toEqual({ created: 4, existing: 0 });
    expect(unwrap(await syncClaimsFromActions({ tripId: DEMO_IDS.trip }, ctx))).toEqual({ created: 0, existing: 4 });
    const s = unwrap(await ctx.repo.snapshot());
    expect(walletSummary(s.claims, s.assets, ctx.clock.now()).cash[0]).toMatchObject({ expected: usd(820), providerConfirmed: { unknown: true }, received: usd(0), outstanding: usd(820) });
  });
  it('partial then final receipt reconciles only the hotel, replay/reload/sync retain allocations', async () => {
    const { ctx, storage, hotel, confirm, allocate } = await setup();
    unwrap(await confirm());
    unwrap(await allocate(0));
    expect(claimState(await hotel(), ctx.clock.now())).toMatchObject({ received: usd(250), outstanding: usd(150), status: 'partially_received' });
    const booking = unwrap(await ctx.repo.getBooking(DEMO_IDS.bookings.hotel));
    expect(followUpDraft(await hotel(), booking, ctx.clock.now())).toContain('Outstanding: $150.00');
    unwrap(await allocate(0));
    expect((await hotel()).allocations).toHaveLength(1);
    unwrap(await syncClaimsFromActions({ tripId: DEMO_IDS.trip }, ctx));
    unwrap(await allocate(1));
    expect(claimState(await hotel(), ctx.clock.now())).toMatchObject({ received: usd(400), outstanding: usd(0), status: 'received' });
    const loaded = createLocalRepository({ storage, workspaceId: 'ws-wallet-test' });
    const claims = unwrap(await loaded.listClaims(DEMO_IDS.trip));
    expect(claims.filter(c => c.status === 'received')).toHaveLength(1);
    expect(claims.find(c => c.bookingId === booking.id)?.allocations).toHaveLength(2);
  });
  it('duplicate reference is normalized; changed amount is rejected', async () => {
    const { ctx, receipts } = await setup();
    expect(unwrap(await ctx.repo.putReceipt({ ...receipts[0]!, reference: '  hlh-rf-0001  ' })).created).toBe(false);
    expect(await ctx.repo.putReceipt({ ...receipts[0]!, amount: usd(251) })).toMatchObject({ ok: false, error: { code: 'duplicate' } });
  });
  it('cannot allocate an already used receipt to another claim', async () => {
    const { ctx, allocate } = await setup();
    unwrap(await allocate(0));
    const other = unwrap(await ctx.repo.listClaims(DEMO_IDS.trip)).find(c => c.bookingId !== DEMO_IDS.bookings.hotel)!;
    expect(await allocate(0, other.id)).toMatchObject({ ok: false, error: { code: 'duplicate' } });
  });
  it('rejects over-allocation and currency mismatches while retaining evidence', async () => {
    const { ctx, hotel, receipts, allocate, confirm } = await setup();
    unwrap(await confirm(200));
    expect(await allocate(0)).toMatchObject({ ok: false, error: { code: 'precondition_failed' } });
    const foreign = { ...receipts[0]!, id: 'rcpt-foreign', reference: 'foreign-001', amount: { amountMinor: 100, currency: 'EUR' } };
    unwrap(await ctx.repo.putReceipt(foreign));
    expect(await allocateReceipt({ tripId: DEMO_IDS.trip, claimId: (await hotel()).id, receiptId: foreign.id }, ctx)).toMatchObject({ ok: false, error: { code: 'validation_failed' } });
    expect(unwrap(await ctx.repo.listReceipts(DEMO_IDS.trip))).toHaveLength(3);
  });
  it('changed promises preserve original expectation and flag discrepancy/over-receipt', async () => {
    const { ctx, hotel, confirm, allocate } = await setup();
    unwrap(await confirm()); unwrap(await allocate(0)); unwrap(await confirm(200));
    const c = await hotel();
    expect(c.expected).toEqual(usd(400));
    expect(claimState(c, ctx.clock.now())).toMatchObject({ discrepancy: true, status: 'needs_review', outstanding: usd(-50) });
    expect(c.confirmationDocumentId).not.toBeNull();
  });
  it('unknown due dates stay unknown; overdue uses the active clock boundary', async () => {
    const { hotel, confirm } = await setup();
    expect(claimState(await hotel(), '2030-01-01T00:00:00Z').overdue).toBe(false);
    unwrap(await confirm());
    expect(claimState(await hotel(), '2026-11-25T22:59:59Z').overdue).toBe(false);
    expect(claimState(await hotel(), DEMO_TIMES.hotelRefundDue).overdue).toBe(true);
  });
  it('matching requires reference, merchant, currency and timing; ambiguity stays reviewable', async () => {
    const { ctx, hotel, receipts } = await setup();
    const c = await hotel(); const r = receipts[0]!;
    const bookings = unwrap(await ctx.repo.listBookings(DEMO_IDS.trip));
    expect(matchCandidates(r, [c], bookings, ctx.clock.now())).toHaveLength(1);
    expect(matchCandidates({ ...r, bookingReferenceHint: null }, [c], bookings, ctx.clock.now())).toHaveLength(0);
    expect(matchCandidates({ ...r, merchant: 'Unrelated' }, [c], bookings, ctx.clock.now())).toHaveLength(0);
    expect(matchCandidates({ ...r, receivedAt: '2020-01-01T00:00:00Z' }, [c], bookings, ctx.clock.now())).toHaveLength(0);
    expect(matchCandidates(r, [c, { ...c, id: 'clm-another' }], bookings, ctx.clock.now())).toHaveLength(2);
  });
  it('ignores failed/pending actions and keeps mixed noncash recovery out of cash', async () => {
    const { ctx } = await setup();
    const originals = unwrap(await ctx.repo.listActions(DEMO_IDS.trip));
    const a = originals[0]!;
    const fake = { ...ctx, repo: { ...ctx.repo, listActions: async () => ({ ok: true as const, value: [
      { ...a, result: { status: 'failed' as const, detail: 'failed' } },
      { ...a, result: { status: 'pending' as const, detail: 'pending' } },
    ] }), ensureClaims: ctx.repo.ensureClaims.bind(ctx.repo) } } as FeatureContext;
    expect(unwrap(await syncClaimsFromActions({ tripId: DEMO_IDS.trip }, fake)).created).toBe(0);
    fake.repo.listActions = async () => ({ ok: true, value: [{ ...a, expectedRecovery: [{ ...a.expectedRecovery[0]!, kind: 'voucher', method: 'voucher' }] }] });
    expect(unwrap(await syncClaimsFromActions({ tripId: DEMO_IDS.trip }, fake))).toEqual({ created: 0, existing: 0 });
  });
  it('vouchers/points are separate; unrelated providers and expired assets cannot spend them', async () => {
    const { ctx } = await setup();
    const assets = unwrap(await ctx.repo.listAssets());
    const s = walletSummary(unwrap(await ctx.repo.listClaims(DEMO_IDS.trip)), assets, ctx.clock.now());
    expect(s.noncash).toHaveLength(2);
    expect(s.cash[0]?.expected).toEqual(usd(820));
    expect(assetEligibility(assets[0]!, { issuer: 'Other', currency: 'USD' }, ctx.clock.now()).eligible).toBe(false);
    expect(assetEligibility(assets[0]!, { issuer: assets[0]!.issuer, currency: 'USD' }, '2030-01-01T00:00:00Z').reason).toBe('Expired');
  });
  it('imports reviewed pasted receipt evidence; identical reference cannot add received cash', async () => {
    const { ctx } = await setup();
    const input = { kind: 'receipt' as const, text: sampleDocuments.HOTEL_RECEIPT_1, amount: usd(250), reference: 'HLH-RF-0001', merchant: 'HARBOR LINE HOTEL MIDTOWN', bookingReference: 'HLH-48213', at: DEMO_TIMES.hotelReceipt1At };
    const a = unwrap(await importReviewedEvidence(input, DEMO_IDS.trip, ctx));
    const b = unwrap(await importReviewedEvidence(input, DEMO_IDS.trip, ctx));
    expect(a.receipt?.id).toEqual(b.receipt?.id);
    expect(unwrap(await ctx.repo.listClaims(DEMO_IDS.trip)).every(c => c.allocations.length === 0)).toBe(true);
  });
});
