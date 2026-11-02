// Atomic recordBookingAction preconditions (Agent 4 request on #8, comment 6570629325).
// A preview is computed from a read; another tab/visitor request may change the
// clock or the policy before the write. The preconditions are checked inside the
// same exclusive write, so a stale action must change nothing.

import { describe, expect, it } from 'vitest';
import {
  createLocalRepository, memoryStorage, demoCancelTripActions, demoDocument, demoDisruption,
  DEMO_IDS, DEMO_TIMES, addDuration, unwrap,
  type ActionPreconditions, type ActionRecord, type WorkspaceRepository,
} from '../index.ts';
import { createWorkspaceRegistry } from '../../../server/workspaces.ts';
import { createApiHandler } from '../../../server/api.ts';
import { loadConfig } from '../../../server/config.ts';
import { createHttpRepository } from '../http/httpClient.ts';

const BEFORE_CUTOFF = addDuration(DEMO_TIMES.hotelDeadline, { seconds: -1 });

/** Booked demo trip with the disruption recorded; clock 1 s before the hotel cutoff. Returns the $400 hotel action. */
async function prepare(repo: WorkspaceRepository) {
  unwrap(await repo.resetDemo('booked'));
  const workspace = unwrap(await repo.getWorkspace());
  const ctx = { workspaceId: workspace.id, now: DEMO_TIMES.clockStart };
  unwrap(await repo.putDocument(await demoDocument(ctx, DEMO_IDS.documents.disruptionNotice)));
  unwrap(await repo.recordDisruption(demoDisruption(ctx)));
  unwrap(await repo.setClock({ mode: 'sample', current: BEFORE_CUTOFF }));
  const hotel = demoCancelTripActions(ctx).find((a) => a.bookingId === DEMO_IDS.bookings.hotel)!;
  return { hotel: { ...hotel, approvedAt: BEFORE_CUTOFF }, ctx };
}

/** What ReRoute read when it built the $400 preview. */
const hotelPreconditions = (extra: Partial<ActionPreconditions> = {}): ActionPreconditions => ({
  policyId: DEMO_IDS.policies.hotel,
  expectedPolicyRevision: 1,
  validBefore: DEMO_TIMES.hotelDeadline,
  ...extra,
});

const record = (repo: WorkspaceRepository, action: ActionRecord, preconditions?: ActionPreconditions) =>
  repo.recordBookingAction({ action, expectedBookingRevision: 1, ...(preconditions ? { preconditions } : {}) });

function httpPair() {
  const config = loadConfig({ WAYFARE_AI_PROVIDER: 'none', WAYFARE_DATA_DIR: 'memory' });
  const registry = createWorkspaceRegistry({ dataDir: null });
  const handler = createApiHandler({ config, registry, adapter: null });
  const fetch = (url: string, init?: RequestInit) => handler(new Request(url, init));
  return async () => {
    const session = unwrap(await registry.createSession());
    const options = { baseUrl: 'http://test', token: session.token, fetch };
    return [createHttpRepository(options), createHttpRepository(options)] as const;
  };
}

