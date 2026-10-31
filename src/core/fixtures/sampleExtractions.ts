// Deterministic "simulated" extraction for the WayFare sample documents.
// Each entry is what a model would return in RawBookingExtraction form; it is
// run through the SAME normalizeRawBookingExtraction() as live output, so
// sample mode exercises the real conversion, excerpt checks and unknown handling.
// Text that is not a sample document is never "extracted" in sample mode.

import { normalizeDocumentText, sha256Hex } from '../ids.ts';
import { err, type Result } from '../result.ts';
import type { Instant } from '../time.ts';
import { normalizeRawBookingExtraction, type BookingExtraction, type ExtractionService, type ExtractBookingRequest, type RawBookingExtraction, ExtractBookingRequestSchema } from '../extraction.ts';
import { DEMO_DOCUMENT_SOURCES, DEMO_IDS } from './demoNyc.ts';
import { parseWith } from '../result.ts';

type F = RawBookingExtraction['booking']['provider'];
const f = (value: string, excerpt: string, confidence: F['confidence'] = 'high'): F => ({ value, excerpt, confidence, unknown_reason: null });
const none = (reason: string): F => ({ value: null, excerpt: null, confidence: 'low', unknown_reason: reason });
const kind = (value: RawBookingExtraction['booking']['kind']['value'], excerpt: string) => ({ value, excerpt, confidence: 'high' as const, unknown_reason: null });

const D = DEMO_IDS.documents;
const B = DEMO_IDS.bookings;
const P = DEMO_IDS.policies;

