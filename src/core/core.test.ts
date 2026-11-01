import { describe, expect, it } from 'vitest';
import {
  DEMO_EXPECTED,
  DEMO_IDS,
  DEMO_TIMES,
  DEMO_DOCUMENT_SOURCES,
  WorkspaceSnapshotSchema,
  addDuration,
  buildDemoSnapshot,
  createLocalRepository,
  deadlineStatus,
  demoBookingImports,
  demoDocument,
  demoDisruption,
  demoReceipts,
  findInWindow,
  formatMaybeMoney,
  formatMoney,
  getOrCreateLocalWorkspaceId,
  isUnknown,
  memoryStorage,
  money,
  MoneyError,
  parseMajorUnits,
  sum,
  sumMaybe,
  unknownValue,
  unwrap,
  usd,
  zonedWallTimeToInstant,
  type ActionRecord,
  type Money,
  type RefundClaim,
  type Workspace,
} from './index.ts';

const ws = (id: string): Workspace => ({ id, mode: 'sample', label: id, createdAt: '2026-10-31T00:00:00Z' });

describe('money', () => {
  it('uses integer minor units and formats explicitly', () => {
    expect(usd(320)).toEqual({ amountMinor: 32000, currency: 'USD' });
    expect(formatMoney(usd(1260))).toBe('$1,260.00');
    expect(() => money(1.5, 'USD')).toThrow(MoneyError);
  });

  it('never combines currencies', () => {
    expect(() => sum([usd(1), money(100, 'EUR')], 'USD')).toThrow(/Cannot combine/);
  });

  it('treats unknown as unknown, not zero', () => {
    const total = sumMaybe([usd(410), unknownValue('No transfer quote')], 'USD');
    expect(isUnknown(total)).toBe(true);
    expect(formatMaybeMoney(total)).toBe('Unknown');
  });

  it('parses decimal text exactly', () => {
    expect(parseMajorUnits('$1,260.00', 'USD')).toEqual(usd(1260));
    expect(parseMajorUnits('320.5', 'USD')).toEqual(money(32050, 'USD'));
    expect(parseMajorUnits('3.999', 'USD')).toBeNull();
    expect(parseMajorUnits('n/a', 'USD')).toBeNull();
  });
});

describe('time and deadline boundary', () => {
  it('converts the hotel wall-clock deadline to the frozen UTC instant', () => {
    expect(zonedWallTimeToInstant('2026-11-19T18:00', 'America/New_York')).toBe(DEMO_TIMES.hotelDeadline);
    expect(zonedWallTimeToInstant('2026-11-20T07:00', 'America/Los_Angeles')).toBe(DEMO_TIMES.flightDeparts);
  });

  it('a deadline is met only strictly before the instant', () => {
    const d = DEMO_TIMES.hotelDeadline;
    expect(deadlineStatus(addDuration(d, { seconds: -1 }), d)).toBe('before_deadline');
    expect(deadlineStatus(d, d)).toBe('deadline_passed');
  });

  it('hotel tiers switch from $400 to $200 exactly at 2026-11-19T23:00:00Z', () => {
    const hotel = demoBookingImports({ workspaceId: 'ws-test', now: DEMO_TIMES.clockStart })[1]!.policy;
    expect(findInWindow(hotel.refundTiers, '2026-11-19T22:59:59Z')?.refund).toEqual(DEMO_EXPECTED.hotelDeadline.recoveryBefore);
    expect(findInWindow(hotel.refundTiers, '2026-11-19T23:00:00Z')?.refund).toEqual(DEMO_EXPECTED.hotelDeadline.recoveryAtOrAfter);
  });
});

describe('canonical fixture', () => {
  it('booked snapshot is schema-valid and totals $900', async () => {
    const snap = await buildDemoSnapshot(ws('ws-a'), 'booked');
    expect(WorkspaceSnapshotSchema.safeParse(snap).success).toBe(true);
    expect(sum(snap.bookings.map((b) => b.paid as Money), 'USD')).toEqual(DEMO_EXPECTED.baselineCashPaid);
    expect(snap.trips[0]?.selectedPlanId).toBe(DEMO_IDS.plans.nonstop);
  });

  it('cancel-trip tiers at the clock start add up to $820 expected recovery', () => {
    const imports = demoBookingImports({ workspaceId: 'ws-test', now: DEMO_TIMES.clockStart });
    const refunds = imports.map(({ booking, policy }) => {
      const condition = booking.kind === 'flight' ? 'provider_cancels' : 'any';
      return findInWindow(policy.refundTiers.filter((t) => t.condition === condition), DEMO_TIMES.clockStart)!.refund as Money;
    });
    expect(sum(refunds, 'USD')).toEqual(DEMO_EXPECTED.cancelTripOption.expectedCashRecovery);
  });

  it('every policy excerpt appears verbatim in its source document', () => {
    for (const { documentId, policy } of demoBookingImports({ workspaceId: 'ws-test', now: DEMO_TIMES.clockStart })) {
      const text = DEMO_DOCUMENT_SOURCES[documentId]!.text;
      for (const ex of policy.excerpts) expect(text).toContain(ex.text);
    }
  });
});