describe('recordBookingAction preconditions (local, two tabs on one store)', () => {
  it('Kelvin repro: another tab moves the clock to the cutoff after the preview; the $400 action is rejected and nothing changes', async () => {
    const storage = memoryStorage();
    const a = createLocalRepository({ storage, workspaceId: 'ws-clock' });
    const b = createLocalRepository({ storage, workspaceId: 'ws-clock' });
    const { hotel } = await prepare(a);
    // Preview read: booking revision 1, policy revision 1, clock before the cutoff.
    expect(unwrap(await a.getBooking(DEMO_IDS.bookings.hotel)).revision).toBe(1);
    unwrap(await b.setClock({ mode: 'sample', current: DEMO_TIMES.hotelDeadline }));
    const before = unwrap(await a.snapshot());

    const r = await record(a, hotel, hotelPreconditions());
    expect(r).toMatchObject({ ok: false, error: { code: 'conflict', message: 'Recovery preview expired; review again', retryable: false } });
    expect(unwrap(await b.snapshot())).toEqual(before);
  });

  it('Kelvin repro: another tab saves a new policy revision; the action is rejected and nothing changes', async () => {
    const storage = memoryStorage();
    const a = createLocalRepository({ storage, workspaceId: 'ws-policy' });
    const b = createLocalRepository({ storage, workspaceId: 'ws-policy' });
    const { hotel } = await prepare(a);
    const policy = unwrap(await b.getPolicy(DEMO_IDS.policies.hotel));
    unwrap(await b.savePolicy({ ...policy, reviewState: 'needs_review' }, { expectedRevision: 1 }));
    const before = unwrap(await a.snapshot());

    const r = await record(a, hotel, hotelPreconditions());
    expect(r).toMatchObject({ ok: false, error: { code: 'conflict', message: 'Policy changed; review again', retryable: false, details: { currentRevision: 2 } } });
    expect(unwrap(await b.snapshot())).toEqual(before);
  });

  it('concurrent clock change and action: whichever commits first wins; a committed $400 action is never at or after the cutoff', async () => {
    const outcomes = { committed: 0, rejected: 0 };
    for (let i = 0; i < 12; i++) {
      const storage = memoryStorage();
      const a = createLocalRepository({ storage, workspaceId: `ws-race-${i}` });
      const b = createLocalRepository({ storage, workspaceId: `ws-race-${i}` });
      const { hotel } = await prepare(a);
      const moveClock = () => b.setClock({ mode: 'sample', current: DEMO_TIMES.hotelDeadline });
      const act = () => record(a, hotel, hotelPreconditions());
      const [first, second] = i % 2 ? [act(), moveClock()] : [moveClock(), act()];
      const results = await Promise.all([first, second]);
      const actionResult = results[i % 2 ? 0 : 1] as Awaited<ReturnType<typeof act>>;
      const snap = unwrap(await b.snapshot());
      const booking = snap.bookings.find((x) => x.id === DEMO_IDS.bookings.hotel)!;
      outcomes[actionResult.ok ? 'committed' : 'rejected']++;
      if (actionResult.ok) {
        expect(actionResult.value.action.createdAt < DEMO_TIMES.hotelDeadline).toBe(true);
        expect(booking).toMatchObject({ state: 'cancelled', revision: 2 });
        expect(snap.actions).toHaveLength(1);
      } else {
        expect(actionResult.error).toMatchObject({ code: 'conflict', retryable: false });
        expect(booking).toMatchObject({ state: 'confirmed', revision: 1 });
        expect(snap.actions).toHaveLength(0);
      }
      expect(snap.clock).toEqual({ mode: 'sample', current: DEMO_TIMES.hotelDeadline });
    }
    // Both interleavings were exercised (the shared store serializes in call order).
    expect(outcomes.committed).toBeGreaterThan(0);
    expect(outcomes.rejected).toBeGreaterThan(0);
  });

  it('a successful action replays idempotently after the cutoff and after a policy change (retry can still notify the shell)', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-replay' });
    const { hotel } = await prepare(repo);
    const first = unwrap(await record(repo, hotel, hotelPreconditions()));
    expect(first.replayed).toBe(false);
    unwrap(await repo.setClock({ mode: 'sample', current: DEMO_TIMES.hotelDeadline }));
    const policy = unwrap(await repo.getPolicy(DEMO_IDS.policies.hotel));
    unwrap(await repo.savePolicy(policy, { expectedRevision: 1 }));
    const before = unwrap(await repo.snapshot());

    const replay = unwrap(await record(repo, hotel, hotelPreconditions()));
    expect(replay).toMatchObject({ replayed: true, action: { id: first.action.id }, booking: { revision: 2 } });
    expect(unwrap(await repo.snapshot())).toEqual(before);
  });

  it('expectedClock rejects any clock change, even one still before the cutoff', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-expected-clock' });
    const { hotel } = await prepare(repo);
    const previewClock = unwrap(await repo.getClock());
    unwrap(await repo.setClock({ mode: 'sample', current: addDuration(BEFORE_CUTOFF, { seconds: -3600 }) }));
    const before = unwrap(await repo.snapshot());
    const r = await record(repo, hotel, hotelPreconditions({ expectedClock: previewClock }));
    expect(r).toMatchObject({ ok: false, error: { code: 'conflict', message: 'The active clock changed; review again' } });
    expect(unwrap(await repo.snapshot())).toEqual(before);
  });

  it('policy identity: attaching/replacing the policy is stale; half-null and foreign policies are invalid', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-policy-id' });
    const { hotel } = await prepare(repo);
    const before = unwrap(await repo.snapshot());
    const cases: [Partial<ActionPreconditions>, string][] = [
      [{ policyId: null, expectedPolicyRevision: null }, 'conflict'], // preview saw no policy; one is attached now
      [{ policyId: DEMO_IDS.policies.hotel, expectedPolicyRevision: null }, 'validation_failed'],
      [{ policyId: null, expectedPolicyRevision: 1 }, 'validation_failed'],
      [{ policyId: DEMO_IDS.policies.flight, expectedPolicyRevision: 1 }, 'conflict'], // not this booking's policy
    ];
    for (const [extra, code] of cases) {
      expect(await record(repo, hotel, hotelPreconditions(extra)), JSON.stringify(extra)).toMatchObject({ ok: false, error: { code } });
    }
    expect(unwrap(await repo.snapshot())).toEqual(before);
  });

  it('replacement quote: must match the action, belong to the booking, and still be valid inside the write', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-quote' });
    const { ctx } = await prepare(repo);
    const flight = demoCancelTripActions(ctx).find((a) => a.bookingId === DEMO_IDS.bookings.flight)!;
    const replace: ActionRecord = {
      ...flight, id: 'act-test-replace-flight', idempotencyKey: 'test:replace:flight', action: 'replace',
      replacementQuoteId: DEMO_IDS.quotes.replacementFlight, resultingBookingState: 'replaced', expectedRecovery: [],
    };
    const pre = (extra: Partial<ActionPreconditions> = {}): ActionPreconditions => ({
      policyId: DEMO_IDS.policies.flight, expectedPolicyRevision: 1, validBefore: null,
      replacementQuoteId: DEMO_IDS.quotes.replacementFlight, ...extra,
    });
    // At the quote's validUntil (same instant as the hotel cutoff) the quote has expired.
    unwrap(await repo.setClock({ mode: 'sample', current: DEMO_TIMES.replacementQuoteValidUntil }));
    let before = unwrap(await repo.snapshot());
    expect(await record(repo, replace, pre())).toMatchObject({ ok: false, error: { code: 'conflict', message: 'Replacement quote expired; review again' } });
    expect(await record(repo, replace, pre({ replacementQuoteId: null }))).toMatchObject({ ok: false, error: { code: 'validation_failed' } });
    const hotelReplace = { ...replace, bookingId: DEMO_IDS.bookings.hotel };
    expect(await record(repo, hotelReplace, pre({ policyId: DEMO_IDS.policies.hotel }))).toMatchObject({ ok: false, error: { code: 'validation_failed' } });
    expect(unwrap(await repo.snapshot())).toEqual(before);

    unwrap(await repo.setClock({ mode: 'sample', current: BEFORE_CUTOFF }));
    before = unwrap(await repo.snapshot());
    const okResult = unwrap(await record(repo, replace, pre()));
    expect(okResult.booking).toMatchObject({ state: 'replaced', revision: 2 });
    expect(before.actions).toHaveLength(0);
  });

  it('compatibility: callers that send no preconditions behave exactly as before', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-compat' });
    const { hotel } = await prepare(repo);
    unwrap(await repo.setClock({ mode: 'sample', current: DEMO_TIMES.hotelDeadline }));
    const r = unwrap(await record(repo, hotel));
    expect(r).toMatchObject({ replayed: false, booking: { state: 'cancelled', revision: 2 } });
  });

  it('rejects malformed preconditions without writing', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-malformed' });
    const { hotel } = await prepare(repo);
    const before = unwrap(await repo.snapshot());
    const bad = { ...hotelPreconditions(), extra: true } as unknown as ActionPreconditions;
    expect(await record(repo, hotel, bad)).toMatchObject({ ok: false, error: { code: 'validation_failed' } });
    expect(unwrap(await repo.snapshot())).toEqual(before);
  });
});