export const SAMPLE_RAW_EXTRACTIONS: Record<string, RawBookingExtraction> = {
  [D.flightConfirmation]: {
    is_booking_confirmation: true,
    not_booking_reason: null,
    booking: {
      kind: kind('flight', 'Flight BL 214, San Francisco (SFO) to New York (JFK)'),
      provider: f('Bayline Air', 'Bayline Air - Booking confirmation'),
      reference: f('BLA7Q2', 'Confirmation code: BLA7Q2'),
      title: f('BL 214 SFO to JFK', 'Flight BL 214, San Francisco (SFO) to New York (JFK)'),
      starts_local: f('2026-11-20T07:00', 'Departs: November 20, 2026 7:00 AM PT'),
      ends_local: f('2026-11-20T15:30', 'Arrives: November 20, 2026 3:30 PM ET'),
      timezone: f('America/Los_Angeles', 'Departs: November 20, 2026 7:00 AM PT'),
      ends_timezone: f('America/New_York', 'Arrives: November 20, 2026 3:30 PM ET'),
      paid_amount: f('320.00', 'Total paid: $320.00 USD'),
      currency: f('USD', 'Total paid: $320.00 USD'),
    },
    policy: {
      refundability: 'partially_refundable',
      tiers: [
        { label: 'Airline cancels: full fare refund', condition: 'provider_cancels', starts_at_or_after_local: null, ends_before_local: null, timezone: null, refund_amount: '320.00', refund_currency: 'USD', method: 'original_payment', excerpt: 'If Bayline Air cancels your flight, you may request a full refund of the fare to your original form of payment.' },
        { label: 'Traveler cancels: non-refundable', condition: 'traveler_cancels', starts_at_or_after_local: null, ends_before_local: null, timezone: null, refund_amount: '0.00', refund_currency: 'USD', method: 'none', excerpt: 'Basic Saver fares are non-refundable if you cancel.' },
      ],
      deadlines: [],
      unknown_fields: [],
    },
  },
  [D.hotelConfirmation]: {
    is_booking_confirmation: true,
    not_booking_reason: null,
    booking: {
      kind: kind('hotel', 'Harbor Line Hotel Midtown - Reservation confirmed'),
      provider: f('Harbor Line Hotel Midtown', 'Harbor Line Hotel Midtown - Reservation confirmed'),
      reference: f('HLH-48213', 'Confirmation number: HLH-48213'),
      title: f('Harbor Line Hotel Midtown, 3 nights', '3 nights, Harbor King room'),
      starts_local: f('2026-11-20T15:00', 'Check-in: Friday, November 20, 2026 (after 3:00 PM)'),
      ends_local: f('2026-11-23T11:00', 'Check-out: Monday, November 23, 2026 (before 11:00 AM)'),
      timezone: f('America/New_York', 'Cancel before 6:00 PM ET on November 19, 2026', 'medium'),
      ends_timezone: none('Same timezone as start'),
      paid_amount: f('450.00', 'Total charged: $450.00 USD'),
      currency: f('USD', 'Total charged: $450.00 USD'),
    },
    policy: {
      refundability: 'partially_refundable',
      tiers: [
        { label: 'Cancel before 6:00 PM ET Nov 19: $400 refund', condition: 'any', starts_at_or_after_local: null, ends_before_local: '2026-11-19T18:00', timezone: 'America/New_York', refund_amount: '400.00', refund_currency: 'USD', method: 'original_payment', excerpt: 'Cancel before 6:00 PM ET on November 19, 2026 to receive a refund of $400.00 to your original payment method.' },
        { label: 'Cancel at or after 6:00 PM ET Nov 19: $200 refund', condition: 'any', starts_at_or_after_local: '2026-11-19T18:00', ends_before_local: null, timezone: 'America/New_York', refund_amount: '200.00', refund_currency: 'USD', method: 'original_payment', excerpt: 'Cancellations at or after 6:00 PM ET on November 19, 2026 receive a refund of $200.00.' },
      ],
      deadlines: [
        { label: 'Hotel $400 refund deadline', local_time: '2026-11-19T18:00', timezone: 'America/New_York', source_wording: '6:00 PM ET on November 19, 2026', excerpt: 'Cancel before 6:00 PM ET on November 19, 2026' },
      ],
      unknown_fields: [],
    },
  },
  [D.activityConfirmation]: {
    is_booking_confirmation: true,
    not_booking_reason: null,
    booking: {
      kind: kind('activity', 'Event: Lower Manhattan Skyline Walk, November 21, 2026 10:00 AM ET'),
      provider: f('Skyline Walks NYC', 'Skyline Walks NYC - Ticket confirmation'),
      reference: f('SKW-90551', 'Order: SKW-90551'),
      title: f('Lower Manhattan Skyline Walk', 'Event: Lower Manhattan Skyline Walk'),
      starts_local: f('2026-11-21T10:00', 'November 21, 2026 10:00 AM ET'),
      ends_local: none('End time not stated'),
      timezone: f('America/New_York', 'November 21, 2026 10:00 AM ET', 'medium'),
      ends_timezone: none('Same timezone as start'),
      paid_amount: f('80.00', 'Paid: $80.00 USD'),
      currency: f('USD', 'Paid: $80.00 USD'),
    },
    policy: {
      refundability: 'partially_refundable',
      tiers: [
        { label: 'Cancel before 12:00 PM ET Nov 20: $60 refund', condition: 'any', starts_at_or_after_local: null, ends_before_local: '2026-11-20T12:00', timezone: 'America/New_York', refund_amount: '60.00', refund_currency: 'USD', method: 'original_payment', excerpt: 'Cancel before 12:00 PM ET on November 20, 2026 for a $60.00 refund to your card.' },
        { label: 'No refund after 12:00 PM ET Nov 20', condition: 'any', starts_at_or_after_local: '2026-11-20T12:00', ends_before_local: null, timezone: 'America/New_York', refund_amount: '0.00', refund_currency: 'USD', method: 'none', excerpt: 'No refunds after that time.' },
      ],
      deadlines: [
        { label: 'Skyline Walk refund deadline', local_time: '2026-11-20T12:00', timezone: 'America/New_York', source_wording: '12:00 PM ET on November 20, 2026', excerpt: 'Cancel before 12:00 PM ET on November 20, 2026' },
      ],
      unknown_fields: [],
    },
  },
  [D.transferConfirmation]: {
    is_booking_confirmation: true,
    not_booking_reason: null,
    booking: {
      kind: kind('transfer', 'MetroLink Transfers - Ride booked'),
      provider: f('MetroLink Transfers', 'MetroLink Transfers - Ride booked'),
      reference: f('MLT-3307', 'Booking ref: MLT-3307'),
      title: f('JFK to Harbor Line Hotel transfer', 'Drop-off: Harbor Line Hotel Midtown', 'medium'),
      starts_local: f('2026-11-20T19:00', 'Pickup: JFK Terminal 4, November 20, 2026 7:00 PM ET'),
      ends_local: none('Drop-off time not stated'),
      timezone: f('America/New_York', 'November 20, 2026 7:00 PM ET', 'medium'),
      ends_timezone: none('Same timezone as start'),
      paid_amount: f('50.00', 'Paid: $50.00 USD'),
      currency: f('USD', 'Paid: $50.00 USD'),
    },
    policy: {
      refundability: 'partially_refundable',
      tiers: [
        { label: 'Cancel before 7:00 AM ET Nov 20: $40 refund', condition: 'any', starts_at_or_after_local: null, ends_before_local: '2026-11-20T07:00', timezone: 'America/New_York', refund_amount: '40.00', refund_currency: 'USD', method: 'original_payment', excerpt: 'Cancel before 7:00 AM ET on November 20, 2026 to receive $40.00 back to your original payment.' },
        { label: 'No refund at or after 7:00 AM ET Nov 20', condition: 'any', starts_at_or_after_local: '2026-11-20T07:00', ends_before_local: null, timezone: 'America/New_York', refund_amount: '0.00', refund_currency: 'USD', method: 'none', excerpt: 'Later cancellations are not refunded.' },
      ],
      deadlines: [
        { label: 'Transfer refund deadline', local_time: '2026-11-20T07:00', timezone: 'America/New_York', source_wording: '7:00 AM ET on November 20, 2026', excerpt: 'Cancel before 7:00 AM ET on November 20, 2026' },
      ],
      unknown_fields: [],
    },
  },
  [D.unknownPolicy]: {
    is_booking_confirmation: true,
    not_booking_reason: null,
    booking: {
      kind: kind('activity', 'Dinner for 1, November 21, 2026 7:30 PM ET'),
      provider: f('Gotham Rooftop Dinners', 'Gotham Rooftop Dinners - Reservation'),
      reference: f('GRD-1180', 'Reservation: GRD-1180'),
      title: f('Rooftop dinner', 'Dinner for 1, November 21, 2026 7:30 PM ET', 'medium'),
      starts_local: f('2026-11-21T19:30', 'November 21, 2026 7:30 PM ET'),
      ends_local: none('End time not stated'),
      timezone: f('America/New_York', 'November 21, 2026 7:30 PM ET', 'medium'),
      ends_timezone: none('Same timezone as start'),
      paid_amount: f('95.00', 'Prepaid: $95.00 USD'),
      currency: f('USD', 'Prepaid: $95.00 USD'),
    },
    policy: {
      refundability: 'unknown',
      tiers: [],
      deadlines: [],
      unknown_fields: [{ field: 'refundability', reason: 'The confirmation does not mention cancellation or refunds' }],
    },
  },
  [D.lateDeadlineHotel]: {
    is_booking_confirmation: true,
    not_booking_reason: null,
    booking: {
      kind: kind('hotel', 'Harbor Line Hotel Midtown - Reservation confirmed'),
      provider: f('Harbor Line Hotel Midtown', 'Harbor Line Hotel Midtown - Reservation confirmed'),
      reference: f('HLH-48299', 'Confirmation number: HLH-48299'),
      title: f('Harbor Line Hotel Midtown', 'Harbor Line Hotel Midtown - Reservation confirmed', 'medium'),
      starts_local: none('Check-in time not stated'),
      ends_local: none('Check-out time not stated'),
      timezone: f('America/New_York', 'Cancel before 7:00 AM ET on November 18, 2026', 'medium'),
      ends_timezone: none('Same timezone as start'),
      paid_amount: f('450.00', 'Total charged: $450.00 USD'),
      currency: f('USD', 'Total charged: $450.00 USD'),
    },
    policy: {
      refundability: 'partially_refundable',
      tiers: [
        { label: 'Cancel before 7:00 AM ET Nov 18: $400 refund', condition: 'any', starts_at_or_after_local: null, ends_before_local: '2026-11-18T07:00', timezone: 'America/New_York', refund_amount: '400.00', refund_currency: 'USD', method: 'original_payment', excerpt: 'Cancel before 7:00 AM ET on November 18, 2026 to receive a refund of $400.00 to your original payment method.' },
        { label: 'Cancel at or after 7:00 AM ET Nov 18: $200 refund', condition: 'any', starts_at_or_after_local: '2026-11-18T07:00', ends_before_local: null, timezone: 'America/New_York', refund_amount: '200.00', refund_currency: 'USD', method: 'original_payment', excerpt: 'Cancellations at or after 7:00 AM ET on November 18, 2026 receive a refund of $200.00.' },
      ],
      deadlines: [
        { label: 'Hotel $400 refund deadline', local_time: '2026-11-18T07:00', timezone: 'America/New_York', source_wording: '7:00 AM ET on November 18, 2026', excerpt: 'Cancel before 7:00 AM ET on November 18, 2026' },
      ],
      unknown_fields: [],
    },
  },
  [D.malformed]: {
    is_booking_confirmation: false,
    not_booking_reason: 'No provider, booking reference, date or itemized payment could be identified.',
    booking: {
      kind: { value: null, excerpt: null, confidence: 'low', unknown_reason: 'Not a booking' },
      provider: none('Not a booking'),
      reference: none('Not a booking'),
      title: none('Not a booking'),
      starts_local: none('Not a booking'),
      ends_local: none('Not a booking'),
      timezone: none('Not a booking'),
      ends_timezone: none('Same timezone as start'),
      paid_amount: none('Not a booking'),
      currency: none('Not a booking'),
    },
    policy: { refundability: 'unknown', tiers: [], deadlines: [], unknown_fields: [] },
  },
};

