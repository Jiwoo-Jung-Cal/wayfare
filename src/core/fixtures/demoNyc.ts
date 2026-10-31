// Canonical fictional scenario: trip-demo-nyc (San Francisco -> New York, Nov 20-23, 2026).
// This is the ONLY copy of the scenario. All agents import IDs, records and
// expected figures from here (via src/core/index.ts). Do not fork it.
//
// Amounts are product test data, not statements about any real provider.

import type { Id } from '../ids.ts';
import { normalizeDocumentText, sha256Hex } from '../ids.ts';
import { usd, unknownValue, type Money } from '../money.ts';
import type { Instant } from '../time.ts';
import { DEMO_CLOCK_START } from '../time.ts';
import type {
  Booking,
  DataProvenance,
  Disruption,
  DocumentKind,
  EvidenceDocument,
  PlanOption,
  PolicyEvidence,
  Quote,
  Receipt,
  Trip,
  WalletAsset,
} from '../schema.ts';
import * as docs from './documents.ts';

export const DEMO_TRIP_ID = 'trip-demo-nyc';

export const DEMO_IDS = {
  trip: DEMO_TRIP_ID,
  plans: {
    nonstop: 'plan-demo-nonstop',
    saver: 'plan-demo-saver',
    flex: 'plan-demo-flex',
  },
  bookings: {
    flight: 'bk-demo-flight-out',
    hotel: 'bk-demo-hotel',
    activity: 'bk-demo-activity',
    transfer: 'bk-demo-transfer',
  },
  policies: {
    flight: 'pol-demo-flight-out',
    hotel: 'pol-demo-hotel',
    activity: 'pol-demo-activity',
    transfer: 'pol-demo-transfer',
  },
  tiers: {
    flightProviderCancels: 'tier-demo-flight-provider-cancels',
    flightTravelerCancels: 'tier-demo-flight-traveler-cancels',
    hotelBefore: 'tier-demo-hotel-before',
    hotelAfter: 'tier-demo-hotel-after',
    activityBefore: 'tier-demo-activity-before',
    activityAfter: 'tier-demo-activity-after',
    transferBefore: 'tier-demo-transfer-before',
    transferAfter: 'tier-demo-transfer-after',
  },
  deadlines: {
    hotel: 'ddl-demo-hotel',
    activity: 'ddl-demo-activity',
    transfer: 'ddl-demo-transfer',
  },
  documents: {
    flightConfirmation: 'doc-demo-flight-confirmation',
    hotelConfirmation: 'doc-demo-hotel-confirmation',
    activityConfirmation: 'doc-demo-activity-confirmation',
    transferConfirmation: 'doc-demo-transfer-confirmation',
    disruptionNotice: 'doc-demo-disruption-notice',
    replacementQuote: 'doc-demo-replacement-quote',
    hotelRefundConfirmation: 'doc-demo-hotel-refund-confirmation',
    hotelReceipt1: 'doc-demo-hotel-receipt-1',
    hotelReceipt2: 'doc-demo-hotel-receipt-2',
    voucher: 'doc-demo-voucher',
    points: 'doc-demo-points',
    // Focused verification cases
    unknownPolicy: 'doc-demo-unknown-policy',
    lateDeadlineHotel: 'doc-demo-late-deadline-hotel',
    malformed: 'doc-demo-malformed',
    duplicateReceipt1: 'doc-demo-duplicate-receipt-1',
  },
  quotes: {
    replacementFlight: 'quote-demo-replacement-flight',
  },
  disruption: 'dis-demo-flight-cancel',
  receipts: {
    hotel1: 'rcpt-demo-hotel-1',
    hotel2: 'rcpt-demo-hotel-2',
  },
  assets: {
    voucher: 'asset-demo-voucher',
    points: 'asset-demo-points',
  },
} as const;