describe('recordBookingAction preconditions (connected server, two clients on one session)', () => {
  it('stale clock and stale policy are rejected over HTTP with 409 semantics and no state change', async () => {
    const pair = httpPair();
    for (const stale of ['clock', 'policy'] as const) {
      const [a, b] = await pair();
      const { hotel } = await prepare(a);
      if (stale === 'clock') unwrap(await b.setClock({ mode: 'sample', current: DEMO_TIMES.hotelDeadline }));
      else unwrap(await b.savePolicy(unwrap(await b.getPolicy(DEMO_IDS.policies.hotel)), { expectedRevision: 1 }));
      const before = unwrap(await a.snapshot());
      const r = await record(a, hotel, hotelPreconditions());
      expect(r, stale).toMatchObject({ ok: false, error: { code: 'conflict', retryable: false } });
      expect(unwrap(await b.snapshot())).toEqual(before);
    }
  });

  it('concurrent HTTP clock change and action never commit a $400 action at or after the cutoff; replay still succeeds', async () => {
    const pair = httpPair();
    const outcomes = { committed: 0, rejected: 0 };
    for (let i = 0; i < 8; i++) {
      const [a, b] = await pair();
      const { hotel } = await prepare(a);
      const act = () => record(a, hotel, hotelPreconditions());
      const move = () => b.setClock({ mode: 'sample', current: DEMO_TIMES.hotelDeadline });
      // Alternate which request is issued first so both interleavings reach the server.
      const actionResult = i % 2
        ? (await Promise.all([act(), move()]))[0]
        : (await Promise.all([move(), act()]))[1];
      const snap = unwrap(await b.snapshot());
      outcomes[actionResult.ok ? 'committed' : 'rejected']++;
      if (actionResult.ok) {
        expect(actionResult.value.action.createdAt < DEMO_TIMES.hotelDeadline).toBe(true);
        expect(snap.actions).toHaveLength(1);
        const replay = unwrap(await record(b, hotel, hotelPreconditions()));
        expect(replay.replayed).toBe(true);
      } else {
        expect(actionResult.error).toMatchObject({ code: 'conflict', retryable: false });
        expect(snap.actions).toHaveLength(0);
        expect(snap.bookings.find((x) => x.id === DEMO_IDS.bookings.hotel)).toMatchObject({ state: 'confirmed', revision: 1 });
      }
    }
    expect(outcomes.committed).toBeGreaterThan(0);
    expect(outcomes.rejected).toBeGreaterThan(0);
  });
});
