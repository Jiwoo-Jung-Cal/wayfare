// Integration tests for shell-owned orchestration (#8).
//
// `walletStub` below is a TEST DOUBLE for TripWallet's syncClaimsFromActions,
// written only to exercise the shell's handoff contract (when sync runs,
// retries, coalescing, reload recovery). It is not TripWallet's
// implementation; Agent 5 owns claim creation and balances.

import { describe, expect, it } from 'vitest';
import {
  DEMO_EXPECTED,
  DEMO_IDS,
  DEMO_TIMES,
  ActionRecordSchema,
  appError,
  demoCancelTripActions,
  demoDisruption,
  demoDocument,
  sum,
  createClock,
  createLocalRepository,
  createSampleExtractionService,
  memoryStorage,
  ok,
  unwrap,
  usd,
  type ActionRecord,
  type ClaimSyncResult,
  type FeatureContext,
  type Id,
  type KeyValueStorage,
  type RefundClaim,
  type Result,
  type WorkspaceRepository,
} from '../core/index.ts';
import { createClaimSyncOrchestrator, type ClaimSyncState } from './claimSync.ts';
import { FEATURES } from './featureRegistry.ts';
import type { FeatureModule, Money } from '../core/index.ts';

const WS = 'ws-journey';

function context(repo: WorkspaceRepository): FeatureContext {
  const clock = createClock({ mode: 'sample', current: DEMO_TIMES.clockStart });
  return {
    repo,
    clock,
    extraction: createSampleExtractionService(() => clock.now()),
    refresh: async () => undefined,
    notifyActionRecorded: async () => undefined,
  };
}

/** Test double: one claim per cash component, via the idempotent ensureClaims. */
async function walletStub(input: { tripId: Id }, ctx: FeatureContext): Promise<Result<ClaimSyncResult>> {
  const actions = await ctx.repo.listActions(input.tripId);
  if (!actions.ok) return actions;
  const claims: RefundClaim[] = actions.value.flatMap((a) =>
    a.expectedRecovery
      .filter((c) => c.kind === 'cash_refund' && c.value.unit === 'money')
      .map((c) => ({
        id: `clm-${a.id.replace(/^act-/, '')}-${c.id}`,
        workspaceId: a.workspaceId,
        tripId: a.tripId,
        bookingId: a.bookingId,
        actionRecordId: a.id,
        recoveryComponentId: c.id,
        expected: (c.value as { amount: RefundClaim['expected'] }).amount,
        method: c.method,
        providerConfirmed: { unknown: true as const, reason: 'Not confirmed yet' },
        confirmationDocumentId: null,
        due: null,
        allocations: [],
        outstanding: (c.value as { amount: RefundClaim['expected'] }).amount,
        status: 'expected' as const,
        revision: 1,
        createdAt: ctx.clock.now(),
        updatedAt: ctx.clock.now(),
      })),
  );
  const r = await ctx.repo.ensureClaims(claims);
  return r.ok ? ok({ created: r.value.created, existing: r.value.existing }) : r;
}

function cancelHotel(): ActionRecord {
  return {
    id: 'act-journey-hotel',
    workspaceId: WS,
    tripId: DEMO_IDS.trip,
    bookingId: DEMO_IDS.bookings.hotel,
    recoveryOptionId: null,
    disruptionId: null,
    action: 'cancel',
    replacementQuoteId: null,
    idempotencyKey: 'reroute:journey:hotel',
    expectedRecovery: [
      { id: 'rc-hotel-cash', kind: 'cash_refund', value: { unit: 'money', amount: usd(400) }, method: 'original_payment', refundTierId: DEMO_IDS.tiers.hotelBefore, dueAt: null, dueAtSource: null },
    ],
    resultingBookingState: 'cancelled',
    result: { status: 'simulated', detail: 'Sample mode' },
    capability: 'simulated',
    approvedAt: DEMO_TIMES.clockStart,
    createdAt: DEMO_TIMES.clockStart,
  };
}