async function bookedRepo(storage = memoryStorage(), workspaceId = 'ws-a') {
  const repo = createLocalRepository({ storage, workspaceId, initialStage: 'booked' });
  return { repo, storage };
}

function cancelHotelAction(workspaceId: string, key = 'reroute:test-cancel-hotel'): ActionRecord {
  return {
    id: 'act-test-cancel-hotel',
    workspaceId,
    tripId: DEMO_IDS.trip,
    bookingId: DEMO_IDS.bookings.hotel,
    recoveryOptionId: null,
    disruptionId: null,
    action: 'cancel',
    replacementQuoteId: null,
    idempotencyKey: key,
    expectedRecovery: [
      {
        id: 'rc-hotel-cash',
        kind: 'cash_refund',
        value: { unit: 'money', amount: usd(400) },
        method: 'original_payment',
        refundTierId: DEMO_IDS.tiers.hotelBefore,
        dueAt: null,
        dueAtSource: null,
      },
    ],
    resultingBookingState: 'cancelled',
    result: { status: 'simulated', detail: 'Sample mode: no real cancellation sent' },
    capability: 'simulated',
    approvedAt: DEMO_TIMES.clockStart,
    createdAt: DEMO_TIMES.clockStart,
  };
}

function hotelClaim(workspaceId: string, id = 'clm-test-hotel'): RefundClaim {
  return {
    id,
    workspaceId,
    tripId: DEMO_IDS.trip,
    bookingId: DEMO_IDS.bookings.hotel,
    actionRecordId: 'act-test-cancel-hotel',
    recoveryComponentId: 'rc-hotel-cash',
    expected: usd(400),
    method: 'original_payment',
    providerConfirmed: unknownValue('No provider confirmation yet'),
    confirmationDocumentId: null,
    due: null,
    allocations: [],
    outstanding: usd(400),
    status: 'expected',
    revision: 1,
    createdAt: DEMO_TIMES.clockStart,
    updatedAt: DEMO_TIMES.clockStart,
  };
}

