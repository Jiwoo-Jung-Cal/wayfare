// Canonical domain schema, version 1.
//
// This file is the single source for entity shapes. TypeScript types are
// inferred from these Zod schemas; frontend and server code both import them.
// Do not hand-copy these shapes elsewhere. Request changes from Agent 1 (#3).
//
// Conventions: see ids.ts (IDs), time.ts (instants, deadline boundary),
// money.ts (integer minor units, unknown is not zero).
// Every persisted entity carries workspaceId; the repository enforces scoping.

import { z } from 'zod';
import { IdSchema } from './ids.ts';
import { InstantSchema, LocalDateSchema, TimeWindowSchema, TimeZoneSchema, ClockStateSchema } from './time.ts';
import { MaybeMoneySchema, MoneySchema, UnknownValueSchema } from './money.ts';

export const SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Shared enums

export const OPERATING_MODES = ['sample', 'connected'] as const;
export const OperatingModeSchema = z.enum(OPERATING_MODES);
export type OperatingMode = z.infer<typeof OperatingModeSchema>;

/** Whether a capability really happened ("live") or was simulated from fixtures. */
export const CAPABILITY_STATUSES = ['live', 'simulated'] as const;
export const CapabilityStatusSchema = z.enum(CAPABILITY_STATUSES);
export type CapabilityStatus = z.infer<typeof CapabilityStatusSchema>;

export const BOOKING_KINDS = ['flight', 'hotel', 'activity', 'transfer', 'other'] as const;
export const BookingKindSchema = z.enum(BOOKING_KINDS);
export type BookingKind = z.infer<typeof BookingKindSchema>;

export const BOOKING_STATES = ['confirmed', 'disrupted', 'cancelled', 'replaced', 'changed'] as const;
export const BookingStateSchema = z.enum(BOOKING_STATES);
export type BookingState = z.infer<typeof BookingStateSchema>;

export const RECOVERY_METHODS = ['original_payment', 'travel_credit', 'voucher', 'points', 'none', 'unknown'] as const;
export const RecoveryMethodSchema = z.enum(RECOVERY_METHODS);
export type RecoveryMethod = z.infer<typeof RecoveryMethodSchema>;

export const RATINGS = ['low', 'medium', 'high'] as const;
export const RatingSchema = z.enum(RATINGS);
export type Rating = z.infer<typeof RatingSchema>;

// ---------------------------------------------------------------------------
// DataProvenance: where a value came from.

export const PROVENANCE_KINDS = [
  'sample', // fictional fixture data
  'quote', // price quote, may expire
  'estimate', // planning estimate
  'imported_fact', // reviewed fact from an imported document
  'ai_extracted', // AI-extracted, not yet reviewed
  'user_entered',
  'provider_confirmation', // provider/merchant confirmed (e.g. refund confirmation email)
  'received_transaction', // money actually received (receipt)
  'computed', // deterministic calculation by an owning module
] as const;
export const ProvenanceKindSchema = z.enum(PROVENANCE_KINDS);
export type ProvenanceKind = z.infer<typeof ProvenanceKindSchema>;

export const DataProvenanceSchema = z.strictObject({
  kind: ProvenanceKindSchema,
  /** Human-readable source, e.g. "Harbor Line Hotel confirmation HLH-48213". */
  source: z.string().min(1),
  recordedAt: InstantSchema,
  documentId: IdSchema.nullable().default(null),
  /** Supporting excerpt from the source document, when available. */
  excerpt: z.string().nullable().default(null),
});
export type DataProvenance = z.infer<typeof DataProvenanceSchema>;

// ---------------------------------------------------------------------------
// Workspace