function harness(repo: WorkspaceRepository, provider: (i: { tripId: Id }, c: FeatureContext) => Promise<Result<ClaimSyncResult>>) {
  const states: ClaimSyncState[] = [];
  const ctx = context(repo);
  const orch = createClaimSyncOrchestrator({ provider: () => provider, context: () => ctx, onState: (s) => states.push(s) });
  return { orch, states, ctx };
}

async function bookedRepo(storage: KeyValueStorage = memoryStorage()) {
  return { storage, repo: createLocalRepository({ storage, workspaceId: WS, initialStage: 'booked' }) };
}

describe('claim-sync orchestration', () => {
  it('creates the claim after a recorded action, and repeated syncs do not duplicate it', async () => {
    const { repo } = await bookedRepo();
    unwrap(await repo.recordBookingAction({ action: cancelHotel(), expectedBookingRevision: 1 }));
    const { orch } = harness(repo, walletStub);
    expect(await orch.run(DEMO_IDS.trip, 'action_recorded')).toMatchObject({ status: 'synced', result: { created: 1, existing: 0 } });
    expect(await orch.run(DEMO_IDS.trip, 'wallet_load')).toMatchObject({ status: 'synced', result: { created: 0, existing: 1 } });
    expect(unwrap(await repo.listClaims(DEMO_IDS.trip))).toHaveLength(1);
  });

  it('keeps the action and reports pending_retry when sync fails; retry recovers', async () => {
    const { repo } = await bookedRepo();
    unwrap(await repo.recordBookingAction({ action: cancelHotel(), expectedBookingRevision: 1 }));
    let fail = true;
    const flaky = async (i: { tripId: Id }, c: FeatureContext) => (fail ? { ok: false as const, error: appError('unavailable', 'Wallet offline') } : walletStub(i, c));
    const { orch } = harness(repo, flaky);
    expect(await orch.run(DEMO_IDS.trip, 'action_recorded')).toMatchObject({ status: 'pending_retry', error: { code: 'unavailable', retryable: true } });
    expect(unwrap(await repo.listActions(DEMO_IDS.trip))).toHaveLength(1);
    expect(unwrap(await repo.listClaims(DEMO_IDS.trip))).toHaveLength(0);
    fail = false;
    expect(await orch.run(DEMO_IDS.trip, 'retry')).toMatchObject({ status: 'synced', result: { created: 1 } });
  });

  it('a thrown provider error becomes a retryable pending state, not a crash', async () => {
    const { repo } = await bookedRepo();
    const { orch } = harness(repo, async () => {
      throw new Error('boom');
    });
    expect(await orch.run(DEMO_IDS.trip, 'wallet_load')).toMatchObject({ status: 'pending_retry', error: { retryable: true } });
  });

  it('recovers the interrupted handoff after a reload via wallet-load sync', async () => {
    const storage = memoryStorage();
    const { repo } = await bookedRepo(storage);
    unwrap(await repo.recordBookingAction({ action: cancelHotel(), expectedBookingRevision: 1 }));
    // Sync never ran (tab closed). Simulate reload with a fresh repository on the same storage.
    const reloaded = createLocalRepository({ storage, workspaceId: WS });
    const { orch } = harness(reloaded, walletStub);
    expect(await orch.run(DEMO_IDS.trip, 'wallet_load')).toMatchObject({ status: 'synced', result: { created: 1 } });
    expect(unwrap(await reloaded.listClaims(DEMO_IDS.trip))).toHaveLength(1);
  });

  it('coalesces requests made during a running sync into exactly one follow-up run', async () => {
    const { repo } = await bookedRepo();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = async (i: { tripId: Id }, c: FeatureContext) => {
      calls++;
      if (calls === 1) await gate;
      return walletStub(i, c);
    };
    const { orch } = harness(repo, slow);
    const first = orch.run(DEMO_IDS.trip, 'wallet_load');
    // Action recorded while the wallet-load sync is still running: must not be dropped.
    unwrap(await repo.recordBookingAction({ action: cancelHotel(), expectedBookingRevision: 1 }));
    const second = orch.run(DEMO_IDS.trip, 'action_recorded');
    const third = orch.run(DEMO_IDS.trip, 'action_recorded');
    release();
    await Promise.all([first, second, third]);
    expect(calls).toBe(2);
    expect(unwrap(await repo.listClaims(DEMO_IDS.trip))).toHaveLength(1);
  });

  it('reports not_registered when TripWallet is not connected', async () => {
    const { repo } = await bookedRepo();
    const states: ClaimSyncState[] = [];
    const orch = createClaimSyncOrchestrator({ provider: () => undefined, context: () => context(repo), onState: (s) => states.push(s) });
    expect(await orch.run(DEMO_IDS.trip, 'action_recorded')).toEqual({ status: 'not_registered', tripId: DEMO_IDS.trip });
  });
});

