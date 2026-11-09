import { describe, expect, it, vi } from 'vitest';
import {
  DEMO_EXPECTED, DEMO_IDS, DEMO_TIMES, DEMO_TRIP_ID, createClock, createLocalRepository,
  createSampleExtractionService, err, isUnknown, memoryStorage, money, normalizeDocumentText, ok, sampleDocuments, sumMaybe, unwrap, usd,
  type BookingExtraction, type MaybeMoney, type Result,
} from '../../core/index.ts';
import { createIntakeExtractor, instantToLocalInput, localInputToInstant, reviewDraft, saveReviewedIntake, validateReview } from './review.ts';

const service = createSampleExtractionService(() => DEMO_TIMES.clockStart);
const clock = createClock({ mode: 'sample', current: DEMO_TIMES.clockStart });
const extraction = async (text = sampleDocuments.HOTEL_CONFIRMATION) => unwrap(await service.extractBooking({ tripId: DEMO_TRIP_ID, text }));
async function setup(text = sampleDocuments.HOTEL_CONFIRMATION) {
  const storage = memoryStorage();
  const repo = createLocalRepository({ storage, workspaceId: 'ws-intake-test' });
  const x = await extraction(text);
  return { storage, repo, x, input: { extraction: x, sourceText: text, draft: { ...reviewDraft(x), confirmed: true }, tripId: DEMO_TRIP_ID } };
}

describe('local-time review inputs', () => {
  it('shows UTC instants as wall time in the booking zone and converts edits back exactly', () => {
    expect(instantToLocalInput('2026-11-20T20:00:00Z', 'America/New_York')).toBe('2026-11-20T15:00');
    expect(localInputToInstant('2026-11-20T15:00', 'America/New_York')).toBe('2026-11-20T20:00:00Z');
    expect(instantToLocalInput('2026-11-20T15:00:00Z', 'America/Los_Angeles')).toBe('2026-11-20T07:00');
    expect(instantToLocalInput('2026-11-20T20:00:00Z', 'UTC')).toBe('2026-11-20T20:00');
  });
  it('treats blank, invalid instants and unknown zones as empty rather than guessing', () => {
    expect(localInputToInstant('', 'America/New_York')).toBe('');
    expect(instantToLocalInput('', 'America/New_York')).toBe('');
    expect(instantToLocalInput('2026-11-20T20:00:00Z', 'Not/AZone')).toBe('');
    expect(localInputToInstant('2026-11-20T15:00', 'Not/AZone')).toBe('');
  });
});

