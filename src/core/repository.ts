// Generic workspace-scoped persistence interface (contract v1).
//
// One interface, two implementations:
//   - LocalRepository (sample mode): browser localStorage, this visitor only.
//   - HttpRepository (connected mode): server API with a guest session token.
// Feature owners implement their business rules on top of these generic
// operations; the repository enforces schema validity, workspace scoping,
// optimistic revisions, idempotency and uniqueness constraints.
//
// Write semantics:
//   save*(entity, { expectedRevision }) -- expectedRevision null = insert (entity.revision must be 1);
//   otherwise the stored revision must equal expectedRevision. The stored
//   result has revision expectedRevision + 1 and updatedAt = active clock now.
//   A mismatch returns error "conflict" (reload and retry).
// Connected-mode failures are returned as errors; they never fall back to sample data.

import type { Id } from './ids.ts';
import type { Result } from './result.ts';
import type { ClockState } from './time.ts';
import type {
  ActionPreconditions,
  ActionRecord,
  Booking,
  Disruption,
  EvidenceDocument,
  OperatingMode,
  PlanOption,
  PolicyEvidence,
  Quote,
  Receipt,
  RecoveryOption,
  RefundClaim,
  Trip,
  WalletAsset,
  Workspace,
  WorkspaceSnapshot,
} from './schema.ts';

export type RepositoryCapabilities = {
  mode: OperatingMode;
  persistence: 'browser_local' | 'server';
  /** Survives reload in this browser (local) or across devices (server). */
  durable: boolean;
  description: string;
};

export type Revision = { expectedRevision: number | null };

/** Which canned state a demo reset seeds. */
export type DemoSeedStage =
  | 'empty' // workspace with no trip
  | 'planning' // trip-demo-nyc + plan options + wallet assets + replacement quote
  | 'booked'; // planning + the four reviewed bookings/policies, selected nonstop plan

export type SaveReviewedBookingInput = {
  /** e.g. "intake:<documentContentHash>". Replays return the original result. */
  idempotencyKey: string;
  document: EvidenceDocument;
  booking: Booking;
  policy: PolicyEvidence | null;
};
export type SaveReviewedBookingResult = {
  document: EvidenceDocument;
  booking: Booking;
  policy: PolicyEvidence | null;
  replayed: boolean;
};

export type RecordBookingActionInput = {
  action: ActionRecord;
  /** Current revision of the booking being changed (optimistic check). */
  expectedBookingRevision: number;
  /**
   * Optional (additive, contract v1-compatible): policy revision, active-clock cutoff and
   * replacement-quote conditions the preview relied on, enforced in the same atomic write.
   * See ActionPreconditionsSchema in schema.ts.
   */
  preconditions?: ActionPreconditions;
};
export type RecordBookingActionResult = { action: ActionRecord; booking: Booking; replayed: boolean };

export type EnsureClaimsResult = {
  /** Stored claims for the requested keys, in input order (existing claims keep their ID and state). */
  claims: RefundClaim[];
  created: number;
  existing: number;
};

export interface WorkspaceRepository {
  readonly capabilities: RepositoryCapabilities;

  getWorkspace(): Promise<Result<Workspace>>;
  /** Whole workspace state (used by the shell for refresh and by export/debug). */
  snapshot(): Promise<Result<WorkspaceSnapshot>>;

  getClock(): Promise<Result<ClockState>>;
  setClock(state: ClockState): Promise<Result<ClockState>>;

  /** Re-seed ONLY this workspace. Never touches other visitors' data. */
  resetDemo(stage: DemoSeedStage): Promise<Result<WorkspaceSnapshot>>;

  listTrips(): Promise<Result<Trip[]>>;
  getTrip(tripId: Id): Promise<Result<Trip>>;
  saveTrip(trip: Trip, rev: Revision): Promise<Result<Trip>>;

  listPlans(tripId: Id): Promise<Result<PlanOption[]>>;
  savePlan(plan: PlanOption, rev: Revision): Promise<Result<PlanOption>>;
  /** Marks the plan selected (others proposed) and sets trip.selectedPlanId atomically. */
  selectPlan(input: { tripId: Id; planId: Id; expectedTripRevision: number }): Promise<Result<Trip>>;

  listQuotes(tripId: Id): Promise<Result<Quote[]>>;
  saveQuote(quote: Quote): Promise<Result<Quote>>;

  listDocuments(tripId: Id | null): Promise<Result<EvidenceDocument[]>>;
  getDocument(documentId: Id): Promise<Result<EvidenceDocument>>;
  /** Insert-if-absent by (kind, contentHash). An identical document returns the existing one with created=false. */
  putDocument(document: EvidenceDocument): Promise<Result<{ document: EvidenceDocument; created: boolean }>>;

  listBookings(tripId: Id): Promise<Result<Booking[]>>;
  getBooking(bookingId: Id): Promise<Result<Booking>>;
  saveBooking(booking: Booking, rev: Revision): Promise<Result<Booking>>;
  listPolicies(tripId: Id): Promise<Result<PolicyEvidence[]>>;
  getPolicy(policyId: Id): Promise<Result<PolicyEvidence>>;
  savePolicy(policy: PolicyEvidence, rev: Revision): Promise<Result<PolicyEvidence>>;
  /** Atomic: evidence document + booking + policy. Duplicate document import returns the existing booking. */
  saveReviewedBooking(input: SaveReviewedBookingInput): Promise<Result<SaveReviewedBookingResult>>;

  listDisruptions(tripId: Id): Promise<Result<Disruption[]>>;
  /** Insert-if-absent by ID. */
  recordDisruption(disruption: Disruption): Promise<Result<{ disruption: Disruption; created: boolean }>>;

  listRecoveryOptions(tripId: Id): Promise<Result<RecoveryOption[]>>;
  /** Replaces the stored options for (tripId, disruptionId). */
  replaceRecoveryOptions(input: { tripId: Id; disruptionId: Id | null; options: RecoveryOption[] }): Promise<Result<RecoveryOption[]>>;

  listActions(tripId: Id): Promise<Result<ActionRecord[]>>;
  /** Atomic + idempotent: ActionRecord and booking.state = action.resultingBookingState. */
  recordBookingAction(input: RecordBookingActionInput): Promise<Result<RecordBookingActionResult>>;

  listClaims(tripId: Id): Promise<Result<RefundClaim[]>>;
  /**
   * Idempotent insert-if-absent keyed by (actionRecordId, recoveryComponentId).
   * Existing claims are returned untouched (allocations are never overwritten);
   * change an existing claim with saveClaim. Use from syncClaimsFromActions.
   */
  ensureClaims(claims: RefundClaim[]): Promise<Result<EnsureClaimsResult>>;
  saveClaim(claim: RefundClaim, rev: Revision): Promise<Result<RefundClaim>>;

  listReceipts(tripId: Id | null): Promise<Result<Receipt[]>>;
  /** Insert-if-absent by reference. Same reference + same amount = replay (created=false); different content = "duplicate" error. */
  putReceipt(receipt: Receipt): Promise<Result<{ receipt: Receipt; created: boolean }>>;
  saveReceipt(receipt: Receipt, rev: Revision): Promise<Result<Receipt>>;

  listAssets(): Promise<Result<WalletAsset[]>>;
  saveAsset(asset: WalletAsset, rev: Revision): Promise<Result<WalletAsset>>;
}