describe('repository constraints', () => {
  it('reviewed booking save is idempotent by key and by document content', async () => {
    const { repo } = await bookedRepo(memoryStorage(), 'ws-a');
    unwrap(await repo.resetDemo('planning'));
    const imp = demoBookingImports({ workspaceId: 'ws-a', now: DEMO_TIMES.clockStart })[1]!;
    const document = await demoDocument({ workspaceId: 'ws-a', now: DEMO_TIMES.clockStart }, imp.documentId);
    const input = { idempotencyKey: 'intake:hotel-1', document, booking: imp.booking, policy: imp.policy };
    expect(unwrap(await repo.saveReviewedBooking(input)).replayed).toBe(false);
    expect(unwrap(await repo.saveReviewedBooking(input)).replayed).toBe(true);
    // Same document re-imported under a new key and new document ID: still one booking.
    const again = unwrap(await repo.saveReviewedBooking({ ...input, idempotencyKey: 'intake:hotel-2', document: { ...document, id: 'doc-reimport' } }));
    expect(again.replayed).toBe(true);
    expect(unwrap(await repo.listBookings(DEMO_IDS.trip))).toHaveLength(1);
  });

  it('records a booking action and its booking state atomically, once', async () => {
    const { repo } = await bookedRepo();
    const first = unwrap(await repo.recordBookingAction({ action: cancelHotelAction('ws-a'), expectedBookingRevision: 1 }));
    expect(first.booking.state).toBe('cancelled');
    expect(first.booking.revision).toBe(2);
    const replay = unwrap(await repo.recordBookingAction({ action: cancelHotelAction('ws-a'), expectedBookingRevision: 1 }));
    expect(replay.replayed).toBe(true);
    expect(unwrap(await repo.listActions(DEMO_IDS.trip))).toHaveLength(1);
    const second = await repo.recordBookingAction({ action: { ...cancelHotelAction('ws-a', 'reroute:other'), id: 'act-test-2' }, expectedBookingRevision: 2 });
    expect(second.ok ? null : second.error.code).toBe('precondition_failed');
  });

  it('ensureClaims never duplicates or overwrites claims', async () => {
    const { repo } = await bookedRepo();
    unwrap(await repo.recordBookingAction({ action: cancelHotelAction('ws-a'), expectedBookingRevision: 1 }));
    expect(unwrap(await repo.ensureClaims([hotelClaim('ws-a')])).created).toBe(1);
    const again = unwrap(await repo.ensureClaims([hotelClaim('ws-a', 'clm-other-id')]));
    expect(again).toMatchObject({ created: 0, existing: 1 });
    expect(again.claims[0]?.id).toBe('clm-test-hotel');
    expect(unwrap(await repo.listClaims(DEMO_IDS.trip))).toHaveLength(1);
  });

  it('rejects a duplicate receipt reference with different content and replays identical ones', async () => {
    const { repo } = await bookedRepo();
    const ctx = { workspaceId: 'ws-a', now: DEMO_TIMES.clockStart };
    unwrap(await repo.putDocument(await demoDocument(ctx, DEMO_IDS.documents.hotelReceipt1)));
    const [r1] = demoReceipts(ctx);
    expect(unwrap(await repo.putReceipt(r1!)).created).toBe(true);
    expect(unwrap(await repo.putReceipt({ ...r1!, id: 'rcpt-dup' })).created).toBe(false);
    const conflicting = await repo.putReceipt({ ...r1!, id: 'rcpt-dup', reference: ' hlh-rf-0001 ', amount: usd(99) });
    expect(conflicting.ok ? null : conflicting.error.code).toBe('duplicate');
  });

  it('enforces optimistic revisions', async () => {
    const { repo } = await bookedRepo();
    const trip = unwrap(await repo.getTrip(DEMO_IDS.trip));
    unwrap(await repo.saveTrip({ ...trip, title: 'Renamed' }, { expectedRevision: 1 }));
    const stale = await repo.saveTrip({ ...trip, title: 'Stale' }, { expectedRevision: 1 });
    expect(stale.ok ? null : stale.error.code).toBe('conflict');
  });

  it('persists across reload and keeps the active clock', async () => {
    const storage = memoryStorage();
    const { repo } = await bookedRepo(storage);
    unwrap(await repo.setClock({ mode: 'sample', current: '2026-11-19T23:00:00Z' }));
    unwrap(await repo.recordBookingAction({ action: cancelHotelAction('ws-a'), expectedBookingRevision: 1 }));
    const reloaded = createLocalRepository({ storage, workspaceId: 'ws-a' });
    expect(unwrap(await reloaded.getClock())).toEqual({ mode: 'sample', current: '2026-11-19T23:00:00Z' });
    expect(unwrap(await reloaded.getBooking(DEMO_IDS.bookings.hotel)).state).toBe('cancelled');
    // Writes are stamped with the active (sample) clock.
    expect(unwrap(await reloaded.listActions(DEMO_IDS.trip))[0]?.createdAt).toBe('2026-11-19T23:00:00Z');
  });

  it('isolates workspaces: one cannot write into or reset another', async () => {
    const storage = memoryStorage();
    const a = (await bookedRepo(storage, 'ws-a')).repo;
    const b = (await bookedRepo(storage, 'ws-b')).repo;
    unwrap(await a.recordBookingAction({ action: cancelHotelAction('ws-a'), expectedBookingRevision: 1 }));
    const crossWrite = await b.recordBookingAction({ action: cancelHotelAction('ws-a', 'reroute:cross'), expectedBookingRevision: 1 });
    expect(crossWrite.ok ? null : crossWrite.error.code).toBe('forbidden');
    unwrap(await b.resetDemo('empty'));
    expect(unwrap(await a.listActions(DEMO_IDS.trip))).toHaveLength(1);
    expect(unwrap(await b.listTrips())).toHaveLength(0);
  });

  it('leaves state unchanged when persistence fails', async () => {
    const storage = memoryStorage();
    const { repo } = await bookedRepo(storage);
    unwrap(await repo.getTrip(DEMO_IDS.trip));
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const failed = await repo.recordBookingAction({ action: cancelHotelAction('ws-a'), expectedBookingRevision: 1 });
    expect(failed.ok ? null : failed.error.code).toBe('unavailable');
    expect(unwrap(await repo.getBooking(DEMO_IDS.bookings.hotel)).state).toBe('confirmed');
  });

  it('reports corrupt stored data instead of silently reseeding', async () => {
    const storage = memoryStorage();
    storage.setItem('wayfare:v1:workspace:ws-a', '{"schemaVersion":1}');
    const repo = createLocalRepository({ storage, workspaceId: 'ws-a' });
    const r = await repo.listTrips();
    expect(r.ok ? null : r.error.code).toBe('validation_failed');
  });

  it('records the fixture disruption once', async () => {
    const { repo } = await bookedRepo();
    const ctx = { workspaceId: 'ws-a', now: DEMO_TIMES.clockStart };
    unwrap(await repo.putDocument(await demoDocument(ctx, DEMO_IDS.documents.disruptionNotice)));
    expect(unwrap(await repo.recordDisruption(demoDisruption(ctx))).created).toBe(true);
    expect(unwrap(await repo.recordDisruption(demoDisruption(ctx))).created).toBe(false);
  });

  it('creates one stable workspace ID per browser', () => {
    const storage = memoryStorage();
    const id = getOrCreateLocalWorkspaceId(storage);
    expect(id).toMatch(/^ws-/);
    expect(getOrCreateLocalWorkspaceId(storage)).toBe(id);
  });
});