// Full judged journey. Steps that depend on feature modules stay pending until
// those modules are merged and registered; they are listed so progress is visible.
describe('integrated demo journey (#8)', () => {
  it('imports the four sample confirmations through extraction + reviewed save, without duplicates on repeat', async () => {
    const { reviewedBookingInput, DEMO_DOCUMENT_SOURCES } = await import('../core/index.ts');
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: WS, initialStage: 'planning' });
    const ctx = context(repo);
    const docs = [DEMO_IDS.documents.flightConfirmation, DEMO_IDS.documents.hotelConfirmation, DEMO_IDS.documents.activityConfirmation, DEMO_IDS.documents.transferConfirmation];
    for (const pass of [1, 2]) {
      for (const id of docs) {
        const text = DEMO_DOCUMENT_SOURCES[id]!.text;
        const x = unwrap(await ctx.extraction.extractBooking({ tripId: DEMO_IDS.trip, text }));
        const input = unwrap(await reviewedBookingInput({ extraction: x, sourceText: text, workspaceId: WS, tripId: DEMO_IDS.trip, now: ctx.clock.now() }));
        expect(unwrap(await repo.saveReviewedBooking(input)).replayed).toBe(pass === 2);
      }
    }
    const bookings = unwrap(await repo.listBookings(DEMO_IDS.trip));
    expect(bookings.map((b) => b.id).sort()).toEqual(Object.values(DEMO_IDS.bookings).sort());
    expect(bookings.reduce((s, b) => s + ('amountMinor' in b.paid ? b.paid.amountMinor : 0), 0)).toBe(90000);
  });

});


// ---------------------------------------------------------------------------
// Journey checks that run against REAL feature modules as soon as they are
// registered (src/features/<key>/index.ts). Each check is also self-tested
// against a labeled test double so the check itself is known to be correct.

type DisruptionTrigger = NonNullable<FeatureModule['triggerDemoDisruption']>;
type ClaimSync = NonNullable<FeatureModule['syncClaimsFromActions']>;

async function checkDisruptionTrigger(trigger: DisruptionTrigger) {
  const { repo } = await bookedRepo();
  const ctx = context(repo);
  const first = unwrap(await trigger({ tripId: DEMO_IDS.trip }, ctx));
  const again = unwrap(await trigger({ tripId: DEMO_IDS.trip }, ctx));
  expect(again.disruptionId).toBe(first.disruptionId);
  const disruptions = unwrap(await repo.listDisruptions(DEMO_IDS.trip));
  expect(disruptions).toHaveLength(1);
  expect(disruptions[0]).toMatchObject({ id: first.disruptionId, bookingId: DEMO_IDS.bookings.flight, type: 'cancellation', capability: 'simulated' });
}