/** Key instants. All UTC. ET is UTC-5 on these dates (DST ended Nov 1, 2026). */
export const DEMO_TIMES = {
  clockStart: DEMO_CLOCK_START, // 2026-11-18T17:00:00Z
  flightDeparts: '2026-11-20T15:00:00Z', // 7:00 AM PT
  flightArrives: '2026-11-20T20:30:00Z', // 3:30 PM ET
  replacementDeparts: '2026-11-20T17:15:00Z', // 9:15 AM PT
  replacementArrives: '2026-11-20T22:45:00Z', // 5:45 PM ET
  replacementQuoteValidUntil: '2026-11-19T23:00:00Z',
  hotelCheckIn: '2026-11-20T20:00:00Z',
  hotelCheckOut: '2026-11-23T16:00:00Z',
  /** Hotel recovery is $400 when actionTime < this instant, $200 at or after it. */
  hotelDeadline: '2026-11-19T23:00:00Z',
  activityStarts: '2026-11-21T15:00:00Z',
  activityEnds: '2026-11-21T17:00:00Z',
  activityDeadline: '2026-11-20T17:00:00Z',
  transferPickup: '2026-11-21T00:00:00Z', // 7:00 PM ET Nov 20
  transferDeadline: '2026-11-20T12:00:00Z',
  hotelRefundDue: '2026-11-25T23:00:00Z',
  hotelReceipt1At: '2026-11-22T17:00:00Z',
  hotelReceipt2At: '2026-11-24T17:00:00Z',
  voucherExpires: '2027-12-01T04:59:00Z',
  pointsExpire: '2028-01-01T04:59:00Z',
  lateHotelDeadline: '2026-11-18T12:00:00Z',
} as const satisfies Record<string, Instant>;

/**
 * Expected figures every module's tests must agree with. These are scenario
 * expectations, not a calculation implementation: the owning module computes
 * them (ReRoute: options; TripWallet: claims/balances; Wayfinder: plan totals).
 */
export const DEMO_EXPECTED = {
  baselineCashPaid: usd(900),
  bookingsPaid: { flight: usd(320), hotel: usd(450), activity: usd(80), transfer: usd(50) },
  continueOption: {
    replacementFlight: usd(360),
    extraCashNeeded: usd(360),
    expectedCashRecovery: usd(320),
    cashPaidBeforeRefunds: usd(1260),
    forecastCost: usd(940),
  },
  cancelTripOption: {
    refunds: { flight: usd(320), hotel: usd(400), activity: usd(60), transfer: usd(40) },
    expectedCashRecovery: usd(820),
    forecastUnrecovered: usd(80),
  },
  hotelDeadline: {
    at: DEMO_TIMES.hotelDeadline,
    recoveryBefore: usd(400),
    recoveryAtOrAfter: usd(200),
  },
  hotelClaim: {
    expected: usd(400),
    providerConfirmed: usd(400),
    dueAt: DEMO_TIMES.hotelRefundDue,
    receipt1: usd(250),
    outstandingAfterReceipt1: usd(150),
    receipt2: usd(150),
    outstandingAfterReceipt2: usd(0),
  },
  noncash: { voucherFaceValue: usd(75), points: 8000 },
  planTotals: { nonstop: usd(900), saver: usd(815), flex: 'unknown' as const },
} as const;

export type DemoContext = { workspaceId: Id; now: Instant };

function sampleProvenance(ctx: DemoContext, source: string, documentId: Id | null = null, excerpt: string | null = null): DataProvenance {
  return { kind: 'sample', source, recordedAt: ctx.now, documentId, excerpt };
}

export async function makeDocument(
  ctx: DemoContext,
  input: { id: Id; kind: DocumentKind; title: string; text: string; tripId: Id | null; receivedAt?: Instant },
): Promise<EvidenceDocument> {
  return {
    id: input.id,
    workspaceId: ctx.workspaceId,
    tripId: input.tripId,
    kind: input.kind,
    title: input.title,
    text: input.text,
    contentHash: await sha256Hex(normalizeDocumentText(input.text)),
    receivedAt: input.receivedAt ?? ctx.now,
    isSample: true,
    provenance: sampleProvenance(ctx, `Sample document: ${input.title}`, input.id),
    createdAt: ctx.now,
  };
}

const D = DEMO_IDS.documents;