/** Canonical IDs for sample documents that correspond to the trip-demo-nyc bookings. */
const FIXTURE_IDS: Record<string, BookingExtraction['fixture']> = {
  [D.flightConfirmation]: { bookingId: B.flight, policyId: P.flight, dependsOn: [] },
  [D.hotelConfirmation]: { bookingId: B.hotel, policyId: P.hotel, dependsOn: [B.flight] },
  [D.activityConfirmation]: { bookingId: B.activity, policyId: P.activity, dependsOn: [B.flight] },
  [D.transferConfirmation]: { bookingId: B.transfer, policyId: P.transfer, dependsOn: [B.flight] },
};

let hashIndex: Promise<Map<string, string>> | null = null;
/** contentHash -> sample document ID */
export function sampleDocumentHashes(): Promise<Map<string, string>> {
  hashIndex ??= (async () => {
    const m = new Map<string, string>();
    for (const [id, src] of Object.entries(DEMO_DOCUMENT_SOURCES)) m.set(await sha256Hex(normalizeDocumentText(src.text)), id);
    return m;
  })();
  return hashIndex;
}

/** Fixture IDs for a document hash, or null when the text is not a canonical sample booking. */
export async function fixtureForHash(contentHash: string): Promise<BookingExtraction['fixture']> {
  const id = (await sampleDocumentHashes()).get(contentHash);
  return (id && FIXTURE_IDS[id]) || null;
}

