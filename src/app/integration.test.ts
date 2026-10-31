// Integration tests for shell-owned orchestration (#8).
//
// `walletStub` below is a TEST DOUBLE for TripWallet's syncClaimsFromActions,
// written only to exercise the shell's handoff contract (when sync runs,
// retries, coalescing, reload recovery). It is not TripWallet's
// implementation; Agent 5 owns claim creation and balances.

import { describe, expect, it } from 'vitest';
import {
  DEMO_IDS,
  DEMO_TIMES,
  appError,
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

  it.todo('selects a plan through the Wayfinder module (Agent 2, #4)');
  it.todo('triggers the flight cancellation through ReRoute.triggerDemoDisruption (Agent 4, #6)');
  it.todo('approves the cancel-trip option and records hotel action before the deadline (Agent 4, #6)');
  it.todo('creates the $400 hotel claim via TripWallet.syncClaimsFromActions (Agent 5, #7)');
  it.todo('matches the $250 receipt, shows $150 outstanding, then completes with $150 (Agent 5, #7)');
  it.todo('verifies the completed state after reload and that repeated approval/import does not double records');
});