/** Source text for every fixture document, by document ID. */
export const DEMO_DOCUMENT_SOURCES: Record<string, { kind: DocumentKind; title: string; text: string; receivedAt?: Instant }> = {
  [D.flightConfirmation]: { kind: 'booking_confirmation', title: 'Bayline Air BLA7Q2 confirmation', text: docs.FLIGHT_CONFIRMATION },
  [D.hotelConfirmation]: { kind: 'booking_confirmation', title: 'Harbor Line Hotel HLH-48213 confirmation', text: docs.HOTEL_CONFIRMATION },
  [D.activityConfirmation]: { kind: 'booking_confirmation', title: 'Skyline Walks SKW-90551 ticket', text: docs.ACTIVITY_CONFIRMATION },
  [D.transferConfirmation]: { kind: 'booking_confirmation', title: 'MetroLink MLT-3307 transfer', text: docs.TRANSFER_CONFIRMATION },
  [D.disruptionNotice]: { kind: 'disruption_notice', title: 'Bayline Air BL 214 cancellation notice', text: docs.DISRUPTION_NOTICE },
  [D.replacementQuote]: { kind: 'quote', title: 'Bayline Air BL 230 rebooking quote', text: docs.REPLACEMENT_QUOTE },
  [D.hotelRefundConfirmation]: { kind: 'refund_confirmation', title: 'Harbor Line Hotel refund confirmation', text: docs.HOTEL_REFUND_CONFIRMATION },
  [D.hotelReceipt1]: { kind: 'receipt', title: 'Card credit HLH-RF-0001', text: docs.HOTEL_RECEIPT_1, receivedAt: DEMO_TIMES.hotelReceipt1At },
  [D.hotelReceipt2]: { kind: 'receipt', title: 'Card credit HLH-RF-0002', text: docs.HOTEL_RECEIPT_2, receivedAt: DEMO_TIMES.hotelReceipt2At },
  [D.voucher]: { kind: 'wallet_statement', title: 'Bayline Air goodwill voucher', text: docs.VOUCHER_NOTICE },
  [D.points]: { kind: 'wallet_statement', title: 'Harbor Line Rewards statement', text: docs.POINTS_STATEMENT },
  [D.unknownPolicy]: { kind: 'booking_confirmation', title: 'Gotham Rooftop Dinners GRD-1180', text: docs.UNKNOWN_POLICY_CONFIRMATION },
  [D.lateDeadlineHotel]: { kind: 'booking_confirmation', title: 'Harbor Line Hotel HLH-48299 (late deadline)', text: docs.LATE_DEADLINE_HOTEL_CONFIRMATION },
  [D.malformed]: { kind: 'other', title: 'Malformed document', text: docs.MALFORMED_DOCUMENT },
  [D.duplicateReceipt1]: { kind: 'receipt', title: 'Card credit HLH-RF-0001 (re-sent)', text: docs.DUPLICATE_HOTEL_RECEIPT_1, receivedAt: DEMO_TIMES.hotelReceipt1At },
};

export function demoDocument(ctx: DemoContext, id: keyof typeof DEMO_DOCUMENT_SOURCES): Promise<EvidenceDocument> {
  const src = DEMO_DOCUMENT_SOURCES[id];
  if (!src) throw new Error(`Unknown demo document ${id}`);
  return makeDocument(ctx, { id, tripId: DEMO_TRIP_ID, ...src });
}

// ---------------------------------------------------------------------------
// Stage 1: planning (trip, plan options, existing wallet assets)

