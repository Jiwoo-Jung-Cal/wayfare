import { describe, expect, it } from 'vitest';
import {
  DEMO_DOCUMENT_SOURCES,
  DEMO_EXPECTED,
  DEMO_IDS,
  DEMO_TIMES,
  SAMPLE_RAW_EXTRACTIONS,
  createLocalRepository,
  findInWindow,
  memoryStorage,
  normalizeDocumentText,
  normalizeRawBookingExtraction,
  reviewedBookingInput,
  sampleExtractBooking,
  sha256Hex,
  unwrap,
  type BookingExtraction,
} from './index.ts';

const D = DEMO_IDS.documents;
const text = (id: string) => DEMO_DOCUMENT_SOURCES[id]!.text;
const opts = { requestId: 'req-test', now: DEMO_TIMES.clockStart };

describe('sample extraction (same normalization as live output)', () => {
  it('hotel confirmation yields the frozen deadline, $450 paid and $400/$200 tiers', async () => {
    const x = unwrap(await sampleExtractBooking(text(D.hotelConfirmation), opts));
    expect(x.capability).toBe('simulated');
    expect(x.fixture?.bookingId).toBe(DEMO_IDS.bookings.hotel);
    expect(x.booking.paid).toMatchObject({ status: 'found', value: DEMO_EXPECTED.bookingsPaid.hotel });
    expect(x.booking.startsAt).toMatchObject({ status: 'found', value: DEMO_TIMES.hotelCheckIn });
    expect(x.policy.deadlines[0]?.at).toBe(DEMO_TIMES.hotelDeadline);
    expect(findInWindow(x.policy.refundTiers, '2026-11-19T22:59:59Z')?.refund).toEqual(DEMO_EXPECTED.hotelDeadline.recoveryBefore);
    expect(findInWindow(x.policy.refundTiers, DEMO_TIMES.hotelDeadline)?.refund).toEqual(DEMO_EXPECTED.hotelDeadline.recoveryAtOrAfter);
    expect(x.warnings).toEqual([]);
  });

  it('flight keeps departure and arrival in their own timezones', async () => {
    const x = unwrap(await sampleExtractBooking(text(D.flightConfirmation), opts));
    expect(x.booking.startsAt).toMatchObject({ value: DEMO_TIMES.flightDeparts });
    expect(x.booking.endsAt).toMatchObject({ value: DEMO_TIMES.flightArrives });
  });

  it('keeps an unstated policy unknown instead of inventing rules', async () => {
    const x = unwrap(await sampleExtractBooking(text(D.unknownPolicy), opts));
    expect(x.policy.refundability).toBe('unknown');
    expect(x.policy.refundTiers).toEqual([]);
    expect(x.policy.unknownFields.map((u) => u.field)).toContain('refundability');
  });

  it('late-deadline variant converts a deadline already past at the demo clock start', async () => {
    const x = unwrap(await sampleExtractBooking(text(D.lateDeadlineHotel), opts));
    expect(x.policy.deadlines[0]?.at).toBe(DEMO_TIMES.lateHotelDeadline);
    expect(x.policy.deadlines[0]!.at < DEMO_TIMES.clockStart).toBe(true);
    expect(x.booking.startsAt.status).toBe('unknown');
  });

  it('rejects the malformed document (with embedded instructions) as not a booking', async () => {
    const r = await sampleExtractBooking(text(D.malformed), opts);
    expect(r.ok ? null : r.error).toMatchObject({ code: 'validation_failed', details: { reason: 'not_a_booking' } });
  });

  it('never fabricates an extraction for unrecognized text in sample mode', async () => {
    const r = await sampleExtractBooking('Acme Air confirmation ZZ9 paid $10.00 USD on Dec 1', opts);
    expect(r.ok ? null : r.error.code).toBe('not_configured');
  });

  it('downgrades values whose excerpt is not in the document', async () => {
    const raw = structuredClone(SAMPLE_RAW_EXTRACTIONS[D.hotelConfirmation]!);
    raw.booking.paid_amount = { value: '45.00', excerpt: 'Total charged: $45.00 USD', confidence: 'high', unknown_reason: null };
    raw.policy.tiers[0]!.excerpt = 'Full refund any time.';
    const source = text(D.hotelConfirmation);
    const x = unwrap(
      normalizeRawBookingExtraction(raw, source, { requestId: 'r', capability: 'live', model: 'm', extractedAt: DEMO_TIMES.clockStart, contentHash: await sha256Hex(normalizeDocumentText(source)), fixture: null }),
    );
    expect(x.booking.paid.status).toBe('unknown');
    expect(x.policy.refundTiers).toHaveLength(1);
    expect(x.warnings.length).toBe(2);
  });
});

describe('review -> reviewed save', () => {
  async function save(extraction: BookingExtraction, sourceText: string, edits = {}) {
    const repo = createLocalRepository({ storage: memoryStorage(), workspaceId: 'ws-a', initialStage: 'planning' });
    const input = await reviewedBookingInput({ extraction, sourceText, workspaceId: 'ws-a', tripId: DEMO_IDS.trip, now: DEMO_TIMES.clockStart, edits });
    return { repo, input };
  }

  it('saves the hotel with canonical IDs, and a repeat import does not duplicate', async () => {
    const source = text(D.hotelConfirmation);
    const x = unwrap(await sampleExtractBooking(source, opts));
    const { repo, input } = await save(x, source);
    const first = unwrap(await repo.saveReviewedBooking(unwrap(input)));
    expect(first.booking).toMatchObject({ id: DEMO_IDS.bookings.hotel, policyId: DEMO_IDS.policies.hotel, paid: DEMO_EXPECTED.bookingsPaid.hotel, dependsOn: [DEMO_IDS.bookings.flight] });
    expect(first.policy?.reviewState).toBe('reviewed');
    const again = await reviewedBookingInput({ extraction: x, sourceText: source, workspaceId: 'ws-a', tripId: DEMO_IDS.trip, now: DEMO_TIMES.clockStart });
    expect(unwrap(await repo.saveReviewedBooking(unwrap(again))).replayed).toBe(true);
    expect(unwrap(await repo.listBookings(DEMO_IDS.trip))).toHaveLength(1);
  });

  it('requires the reviewer to supply missing required facts', async () => {
    const source = text(D.lateDeadlineHotel);
    const x = unwrap(await sampleExtractBooking(source, opts));
    const { input } = await save(x, source);
    expect(input.ok ? null : input.error.issues?.map((i) => i.path)).toEqual(['startsAt']);
    const fixed = await save(x, source, { startsAt: '2026-11-20T20:00:00Z' });
    expect(fixed.input.ok).toBe(true);
  });

  it('saves an unknown-policy booking as needs_review', async () => {
    const source = text(D.unknownPolicy);
    const x = unwrap(await sampleExtractBooking(source, opts));
    const { repo, input } = await save(x, source);
    const saved = unwrap(await repo.saveReviewedBooking(unwrap(input)));
    expect(saved.policy).toMatchObject({ refundability: 'unknown', reviewState: 'needs_review', refundTiers: [] });
  });
});