async function checkClaimSyncFromCancelTrip(sync: ClaimSync) {
  const { repo } = await bookedRepo();
  const ctx = context(repo);
  const fx = { workspaceId: WS, now: ctx.clock.now() };
  unwrap(await repo.putDocument(await demoDocument(fx, DEMO_IDS.documents.disruptionNotice)));
  unwrap(await repo.recordDisruption(demoDisruption(fx)));
  for (const action of demoCancelTripActions(fx)) {
    const booking = unwrap(await repo.getBooking(action.bookingId));
    unwrap(await repo.recordBookingAction({ action, expectedBookingRevision: booking.revision }));
  }
  unwrap(await sync({ tripId: DEMO_IDS.trip }, ctx));
  const second = unwrap(await sync({ tripId: DEMO_IDS.trip }, ctx));
  expect(second.created).toBe(0);

  const claims = unwrap(await repo.listClaims(DEMO_IDS.trip));
  expect(claims).toHaveLength(4);
  expect(claims.map((c) => `${c.actionRecordId}/${c.recoveryComponentId}`).sort()).toEqual(
    demoCancelTripActions(fx).map((a) => `${a.id}/${a.expectedRecovery[0]!.id}`).sort(),
  );
  expect(sum(claims.map((c) => c.expected as Money), 'USD')).toEqual(DEMO_EXPECTED.cancelTripOption.expectedCashRecovery);
  const hotel = claims.find((c) => c.bookingId === DEMO_IDS.bookings.hotel)!;
  expect(hotel.expected).toEqual(DEMO_EXPECTED.hotelClaim.expected);
  // Noncash assets are never turned into cash claims.
  expect(unwrap(await repo.listAssets()).every((a) => a.status === 'available')).toBe(true);
}

describe('journey checks against registered feature modules', () => {
  const reroute = FEATURES.reroute;
  const wallet = FEATURES.tripwallet;

  it('canonical cancel-trip actions are schema-valid and expect $820 cash', () => {
    const actions = demoCancelTripActions({ workspaceId: WS, now: DEMO_TIMES.clockStart });
    for (const a of actions) expect(ActionRecordSchema.safeParse(a).success).toBe(true);
    const cash = actions.flatMap((a) => a.expectedRecovery.map((c) => (c.value.unit === 'money' ? (c.value.amount as Money) : null)));
    expect(sum(cash as Money[], 'USD')).toEqual(DEMO_EXPECTED.cancelTripOption.expectedCashRecovery);
  });

  it.skipIf(!reroute?.triggerDemoDisruption)('ReRoute (#6): triggerDemoDisruption records the flight cancellation once', async () => {
    await checkDisruptionTrigger(reroute!.triggerDemoDisruption!);
  });

  it.skipIf(!wallet?.syncClaimsFromActions)('TripWallet (#7): syncClaimsFromActions creates the $820 / $400-hotel claims idempotently', async () => {
    await checkClaimSyncFromCancelTrip(wallet!.syncClaimsFromActions!);
  });

  it('self-test: disruption check passes against the shell fallback double', async () => {
    const fallback: DisruptionTrigger = async (_input, ctx) => {
      const fx = { workspaceId: WS, now: ctx.clock.now() };
      const doc = await ctx.repo.putDocument(await demoDocument(fx, DEMO_IDS.documents.disruptionNotice));
      if (!doc.ok) return doc;
      const r = await ctx.repo.recordDisruption(demoDisruption(fx));
      return r.ok ? ok({ disruptionId: r.value.disruption.id }) : r;
    };
    await checkDisruptionTrigger(fallback);
  });

  it('self-test: claim-sync check passes against the wallet test double', async () => {
    await checkClaimSyncFromCancelTrip(walletStub);
  });

  // These steps have no data-level public operation in the v1 FeatureModule
  // contract; they will be covered by the browser E2E once the pages exist.
  it.todo('approves the cancel-trip option in ReRoute before the hotel deadline (Agent 4, #6; browser E2E)');
  it.todo('matches the $250 receipt -> $150 outstanding, then $150 -> resolved (Agent 5, #7; browser E2E)');
  it.todo('completed state survives reload; repeated approval/receipt import does not double records (browser E2E)');
});