export function demoTrip(ctx: DemoContext): Trip {
  return {
    id: DEMO_TRIP_ID,
    workspaceId: ctx.workspaceId,
    title: 'San Francisco to New York',
    origin: { name: 'San Francisco', code: 'SFO' },
    destination: { name: 'New York', code: 'JFK' },
    startDate: '2026-11-20',
    endDate: '2026-11-23',
    displayTimezone: 'America/New_York',
    selectedPlanId: null,
    mode: 'sample',
    provenance: sampleProvenance(ctx, 'WayFare sample trip'),
    revision: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

function lineItem(ctx: DemoContext, id: Id, kind: Booking['kind'], description: string, price: Money | ReturnType<typeof unknownValue>) {
  return {
    id,
    kind,
    description,
    price,
    quoteId: null,
    expiresAt: null,
    provenance: sampleProvenance(ctx, `Sample ${'unknown' in price ? 'estimate' : 'quote'}: ${description}`),
  };
}

export function demoPlans(ctx: DemoContext): PlanOption[] {
  const base = { workspaceId: ctx.workspaceId, tripId: DEMO_TRIP_ID, revision: 1, createdAt: ctx.now, updatedAt: ctx.now, status: 'proposed' as const, expiresAt: null };
  return [
    {
      ...base,
      id: DEMO_IDS.plans.nonstop,
      label: 'Nonstop + Midtown hotel',
      summary: 'Morning nonstop on Bayline Air, 3 nights at Harbor Line Hotel Midtown, skyline walk, airport transfer.',
      lineItems: [
        lineItem(ctx, 'pli-demo-nonstop-flight', 'flight', 'Bayline Air BL 214 SFO-JFK, Basic Saver', usd(320)),
        lineItem(ctx, 'pli-demo-nonstop-hotel', 'hotel', 'Harbor Line Hotel Midtown, 3 nights', usd(450)),
        lineItem(ctx, 'pli-demo-nonstop-activity', 'activity', 'Lower Manhattan Skyline Walk', usd(80)),
        lineItem(ctx, 'pli-demo-nonstop-transfer', 'transfer', 'MetroLink JFK transfer', usd(50)),
      ],
      total: usd(900),
      convenience: 'high',
      flexibility: 'medium',
      assumptions: ['Basic Saver fare is non-refundable unless the airline cancels.', 'Hotel refund drops after 6:00 PM ET Nov 19.'],
    },
    {
      ...base,
      id: DEMO_IDS.plans.saver,
      label: 'Red-eye + Brooklyn hotel',
      summary: 'Overnight connecting flight, 3 nights in Brooklyn, skyline walk, shared shuttle.',
      lineItems: [
        lineItem(ctx, 'pli-demo-saver-flight', 'flight', 'Red-eye SFO-JFK with one stop', usd(290)),
        lineItem(ctx, 'pli-demo-saver-hotel', 'hotel', 'Brooklyn hotel, 3 nights', usd(380)),
        lineItem(ctx, 'pli-demo-saver-activity', 'activity', 'Lower Manhattan Skyline Walk', usd(80)),
        lineItem(ctx, 'pli-demo-saver-transfer', 'transfer', 'Shared airport shuttle', usd(65)),
      ],
      total: usd(815),
      convenience: 'low',
      flexibility: 'low',
      assumptions: ['Connection adds about 3 hours.', 'Hotel is non-refundable.'],
    },
    {
      ...base,
      id: DEMO_IDS.plans.flex,
      label: 'Refundable fare + flexible hotel',
      summary: 'Fully refundable nonstop and a free-cancellation hotel; transfer price not yet quoted.',
      lineItems: [
        lineItem(ctx, 'pli-demo-flex-flight', 'flight', 'Refundable nonstop SFO-JFK', usd(410)),
        lineItem(ctx, 'pli-demo-flex-hotel', 'hotel', 'Free-cancellation Midtown hotel, 3 nights', usd(520)),
        lineItem(ctx, 'pli-demo-flex-activity', 'activity', 'Lower Manhattan Skyline Walk', usd(80)),
        lineItem(ctx, 'pli-demo-flex-transfer', 'transfer', 'Private car transfer', unknownValue('No transfer quote received yet')),
      ],
      total: unknownValue('Transfer price not quoted'),
      convenience: 'high',
      flexibility: 'high',
      assumptions: ['Transfer price unknown until quoted.'],
    },
  ];
}

export function demoAssets(ctx: DemoContext): WalletAsset[] {
  const base = { workspaceId: ctx.workspaceId, tripId: null, revision: 1, createdAt: ctx.now, updatedAt: ctx.now, status: 'available' as const };
  return [
    {
      ...base,
      id: DEMO_IDS.assets.voucher,
      kind: 'voucher',
      issuer: 'Bayline Air',
      value: { unit: 'money', amount: usd(75) },
      restrictions: ['Bayline Air flights only', 'Not redeemable for cash', 'Non-transferable'],
      expiresAt: DEMO_TIMES.voucherExpires,
      sourceDocumentId: D.voucher,
      provenance: sampleProvenance(ctx, 'Bayline Air goodwill voucher BLA-GW-75', D.voucher),
    },
    {
      ...base,
      id: DEMO_IDS.assets.points,
      kind: 'points',
      issuer: 'Harbor Line Rewards',
      value: { unit: 'points', quantity: 8000, program: 'Harbor Line Rewards' },
      restrictions: ['Harbor Line Hotel stays only', 'No cash value'],
      expiresAt: DEMO_TIMES.pointsExpire,
      sourceDocumentId: D.points,
      provenance: sampleProvenance(ctx, 'Harbor Line Rewards statement', D.points),
    },
  ];
}

export function demoReplacementQuote(ctx: DemoContext): Quote {
  return {
    id: DEMO_IDS.quotes.replacementFlight,
    workspaceId: ctx.workspaceId,
    tripId: DEMO_TRIP_ID,
    kind: 'flight',
    provider: 'Bayline Air',
    description: 'Bayline Air BL 230 SFO-JFK, departs 9:15 AM PT, arrives 5:45 PM ET Nov 20',
    price: usd(360),
    startsAt: DEMO_TIMES.replacementDeparts,
    endsAt: DEMO_TIMES.replacementArrives,
    forBookingId: DEMO_IDS.bookings.flight,
    validUntil: DEMO_TIMES.replacementQuoteValidUntil,
    capability: 'simulated',
    provenance: sampleProvenance(ctx, 'Sample rebooking quote', D.replacementQuote),
    createdAt: ctx.now,
  };
}

// ---------------------------------------------------------------------------
// Stage 2: reviewed bookings + policies (what intake saves after review)

type BookingImport = { documentId: Id; booking: Booking; policy: PolicyEvidence };

function bookingBase(ctx: DemoContext, documentId: Id, source: string): Pick<Booking, 'workspaceId' | 'tripId' | 'state' | 'dependsOn' | 'evidenceDocumentIds' | 'replacesBookingId' | 'provenance' | 'revision' | 'createdAt' | 'updatedAt'> {
  return {
    workspaceId: ctx.workspaceId,
    tripId: DEMO_TRIP_ID,
    state: 'confirmed',
    dependsOn: [],
    evidenceDocumentIds: [documentId],
    replacesBookingId: null,
    provenance: { kind: 'imported_fact', source, recordedAt: ctx.now, documentId, excerpt: null },
    revision: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

function policyBase(ctx: DemoContext, bookingId: Id, documentId: Id, source: string) {
  return {
    workspaceId: ctx.workspaceId,
    tripId: DEMO_TRIP_ID,
    bookingId,
    sourceDocumentId: documentId,
    reviewState: 'reviewed' as const,
    unknownFields: [] as PolicyEvidence['unknownFields'],
    provenance: { kind: 'imported_fact' as const, source, recordedAt: ctx.now, documentId, excerpt: null },
    revision: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

const ALWAYS = { startsAtOrAfter: null, endsBefore: null };
const before = (t: Instant) => ({ startsAtOrAfter: null, endsBefore: t });
const atOrAfter = (t: Instant) => ({ startsAtOrAfter: t, endsBefore: null });

export function demoBookingImports(ctx: DemoContext): BookingImport[] {
  const B = DEMO_IDS.bookings;
  const P = DEMO_IDS.policies;
  const T = DEMO_IDS.tiers;
  return [
    {
      documentId: D.flightConfirmation,
      booking: {
        ...bookingBase(ctx, D.flightConfirmation, 'Bayline Air confirmation BLA7Q2'),
        id: B.flight,
        kind: 'flight',
        provider: 'Bayline Air',
        reference: 'BLA7Q2',
        title: 'BL 214 SFO to JFK',
        startsAt: DEMO_TIMES.flightDeparts,
        endsAt: DEMO_TIMES.flightArrives,
        localTimezone: 'America/Los_Angeles',
        paid: usd(320),
        policyId: P.flight,
      },
      policy: {
        ...policyBase(ctx, B.flight, D.flightConfirmation, 'Bayline Air fare rules'),
        id: P.flight,
        refundability: 'partially_refundable',
        refundTiers: [
          { id: T.flightProviderCancels, label: 'Airline cancels: full fare refund', condition: 'provider_cancels', window: ALWAYS, refund: usd(320), method: 'original_payment', excerptId: 'ex-demo-flight-provider' },
          { id: T.flightTravelerCancels, label: 'Traveler cancels: non-refundable', condition: 'traveler_cancels', window: ALWAYS, refund: usd(0), method: 'none', excerptId: 'ex-demo-flight-traveler' },
        ],
        deadlines: [],
        excerpts: [
          { id: 'ex-demo-flight-traveler', field: 'refundTiers[1]', text: 'Basic Saver fares are non-refundable if you cancel.' },
          { id: 'ex-demo-flight-provider', field: 'refundTiers[0]', text: 'If Bayline Air cancels your flight, you may request a full refund of the fare to your original form of payment.' },
        ],
      },
    },
    {
      documentId: D.hotelConfirmation,
      booking: {
        ...bookingBase(ctx, D.hotelConfirmation, 'Harbor Line Hotel confirmation HLH-48213'),
        id: B.hotel,
        kind: 'hotel',
        provider: 'Harbor Line Hotel Midtown',
        reference: 'HLH-48213',
        title: 'Harbor Line Hotel Midtown, 3 nights',
        startsAt: DEMO_TIMES.hotelCheckIn,
        endsAt: DEMO_TIMES.hotelCheckOut,
        localTimezone: 'America/New_York',
        paid: usd(450),
        policyId: P.hotel,
        dependsOn: [B.flight],
      },
      policy: {
        ...policyBase(ctx, B.hotel, D.hotelConfirmation, 'Harbor Line Hotel cancellation policy'),
        id: P.hotel,
        refundability: 'partially_refundable',
        refundTiers: [
          { id: T.hotelBefore, label: 'Cancel before 6:00 PM ET Nov 19: $400 refund', condition: 'any', window: before(DEMO_TIMES.hotelDeadline), refund: usd(400), method: 'original_payment', excerptId: 'ex-demo-hotel-before' },
          { id: T.hotelAfter, label: 'Cancel at or after 6:00 PM ET Nov 19: $200 refund', condition: 'any', window: atOrAfter(DEMO_TIMES.hotelDeadline), refund: usd(200), method: 'original_payment', excerptId: 'ex-demo-hotel-after' },
        ],
        deadlines: [
          { id: DEMO_IDS.deadlines.hotel, label: 'Hotel $400 refund deadline', at: DEMO_TIMES.hotelDeadline, displayTimezone: 'America/New_York', sourceWording: '6:00 PM ET on November 19, 2026' },
        ],
        excerpts: [
          { id: 'ex-demo-hotel-before', field: 'refundTiers[0]', text: 'Cancel before 6:00 PM ET on November 19, 2026 to receive a refund of $400.00 to your original payment method. The $50.00 booking fee is non-refundable.' },
          { id: 'ex-demo-hotel-after', field: 'refundTiers[1]', text: 'Cancellations at or after 6:00 PM ET on November 19, 2026 receive a refund of $200.00.' },
        ],
      },
    },
    {
      documentId: D.activityConfirmation,
      booking: {
        ...bookingBase(ctx, D.activityConfirmation, 'Skyline Walks order SKW-90551'),
        id: B.activity,
        kind: 'activity',
        provider: 'Skyline Walks NYC',
        reference: 'SKW-90551',
        title: 'Lower Manhattan Skyline Walk',
        startsAt: DEMO_TIMES.activityStarts,
        endsAt: DEMO_TIMES.activityEnds,
        localTimezone: 'America/New_York',
        paid: usd(80),
        policyId: P.activity,
        dependsOn: [B.flight],
      },
      policy: {
        ...policyBase(ctx, B.activity, D.activityConfirmation, 'Skyline Walks refund terms'),
        id: P.activity,
        refundability: 'partially_refundable',
        refundTiers: [
          { id: T.activityBefore, label: 'Cancel before 12:00 PM ET Nov 20: $60 refund', condition: 'any', window: before(DEMO_TIMES.activityDeadline), refund: usd(60), method: 'original_payment', excerptId: 'ex-demo-activity' },
          { id: T.activityAfter, label: 'No refund after 12:00 PM ET Nov 20', condition: 'any', window: atOrAfter(DEMO_TIMES.activityDeadline), refund: usd(0), method: 'none', excerptId: 'ex-demo-activity' },
        ],
        deadlines: [
          { id: DEMO_IDS.deadlines.activity, label: 'Skyline Walk refund deadline', at: DEMO_TIMES.activityDeadline, displayTimezone: 'America/New_York', sourceWording: '12:00 PM ET on November 20, 2026' },
        ],
        excerpts: [{ id: 'ex-demo-activity', field: 'refundTiers', text: 'Cancel before 12:00 PM ET on November 20, 2026 for a $60.00 refund to your card. No refunds after that time.' }],
      },
    },
    {
      documentId: D.transferConfirmation,
      booking: {
        ...bookingBase(ctx, D.transferConfirmation, 'MetroLink booking MLT-3307'),
        id: B.transfer,
        kind: 'transfer',
        provider: 'MetroLink Transfers',
        reference: 'MLT-3307',
        title: 'JFK to Harbor Line Hotel transfer',
        startsAt: DEMO_TIMES.transferPickup,
        endsAt: null,
        localTimezone: 'America/New_York',
        paid: usd(50),
        policyId: P.transfer,
        dependsOn: [B.flight],
      },
      policy: {
        ...policyBase(ctx, B.transfer, D.transferConfirmation, 'MetroLink cancellation terms'),
        id: P.transfer,
        refundability: 'partially_refundable',
        refundTiers: [
          { id: T.transferBefore, label: 'Cancel before 7:00 AM ET Nov 20: $40 refund', condition: 'any', window: before(DEMO_TIMES.transferDeadline), refund: usd(40), method: 'original_payment', excerptId: 'ex-demo-transfer' },
          { id: T.transferAfter, label: 'No refund at or after 7:00 AM ET Nov 20', condition: 'any', window: atOrAfter(DEMO_TIMES.transferDeadline), refund: usd(0), method: 'none', excerptId: 'ex-demo-transfer' },
        ],
        deadlines: [
          { id: DEMO_IDS.deadlines.transfer, label: 'Transfer refund deadline', at: DEMO_TIMES.transferDeadline, displayTimezone: 'America/New_York', sourceWording: '7:00 AM ET on November 20, 2026' },
        ],
        excerpts: [{ id: 'ex-demo-transfer', field: 'refundTiers', text: 'Cancel before 7:00 AM ET on November 20, 2026 to receive $40.00 back to your original payment. Later cancellations are not refunded.' }],
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Stage 3: disruption (triggered through ReRoute / demo controls)

export function demoDisruption(ctx: DemoContext): Disruption {
  return {
    id: DEMO_IDS.disruption,
    workspaceId: ctx.workspaceId,
    tripId: DEMO_TRIP_ID,
    bookingId: DEMO_IDS.bookings.flight,
    type: 'cancellation',
    description: 'Bayline Air cancelled BL 214 SFO-JFK on Nov 20 (aircraft maintenance).',
    effectiveAt: ctx.now,
    detectedAt: ctx.now,
    source: 'Sample carrier notice',
    sourceDocumentId: D.disruptionNotice,
    capability: 'simulated',
    status: 'active',
    createdAt: ctx.now,
  };
}

// ---------------------------------------------------------------------------
// Stage 4: post-cancellation evidence (TripWallet imports these)

/** Structured receipts matching HOTEL_RECEIPT_1/2. Brian's matcher allocates them to the hotel claim. */
export function demoReceipts(ctx: DemoContext): Receipt[] {
  const base = {
    workspaceId: ctx.workspaceId,
    tripId: DEMO_TRIP_ID,
    merchant: 'HARBOR LINE HOTEL MIDTOWN',
    bookingReferenceHint: 'HLH-48213',
    matchState: 'unmatched' as const,
    reviewState: 'pending_review' as const,
    revision: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  return [
    {
      ...base,
      id: DEMO_IDS.receipts.hotel1,
      reference: 'HLH-RF-0001',
      amount: usd(250),
      receivedAt: DEMO_TIMES.hotelReceipt1At,
      sourceDocumentId: D.hotelReceipt1,
      provenance: { kind: 'received_transaction', source: 'Sample card statement credit HLH-RF-0001', recordedAt: ctx.now, documentId: D.hotelReceipt1, excerpt: 'Amount: $250.00 USD credit' },
    },
    {
      ...base,
      id: DEMO_IDS.receipts.hotel2,
      reference: 'HLH-RF-0002',
      amount: usd(150),
      receivedAt: DEMO_TIMES.hotelReceipt2At,
      sourceDocumentId: D.hotelReceipt2,
      provenance: { kind: 'received_transaction', source: 'Sample card statement credit HLH-RF-0002', recordedAt: ctx.now, documentId: D.hotelReceipt2, excerpt: 'Amount: $150.00 USD credit' },
    },
  ];
}

/** Provider confirmation facts for the hotel refund (from HOTEL_REFUND_CONFIRMATION). */
export const DEMO_HOTEL_REFUND_CONFIRMATION = {
  documentId: D.hotelRefundConfirmation,
  bookingId: DEMO_IDS.bookings.hotel,
  confirmedAmount: usd(400),
  dueAt: DEMO_TIMES.hotelRefundDue,
  sourceWording: 'will be issued by November 25, 2026 6:00 PM ET',
} as const;