/**
 * Deterministic extraction for sample documents only. Any other text returns
 * not_configured; it is never turned into a fabricated success.
 */
export async function sampleExtractBooking(text: string, opts: { requestId: string; now: Instant }): Promise<Result<BookingExtraction>> {
  const contentHash = await sha256Hex(normalizeDocumentText(text));
  const docId = (await sampleDocumentHashes()).get(contentHash);
  const raw = docId ? SAMPLE_RAW_EXTRACTIONS[docId] : undefined;
  if (!raw) {
    return err('not_configured', 'Live AI extraction is not configured. Sample mode only recognizes the WayFare sample documents.', {
      requestId: opts.requestId,
      retryable: false,
    });
  }
  return normalizeRawBookingExtraction(raw, text, {
    requestId: opts.requestId,
    capability: 'simulated',
    model: null,
    extractedAt: opts.now,
    contentHash,
    fixture: await fixtureForHash(contentHash),
  });
}

/** Browser sample-mode ExtractionService (no server, no AI). */
export function createSampleExtractionService(now: () => Instant): ExtractionService {
  return {
    capability: 'simulated',
    description: 'Sample mode: recognizes the WayFare sample confirmations only; no AI call is made.',
    async extractBooking(request: ExtractBookingRequest) {
      const parsed = parseWith(ExtractBookingRequestSchema, request);
      if (!parsed.ok) return parsed;
      return sampleExtractBooking(parsed.value.text, { requestId: `sample-${globalThis.crypto.randomUUID()}`, now: now() });
    },
  };
}