describe('reviewed booking intake', () => {
  it.each([
    { currency: 'JPY', amountMinor: 12345, text: '12345' },
    { currency: 'KWD', amountMinor: 12345, text: '12.345' },
    { currency: 'USD', amountMinor: Number.MAX_SAFE_INTEGER - 1, text: '90071992547409.90' },
    { currency: 'USD', amountMinor: 1, text: '0.01' },
  ])('keeps the original amount exact in review: $currency $amountMinor minor units', async ({ currency, amountMinor, text }) => {
    const x = await extraction();
    const paid = money(amountMinor, currency);
    x.booking.paid = { status: 'found', value: paid, excerpt: 'Test price', confidence: 'high' };
    const draft = reviewDraft(x);
    expect(draft.amount).toBe(text);
    expect(draft.currency).toBe(currency);
    const checked = validateReview({ ...draft, confirmed: true });
    if (currency === 'USD') expect(unwrap(checked).paid).toEqual(paid);
    else expect(!checked.ok && checked.error.issues!.some((i) => i.path === 'currency')).toBe(true);
  });

  it('imports all four canonical confirmations into the shared $900 booked scenario', async () => {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-canonical-intake' });
    const amounts: MaybeMoney[] = [];
    for (const text of [sampleDocuments.FLIGHT_CONFIRMATION, sampleDocuments.HOTEL_CONFIRMATION, sampleDocuments.ACTIVITY_CONFIRMATION, sampleDocuments.TRANSFER_CONFIRMATION]) {
      const x = await extraction(text);
      const input = { extraction: x, sourceText: text, draft: { ...reviewDraft(x), confirmed: true }, tripId: DEMO_TRIP_ID };
      amounts.push(unwrap(await saveReviewedIntake(input, { repo, clock })).booking.paid);
      expect(unwrap(await saveReviewedIntake(input, { repo, clock })).replayed).toBe(true);
    }
    expect(sumMaybe(amounts, 'USD')).toEqual(DEMO_EXPECTED.baselineCashPaid);
    expect(unwrap(await repo.listBookings(DEMO_TRIP_ID)).map((b) => b.id)).toEqual(Object.values(DEMO_IDS.bookings));
    expect(unwrap(await repo.getTrip(DEMO_TRIP_ID)).selectedPlanId).toBeNull();
  });

  it('uses shared extraction/save, preserves policy evidence, deduplicates, and reloads', async () => {
    const { storage, repo, input, x } = await setup();
    expect(x.capability).toBe('simulated');
    const first = unwrap(await saveReviewedIntake(input, { repo, clock }));
    expect(first.booking.id).toBe(DEMO_IDS.bookings.hotel);
    expect(first.booking.paid).toEqual(DEMO_EXPECTED.bookingsPaid.hotel);
    expect(first.policy!.excerpts.every((e) => input.sourceText.includes(e.text))).toBe(true);
    expect(unwrap(await saveReviewedIntake(input, { repo, clock })).replayed).toBe(true);
    const reloaded = createLocalRepository({ storage, workspaceId: 'ws-intake-test' });
    expect(unwrap(await reloaded.listBookings(DEMO_TRIP_ID))).toHaveLength(1);
    expect(unwrap(await reloaded.getBooking(first.booking.id)).paid).toEqual(DEMO_EXPECTED.bookingsPaid.hotel);
    expect(unwrap(await reloaded.getDocument(first.document.id)).text).toBe(input.sourceText);
  });

  it('saves explicit reviewer corrections and keeps original source text', async () => {
    const { repo, input } = await setup();
    input.draft.provider = 'Reviewed hotel name'; input.draft.amount = '451.25';
    const saved = unwrap(await saveReviewedIntake(input, { repo, clock }));
    expect(saved.booking.provider).toBe('Reviewed hotel name');
    expect(saved.booking.paid).toEqual({ amountMinor: 45125, currency: 'USD' });
    expect(saved.document.text).toBe(input.sourceText);
    const replay = unwrap(await saveReviewedIntake({ ...input, draft: { ...input.draft, amount: '999' } }, { repo, clock }));
    expect(replay.replayed).toBe(true);
    expect(replay.booking.paid).toEqual(saved.booking.paid);
  });

  it('preserves unknown policy without inventing refund rules', async () => {
    const { repo, input } = await setup(sampleDocuments.UNKNOWN_POLICY_CONFIRMATION);
    const saved = unwrap(await saveReviewedIntake(input, { repo, clock }));
    expect(saved.policy!.refundability).toBe('unknown');
    expect(saved.policy!.reviewState).toBe('needs_review');
    expect(saved.policy!.refundTiers).toEqual([]);
  });

  it('can conservatively dispute a policy while preserving its source for review', async () => {
    const { repo, input } = await setup();
    input.draft.policyUncertain = true;
    const saved = unwrap(await saveReviewedIntake(input, { repo, clock }));
    expect(saved.policy!.reviewState).toBe('needs_review');
    expect(saved.policy!.refundTiers).toEqual([]);
    expect(saved.policy!.deadlines).toEqual([]);
    expect(saved.document.text).toContain('400');
  });

  it('keeps a missing paid amount unknown instead of zero', async () => {
    const { repo, input } = await setup(); input.draft.amount = '';
    const saved = unwrap(await saveReviewedIntake(input, { repo, clock }));
    expect(isUnknown(saved.booking.paid)).toBe(true);
    expect(saved.booking.paid).not.toEqual(usd(0));
  });

  it.each([
    { startsAt: '2026-02-30T12:00:00Z' }, { startsAt: 'not a date' }, { endsAt: '2026-11-19T12:00:00Z' },
    { currency: 'EUR' }, { currency: 'usd' }, { amount: '-1' }, { amount: '12.001' },
    { provider: '' }, { reference: ' ' }, { localTimezone: 'Moon' }, { confirmed: false },
  ])('rejects invalid or unconfirmed review %j without persisting it', async (changes) => {
    const { repo, input } = await setup();
    const result = await saveReviewedIntake({ ...input, draft: { ...input.draft, ...changes } }, { repo, clock });
    expect(!result.ok && result.error.code).toBe('validation_failed');
    expect(unwrap(await repo.listBookings(DEMO_TRIP_ID))).toHaveLength(0);
  });

  it('blocks save when pasted text changed after extraction', async () => {
    const { repo, input } = await setup();
    expect((await saveReviewedIntake({ ...input, sourceText: `${input.sourceText}\nchanged` }, { repo, clock })).ok).toBe(false);
  });

  it('shows required fields when extraction could not identify them', async () => {
    const x = await extraction();
    x.booking.provider = { status: 'unknown', reason: 'No supported source' };
    x.booking.startsAt = { status: 'unknown', reason: 'Ambiguous date' };
    const checked = validateReview({ ...reviewDraft(x), confirmed: true });
    expect(!checked.ok && checked.error.issues!.map((i) => i.path)).toEqual(expect.arrayContaining(['provider', 'startsAt']));
  });

  it('does not invent success on extraction timeout, thrown error, malformed text, or unconfigured AI', async () => {
    const timeout = err('timeout', 'AI timed out');
    const runner = createIntakeExtractor({ capability: 'live', description: 'test', extractBooking: async () => timeout });
    expect(await runner.extract(DEMO_TRIP_ID, sampleDocuments.HOTEL_CONFIRMATION)).toEqual(timeout);
    const thrown = createIntakeExtractor({ capability: 'live', description: 'test', extractBooking: async () => { throw new Error('down'); } });
    const failed = await thrown.extract(DEMO_TRIP_ID, sampleDocuments.HOTEL_CONFIRMATION);
    expect(failed && !failed.ok && failed.error.retryable).toBe(true);
    const sample = createIntakeExtractor(service);
    const malformed = await sample.extract(DEMO_TRIP_ID, sampleDocuments.MALFORMED_DOCUMENT);
    expect(malformed && !malformed.ok && malformed.error.code).toBe('validation_failed');
    const unsupported = await sample.extract(DEMO_TRIP_ID, 'Some unrelated text without any identified sample confirmation.');
    expect(unsupported && !unsupported.ok && unsupported.error.code).toBe('not_configured');
  });

  it('ignores extraction responses superseded by another request or input edit', async () => {
    const x = await extraction();
    const pending: ((r: Result<BookingExtraction>) => void)[] = [];
    const runner = createIntakeExtractor({ capability: 'live', description: 'test', extractBooking: () => new Promise((r) => pending.push(r)) });
    const first = runner.extract(DEMO_TRIP_ID, sampleDocuments.HOTEL_CONFIRMATION);
    const second = runner.extract(DEMO_TRIP_ID, sampleDocuments.UNKNOWN_POLICY_CONFIRMATION);
    pending[1]!(ok(await extraction(sampleDocuments.UNKNOWN_POLICY_CONFIRMATION))); expect((await second)?.ok).toBe(true);
    pending[0]!(ok(x)); expect(await first).toBeNull();
    const third = runner.extract(DEMO_TRIP_ID, sampleDocuments.HOTEL_CONFIRMATION);
    runner.invalidate(); pending[2]!(ok(x)); expect(await third).toBeNull();
  });

  it('rejects a response for a different source document before showing review', async () => {
    const x = await extraction();
    const runner = createIntakeExtractor({ capability: 'simulated', description: 'test', extractBooking: async () => ok(x) });
    const result = await runner.extract(DEMO_TRIP_ID, sampleDocuments.UNKNOWN_POLICY_CONFIRMATION);
    expect(result && !result.ok && result.error.code).toBe('provider_error');
  });

  it('discards a stale source-mismatch error if input changes while its hash is being verified', async () => {
    const text = sampleDocuments.HOTEL_CONFIRMATION;
    const x = await extraction(text);
    x.document.contentHash = '0'.repeat(64);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeDocumentText(text)));
    let started!: () => void;
    const hashing = new Promise<void>((resolve) => { started = resolve; });
    let finish!: (value: ArrayBuffer) => void;
    const delayedDigest = new Promise<ArrayBuffer>((resolve) => { finish = resolve; });
    const spy = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(() => { started(); return delayedDigest; });
    try {
      const runner = createIntakeExtractor({ capability: 'simulated', description: 'test', extractBooking: async () => ok(x) });
      const pending = runner.extract(DEMO_TRIP_ID, text);
      await hashing;
      runner.invalidate();
      finish(digest);
      expect(await pending).toBeNull();
    } finally { spy.mockRestore(); }
  });

  it('returns a failed write without changing the input or pretending it saved', async () => {
    const { repo, input, storage } = await setup();
    unwrap(await repo.snapshot());
    const before = structuredClone(input);
    storage.setItem = () => { throw new Error('Storage is unavailable'); };
    const result = await saveReviewedIntake(input, { repo, clock });
    expect(!result.ok && result.error.code).toBe('unavailable');
    expect(input).toEqual(before);
    expect(unwrap(await repo.listBookings(DEMO_TRIP_ID))).toHaveLength(0);
  });
});