export const WorkspaceSchema = z.strictObject({
  id: IdSchema,
  mode: OperatingModeSchema,
  label: z.string(),
  createdAt: InstantSchema,
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

const entityBase = {
  id: IdSchema,
  workspaceId: IdSchema,
  createdAt: InstantSchema,
};
const mutableBase = {
  ...entityBase,
  /** Optimistic-concurrency revision; starts at 1, +1 per write. */
  revision: z.number().int().min(1),
  updatedAt: InstantSchema,
};

// ---------------------------------------------------------------------------
// Trip

export const PlaceSchema = z.strictObject({
  name: z.string().min(1),
  /** IATA or other short code, when known. */
  code: z.string().nullable().default(null),
});
export type Place = z.infer<typeof PlaceSchema>;

export const TripSchema = z.strictObject({
  ...mutableBase,
  title: z.string().min(1),
  origin: PlaceSchema,
  destination: PlaceSchema,
  startDate: LocalDateSchema,
  endDate: LocalDateSchema,
  displayTimezone: TimeZoneSchema,
  selectedPlanId: IdSchema.nullable(),
  mode: OperatingModeSchema,
  provenance: DataProvenanceSchema,
});
export type Trip = z.infer<typeof TripSchema>;

// ---------------------------------------------------------------------------
// Quote (replacement or plan price quote)

export const QuoteSchema = z.strictObject({
  ...entityBase,
  tripId: IdSchema,
  kind: BookingKindSchema,
  provider: z.string().min(1),
  description: z.string().min(1),
  price: MoneySchema,
  startsAt: InstantSchema.nullable(),
  endsAt: InstantSchema.nullable(),
  /** Booking this quote would replace, if any. */
  forBookingId: IdSchema.nullable(),
  validUntil: InstantSchema.nullable(),
  capability: CapabilityStatusSchema,
  provenance: DataProvenanceSchema,
});
export type Quote = z.infer<typeof QuoteSchema>;

// ---------------------------------------------------------------------------
// PlanOption (proposed itinerary; distinct from confirmed bookings)

export const PlanLineItemSchema = z.strictObject({
  id: IdSchema,
  kind: BookingKindSchema,
  description: z.string().min(1),
  price: MaybeMoneySchema,
  quoteId: IdSchema.nullable(),
  expiresAt: InstantSchema.nullable(),
  provenance: DataProvenanceSchema,
});
export type PlanLineItem = z.infer<typeof PlanLineItemSchema>;

export const PLAN_STATUSES = ['proposed', 'selected', 'expired', 'archived'] as const;

export const PlanOptionSchema = z.strictObject({
  ...mutableBase,
  tripId: IdSchema,
  label: z.string().min(1),
  summary: z.string(),
  lineItems: z.array(PlanLineItemSchema),
  /** Computed by Wayfinder (Agent 2). Unknown if any line item price is unknown. */
  total: MaybeMoneySchema,
  convenience: RatingSchema,
  flexibility: RatingSchema,
  assumptions: z.array(z.string()),
  expiresAt: InstantSchema.nullable(),
  status: z.enum(PLAN_STATUSES),
});
export type PlanOption = z.infer<typeof PlanOptionSchema>;

// ---------------------------------------------------------------------------
// EvidenceDocument (original source text, kept verbatim)

export const DOCUMENT_KINDS = [
  'booking_confirmation',
  'disruption_notice',
  'refund_confirmation',
  'receipt',
  'quote',
  'wallet_statement',
  'other',
] as const;
export const DocumentKindSchema = z.enum(DOCUMENT_KINDS);
export type DocumentKind = z.infer<typeof DocumentKindSchema>;

export const EvidenceDocumentSchema = z.strictObject({
  ...entityBase,
  tripId: IdSchema.nullable(),
  kind: DocumentKindSchema,
  title: z.string().min(1),
  /** Original text as received. Treated as data, never as instructions. */
  text: z.string().min(1).max(50_000),
  /** sha256Hex(normalizeDocumentText(text)); unique per workspace + kind. */
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  receivedAt: InstantSchema,
  isSample: z.boolean(),
  provenance: DataProvenanceSchema,
});
export type EvidenceDocument = z.infer<typeof EvidenceDocumentSchema>;

// ---------------------------------------------------------------------------
// Booking

export const BookingSchema = z.strictObject({
  ...mutableBase,
  tripId: IdSchema,
  kind: BookingKindSchema,
  provider: z.string().min(1),
  reference: z.string().min(1),
  title: z.string().min(1),
  startsAt: InstantSchema,
  endsAt: InstantSchema.nullable(),
  /** Timezone used to display this booking's local times and deadlines. */
  localTimezone: TimeZoneSchema,
  paid: MaybeMoneySchema,
  state: BookingStateSchema,
  policyId: IdSchema.nullable(),
  /** Bookings this one depends on (e.g. hotel depends on outbound flight arriving). */
  dependsOn: z.array(IdSchema),
  evidenceDocumentIds: z.array(IdSchema),
  replacesBookingId: IdSchema.nullable(),
  provenance: DataProvenanceSchema,
});
export type Booking = z.infer<typeof BookingSchema>;

// ---------------------------------------------------------------------------
// PolicyEvidence: validated, source-backed cancellation/refund rules.
// Missing information is recorded in unknownFields and refundability "unknown";
// never invent a rule.

export const SourceExcerptSchema = z.strictObject({
  id: IdSchema,
  /** Which extracted field this supports, e.g. "refundTiers[0]" or "deadline". */
  field: z.string().min(1),
  text: z.string().min(1),
});
export type SourceExcerpt = z.infer<typeof SourceExcerptSchema>;

export const TIER_CONDITIONS = ['any', 'traveler_cancels', 'provider_cancels'] as const;

export const RefundTierSchema = z.strictObject({
  id: IdSchema,
  label: z.string().min(1),
  /** Who initiates the cancellation for this tier to apply. */
  condition: z.enum(TIER_CONDITIONS),
  /** Half-open window [startsAtOrAfter, endsBefore) in which the action time must fall. */
  window: TimeWindowSchema,
  /** Cash (or credit) recovered if cancelled within the window. Unknown is allowed. */
  refund: MaybeMoneySchema,
  method: RecoveryMethodSchema,
  excerptId: IdSchema.nullable(),
});
export type RefundTier = z.infer<typeof RefundTierSchema>;

export const PolicyDeadlineSchema = z.strictObject({
  id: IdSchema,
  label: z.string().min(1),
  /** UTC instant. Met only when actionTime < at. */
  at: InstantSchema,
  displayTimezone: TimeZoneSchema,
  /** The source's own wording, e.g. "6:00 PM ET on November 19, 2026". */
  sourceWording: z.string().min(1),
});
export type PolicyDeadline = z.infer<typeof PolicyDeadlineSchema>;

export const REFUNDABILITY = ['refundable', 'partially_refundable', 'non_refundable', 'unknown'] as const;
export const POLICY_REVIEW_STATES = ['extracted_unreviewed', 'needs_review', 'reviewed'] as const;

export const PolicyEvidenceSchema = z.strictObject({
  ...mutableBase,
  tripId: IdSchema,
  bookingId: IdSchema,
  sourceDocumentId: IdSchema.nullable(),
  refundability: z.enum(REFUNDABILITY),
  refundTiers: z.array(RefundTierSchema),
  deadlines: z.array(PolicyDeadlineSchema),
  excerpts: z.array(SourceExcerptSchema),
  /** Fields the source did not support, with the reason. */
  unknownFields: z.array(z.strictObject({ field: z.string().min(1), reason: z.string().min(1) })),
  reviewState: z.enum(POLICY_REVIEW_STATES),
  provenance: DataProvenanceSchema,
});
export type PolicyEvidence = z.infer<typeof PolicyEvidenceSchema>;

// ---------------------------------------------------------------------------
// Disruption

export const DISRUPTION_TYPES = ['cancellation', 'delay', 'schedule_change', 'missed_connection'] as const;

export const DisruptionSchema = z.strictObject({
  ...entityBase,
  tripId: IdSchema,
  bookingId: IdSchema,
  type: z.enum(DISRUPTION_TYPES),
  description: z.string().min(1),
  effectiveAt: InstantSchema,
  detectedAt: InstantSchema,
  source: z.string().min(1),
  sourceDocumentId: IdSchema.nullable(),
  capability: CapabilityStatusSchema,
  status: z.enum(['active', 'resolved']),
});
export type Disruption = z.infer<typeof DisruptionSchema>;

// ---------------------------------------------------------------------------
// Asset values (cash vs noncash kept distinct)

export const AssetValueSchema = z.discriminatedUnion('unit', [
  z.strictObject({ unit: z.literal('money'), amount: MaybeMoneySchema }),
  z.strictObject({
    unit: z.literal('points'),
    quantity: z.union([z.number().int().min(0), UnknownValueSchema]),
    program: z.string().min(1),
  }),
]);
export type AssetValue = z.infer<typeof AssetValueSchema>;

// ---------------------------------------------------------------------------
// RecoveryOption (computed by ReRoute / Agent 4)

export const BOOKING_ACTIONS = ['keep', 'cancel', 'replace', 'change'] as const;
export const BookingActionSchema = z.enum(BOOKING_ACTIONS);
export type BookingAction = z.infer<typeof BookingActionSchema>;

export const RecoveryBookingActionSchema = z.strictObject({
  bookingId: IdSchema,
  action: BookingActionSchema,
  replacementQuoteId: IdSchema.nullable(),
  /** Tier applied for the expected recovery, if any. */
  refundTierId: IdSchema.nullable(),
  expectedRecovery: MaybeMoneySchema,
  method: RecoveryMethodSchema,
});
export type RecoveryBookingAction = z.infer<typeof RecoveryBookingActionSchema>;

export const RecoveryOptionSchema = z.strictObject({
  ...entityBase,
  tripId: IdSchema,
  disruptionId: IdSchema.nullable(),
  kind: z.enum(['continue', 'cancel_trip', 'custom']),
  label: z.string().min(1),
  bookingActions: z.array(RecoveryBookingActionSchema),
  /** Extra cash paid now (e.g. replacement flight). */
  extraCashNeeded: MaybeMoneySchema,
  /** Total expected cash refunds. Excludes vouchers/points. */
  expectedCashRecovery: MaybeMoneySchema,
  /** Cash out of pocket before any refund arrives. */
  cashPaidBeforeRefunds: MaybeMoneySchema,
  /** Forecast cost after expected refunds (continue) or unrecovered cost (cancel). */
  forecastCost: MaybeMoneySchema,
  noncashEffects: z.array(z.strictObject({ description: z.string().min(1), assetId: IdSchema.nullable() })),
  constraints: z.array(z.string()),
  assumptions: z.array(z.string()),
  evidenceDocumentIds: z.array(IdSchema),
  /** Clock instant the option was computed at. */
  computedAt: InstantSchema,
  /** Option becomes stale at this instant (e.g. earliest crossed deadline). */
  validUntil: InstantSchema.nullable(),
});
export type RecoveryOption = z.infer<typeof RecoveryOptionSchema>;

// ---------------------------------------------------------------------------
// ActionRecord (recorded by ReRoute; approval does not prove a real cancellation)

export const ExpectedRecoveryComponentSchema = z.strictObject({
  /** Stable within the action; claims are keyed by (actionRecordId, componentId). */
  id: IdSchema,
  kind: z.enum(['cash_refund', 'travel_credit', 'voucher', 'points']),
  value: AssetValueSchema,
  method: RecoveryMethodSchema,
  refundTierId: IdSchema.nullable(),
  /** Expected due date, if the policy states one. */
  dueAt: InstantSchema.nullable(),
  dueAtSource: z.string().nullable(),
});
export type ExpectedRecoveryComponent = z.infer<typeof ExpectedRecoveryComponentSchema>;

export const ACTION_RESULT_STATUSES = ['simulated', 'provider_confirmed', 'pending', 'failed'] as const;

export const ActionRecordSchema = z.strictObject({
  ...entityBase,
  tripId: IdSchema,
  bookingId: IdSchema,
  recoveryOptionId: IdSchema.nullable(),
  disruptionId: IdSchema.nullable(),
  action: BookingActionSchema,
  replacementQuoteId: IdSchema.nullable(),
  /** Replays with the same key return the original record and change nothing. */
  idempotencyKey: z.string().min(8).max(200),
  expectedRecovery: z.array(ExpectedRecoveryComponentSchema),
  /** Booking state written atomically with this record. */
  resultingBookingState: BookingStateSchema,
  result: z.strictObject({ status: z.enum(ACTION_RESULT_STATUSES), detail: z.string() }),
  capability: CapabilityStatusSchema,
  /** Active-clock instant at approval (sample clock in sample mode). */
  approvedAt: InstantSchema,
});
export type ActionRecord = z.infer<typeof ActionRecordSchema>;

/**
 * Optional conditions a recorded action was previewed under. The repository
 * checks them inside the same exclusive write as recordBookingAction, against
 * the stored policy, the active clock and the stored quote; any failure returns
 * a non-retryable "conflict" and changes nothing. A successful idempotent replay
 * (same idempotencyKey already recorded) returns the original record without
 * re-checking, so a retry after a lost response can still notify the shell.
 */
export const ActionPreconditionsSchema = z.strictObject({
  /** Policy the preview used, or null if the booking had no policy. Must equal booking.policyId at write time. */
  policyId: IdSchema.nullable(),
  /** Stored policy revision the preview read; null exactly when policyId is null. */
  expectedPolicyRevision: z.number().int().min(1).nullable(),
  /** Exclusive cutoff: the write succeeds only while active-clock now < validBefore (null = no cutoff). */
  validBefore: InstantSchema.nullable(),
  /** If set, the stored clock state must equal this (e.g. the sample instant the preview was computed at). */
  expectedClock: ClockStateSchema.optional(),
  /**
   * If present, must equal action.replacementQuoteId. A non-null quote must exist in this trip,
   * be for this booking (or unbound), and still be valid (now < quote.validUntil when set).
   */
  replacementQuoteId: IdSchema.nullable().optional(),
});
export type ActionPreconditions = z.infer<typeof ActionPreconditionsSchema>;

// ---------------------------------------------------------------------------
// RefundClaim (created/updated by TripWallet / Agent 5 from ActionRecords)

export const CLAIM_STATUSES = [
  'expected', // created from action, nothing confirmed or received
  'provider_confirmed', // provider confirmed amount/due date
  'partially_received',
  'received', // fully reconciled
  'overdue',
  'needs_review',
  'closed_unrecovered',
] as const;

export const ClaimAllocationSchema = z.strictObject({
  id: IdSchema,
  receiptId: IdSchema,
  amount: MoneySchema,
  allocatedAt: InstantSchema,
});
export type ClaimAllocation = z.infer<typeof ClaimAllocationSchema>;

export const RefundClaimSchema = z.strictObject({
  ...mutableBase,
  tripId: IdSchema,
  bookingId: IdSchema,
  actionRecordId: IdSchema,
  recoveryComponentId: IdSchema,
  expected: MaybeMoneySchema,
  method: RecoveryMethodSchema,
  providerConfirmed: MaybeMoneySchema,
  confirmationDocumentId: IdSchema.nullable(),
  due: z.strictObject({ at: InstantSchema, provenance: DataProvenanceSchema }).nullable(),
  allocations: z.array(ClaimAllocationSchema),
  /** Computed by TripWallet; unknown if the owed amount is unknown. */
  outstanding: MaybeMoneySchema,
  status: z.enum(CLAIM_STATUSES),
});
export type RefundClaim = z.infer<typeof RefundClaimSchema>;

// ---------------------------------------------------------------------------
// Receipt (money actually received)

export const ReceiptSchema = z.strictObject({
  ...mutableBase,
  tripId: IdSchema.nullable(),
  /** Provider/bank transaction reference. Unique per workspace (duplicate protection). */
  reference: z.string().min(1),
  amount: MoneySchema,
  receivedAt: InstantSchema,
  merchant: z.string().min(1),
  bookingReferenceHint: z.string().nullable(),
  sourceDocumentId: IdSchema.nullable(),
  matchState: z.enum(['unmatched', 'suggested', 'matched', 'ambiguous', 'rejected']),
  reviewState: z.enum(['pending_review', 'reviewed']),
  provenance: DataProvenanceSchema,
});
export type Receipt = z.infer<typeof ReceiptSchema>;

// ---------------------------------------------------------------------------
// WalletAsset (vouchers, credits, points: never counted as cash received)

export const WalletAssetSchema = z.strictObject({
  ...mutableBase,
  tripId: IdSchema.nullable(),
  kind: z.enum(['voucher', 'travel_credit', 'points']),
  issuer: z.string().min(1),
  value: AssetValueSchema,
  restrictions: z.array(z.string()),
  expiresAt: InstantSchema.nullable(),
  status: z.enum(['available', 'reserved', 'redeemed', 'expired']),
  sourceDocumentId: IdSchema.nullable(),
  provenance: DataProvenanceSchema,
});
export type WalletAsset = z.infer<typeof WalletAssetSchema>;

// ---------------------------------------------------------------------------
// Workspace snapshot (sample-mode persistence and export format)

export const WorkspaceSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  workspace: WorkspaceSchema,
  clock: ClockStateSchema,
  trips: z.array(TripSchema),
  plans: z.array(PlanOptionSchema),
  quotes: z.array(QuoteSchema),
  documents: z.array(EvidenceDocumentSchema),
  bookings: z.array(BookingSchema),
  policies: z.array(PolicyEvidenceSchema),
  disruptions: z.array(DisruptionSchema),
  recoveryOptions: z.array(RecoveryOptionSchema),
  actions: z.array(ActionRecordSchema),
  claims: z.array(RefundClaimSchema),
  receipts: z.array(ReceiptSchema),
  assets: z.array(WalletAssetSchema),
  /** Replay log for idempotent writes that are not keyed by their own record (e.g. reviewed booking saves). */
  idempotencyKeys: z.array(
    z.strictObject({ key: z.string().min(8).max(200), operation: z.string().min(1), resultId: IdSchema, createdAt: InstantSchema }),
  ),
});
export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;

export type WorkspaceCollection = Exclude<keyof WorkspaceSnapshot, 'schemaVersion' | 'workspace' | 'clock' | 'idempotencyKeys'>;
