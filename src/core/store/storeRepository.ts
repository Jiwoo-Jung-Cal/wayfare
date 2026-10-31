// Snapshot-backed implementation of WorkspaceRepository.
//
// Holds ONE workspace's snapshot and enforces every v1 constraint: schema
// validation, workspace scoping, optimistic revisions, idempotent replays and
// uniqueness. Each write runs on a cloned draft and is committed only after the
// persistence callback succeeds, so a failed write leaves state unchanged
// (atomic per operation). Operations are serialized.
//
// Used by LocalRepository (browser) and by the server (one instance per workspace).

import type { z } from 'zod';
import type { Id } from '../ids.ts';
import { err, ok, parseWith, type Result } from '../result.ts';
import { ClockStateSchema, createClock, type ClockState, type Instant } from '../time.ts';
import {
  ActionRecordSchema,
  BookingSchema,
  DisruptionSchema,
  EvidenceDocumentSchema,
  PlanOptionSchema,
  PolicyEvidenceSchema,
  QuoteSchema,
  ReceiptSchema,
  RecoveryOptionSchema,
  RefundClaimSchema,
  TripSchema,
  WalletAssetSchema,
  WorkspaceSnapshotSchema,
  type Booking,
  type RefundClaim,
  type WorkspaceSnapshot,
} from '../schema.ts';
import type {
  DemoSeedStage,
  EnsureClaimsResult,
  RecordBookingActionInput,
  RecordBookingActionResult,
  RepositoryCapabilities,
  Revision,
  SaveReviewedBookingInput,
  SaveReviewedBookingResult,
  WorkspaceRepository,
} from '../repository.ts';
import { buildDemoSnapshot } from '../fixtures/seed.ts';

export type SnapshotPersistence = {
  load(): Promise<Result<WorkspaceSnapshot | null>>;
  save(snapshot: WorkspaceSnapshot): Promise<Result<void>>;
};

type Versioned = { id: Id; workspaceId: Id; revision: number; createdAt: Instant; updatedAt: Instant };
type VersionedCollection = 'trips' | 'plans' | 'bookings' | 'policies' | 'claims' | 'receipts' | 'assets';

const clone = <T>(v: T): T => structuredClone(v);
const byTrip = <T extends { tripId: Id | null }>(items: T[], tripId: Id | null) =>
  tripId === null ? items : items.filter((i) => i.tripId === tripId);

/** Comparable form of a document/receipt reference. */
export function normalizeReference(ref: string): string {
  return ref.trim().toUpperCase().replace(/\s+/g, '');
}

export class StoreRepository implements WorkspaceRepository {
  readonly capabilities: RepositoryCapabilities;
  private state: WorkspaceSnapshot | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly persistence: SnapshotPersistence;
  private readonly initial: () => Promise<WorkspaceSnapshot>;

  /**
   * @param initial snapshot used when persistence has nothing stored yet.
   */
  constructor(opts: { capabilities: RepositoryCapabilities; persistence: SnapshotPersistence; initial: () => Promise<WorkspaceSnapshot> }) {
    this.capabilities = opts.capabilities;
    this.persistence = opts.persistence;
    this.initial = opts.initial;
  }

  // -- plumbing ------------------------------------------------------------

  private serialize<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async load(): Promise<Result<WorkspaceSnapshot>> {
    if (this.state) return ok(this.state);
    const loaded = await this.persistence.load();
    if (!loaded.ok) return loaded;
    if (loaded.value === null) {
      const fresh = await this.initial();
      const saved = await this.persistence.save(fresh);
      if (!saved.ok) return saved;
      this.state = fresh;
      return ok(fresh);
    }
    const parsed = parseWith(WorkspaceSnapshotSchema, loaded.value, 'Stored workspace data is invalid; reset the demo workspace');
    if (!parsed.ok) return parsed;
    this.state = parsed.value;
    return ok(parsed.value);
  }

  private read<T>(fn: (s: WorkspaceSnapshot) => Result<T>): Promise<Result<T>> {
    return this.serialize(async () => {
      const s = await this.load();
      if (!s.ok) return s;
      const r = fn(s.value);
      return r.ok ? ok(clone(r.value)) : r;
    });
  }

  /** Run fn on a draft; commit only if fn succeeds AND persistence succeeds. */
  private write<T>(fn: (draft: WorkspaceSnapshot, now: Instant) => Result<T> | Promise<Result<T>>): Promise<Result<T>> {
    return this.serialize(async () => {
      const s = await this.load();
      if (!s.ok) return s;
      const draft = clone(s.value);
      const r = await fn(draft, createClock(draft.clock).now());
      if (!r.ok) return r;
      const saved = await this.persistence.save(draft);
      if (!saved.ok) return saved;
      this.state = draft;
      return ok(clone(r.value));
    });
  }

  private static scoped<T extends { workspaceId: Id }>(draft: WorkspaceSnapshot, entity: T): Result<T> {
    return entity.workspaceId === draft.workspace.id
      ? ok(entity)
      : err('forbidden', 'Record belongs to a different workspace');
  }

  private static parseScoped<S extends z.ZodType<{ workspaceId: Id }>>(draft: WorkspaceSnapshot, schema: S, input: unknown): Result<z.infer<S>> {
    const parsed = parseWith(schema, input);
    if (!parsed.ok) return parsed;
    return StoreRepository.scoped(draft, parsed.value) as Result<z.infer<S>>;
  }

  private static requireTrip(draft: WorkspaceSnapshot, tripId: Id | null): Result<void> {
    if (tripId === null) return ok(undefined);
    return draft.trips.some((t) => t.id === tripId) ? ok(undefined) : err('not_found', `Trip ${tripId} not found`);
  }

  private static find<T extends { id: Id }>(items: T[], id: Id, label: string): Result<T> {
    const found = items.find((i) => i.id === id);
    return found ? ok(found) : err('not_found', `${label} ${id} not found`);
  }

  private static saveVersioned<T extends Versioned>(
    draft: WorkspaceSnapshot,
    collection: VersionedCollection,
    schema: z.ZodType<T>,
    input: T,
    rev: Revision,
    now: Instant,
  ): Result<T> {
    const parsed = StoreRepository.parseScoped(draft, schema as z.ZodType<T>, input);
    if (!parsed.ok) return parsed;
    const entity = parsed.value;
    const items = draft[collection] as unknown as T[];
    const index = items.findIndex((i) => i.id === entity.id);
    if (rev.expectedRevision === null) {
      if (index >= 0) return err('conflict', `${entity.id} already exists; pass its expectedRevision to update`);
      if (entity.revision !== 1) return err('validation_failed', 'New records must have revision 1');
      const stored = { ...entity, createdAt: now, updatedAt: now };
      items.push(stored);
      return ok(stored);
    }
    const existing = items[index];
    if (!existing) return err('not_found', `${entity.id} not found`);
    if (existing.revision !== rev.expectedRevision) {
      return err('conflict', `${entity.id} is at revision ${existing.revision}, expected ${rev.expectedRevision}; reload and retry`, {
        details: { currentRevision: existing.revision },
      });
    }
    const stored = { ...entity, createdAt: existing.createdAt, revision: existing.revision + 1, updatedAt: now };
    items[index] = stored;
    return ok(stored);
  }

  // -- workspace / clock ---------------------------------------------------

  getWorkspace() {
    return this.read((s) => ok(s.workspace));
  }

  snapshot() {
    return this.read((s) => ok(s));
  }

  getClock() {
    return this.read((s) => ok(s.clock));
  }

  setClock(state: ClockState) {
    return this.write((draft) => {
      const parsed = parseWith(ClockStateSchema, state);
      if (!parsed.ok) return parsed;
      draft.clock = parsed.value;
      return ok(parsed.value);
    });
  }

  resetDemo(stage: DemoSeedStage) {
    return this.write(async (draft) => {
      const fresh = await buildDemoSnapshot(draft.workspace, stage);
      Object.assign(draft, fresh);
      return ok(fresh);
    });
  }

  // -- trips / plans / quotes ------------------------------------------------

  listTrips() {
    return this.read((s) => ok(s.trips));
  }

  getTrip(tripId: Id) {
    return this.read((s) => StoreRepository.find(s.trips, tripId, 'Trip'));
  }

  saveTrip(trip: z.infer<typeof TripSchema>, rev: Revision) {
    return this.write((d, now) => StoreRepository.saveVersioned(d, 'trips', TripSchema, trip, rev, now));
  }

  listPlans(tripId: Id) {
    return this.read((s) => ok(byTrip(s.plans, tripId)));
  }

  savePlan(plan: z.infer<typeof PlanOptionSchema>, rev: Revision) {
    return this.write((d, now) => {
      const t = StoreRepository.requireTrip(d, plan.tripId);
      if (!t.ok) return t;
      return StoreRepository.saveVersioned(d, 'plans', PlanOptionSchema, plan, rev, now);
    });
  }

  selectPlan(input: { tripId: Id; planId: Id; expectedTripRevision: number }) {
    return this.write((d, now) => {
      const trip = StoreRepository.find(d.trips, input.tripId, 'Trip');
      if (!trip.ok) return trip;
      const plan = d.plans.find((p) => p.id === input.planId && p.tripId === input.tripId);
      if (!plan) return err('not_found', `Plan ${input.planId} not found for trip ${input.tripId}`);
      if (trip.value.revision !== input.expectedTripRevision) {
        return err('conflict', `Trip is at revision ${trip.value.revision}; reload and retry`, { details: { currentRevision: trip.value.revision } });
      }
      for (const p of d.plans) {
        if (p.tripId !== input.tripId) continue;
        const status = p.id === input.planId ? 'selected' : p.status === 'selected' ? 'proposed' : p.status;
        if (status !== p.status) Object.assign(p, { status, revision: p.revision + 1, updatedAt: now });
      }
      Object.assign(trip.value, { selectedPlanId: input.planId, revision: trip.value.revision + 1, updatedAt: now });
      return ok(trip.value);
    });
  }

  listQuotes(tripId: Id) {
    return this.read((s) => ok(byTrip(s.quotes, tripId)));
  }

  saveQuote(quote: z.infer<typeof QuoteSchema>) {
    return this.write((d) => {
      const parsed = StoreRepository.parseScoped(d, QuoteSchema, quote);
      if (!parsed.ok) return parsed;
      const t = StoreRepository.requireTrip(d, parsed.value.tripId);
      if (!t.ok) return t;
      const existing = d.quotes.find((q) => q.id === parsed.value.id);
      if (existing) {
        return JSON.stringify(existing) === JSON.stringify(parsed.value) ? ok(existing) : err('conflict', 'Quotes are immutable; use a new quote ID');
      }
      d.quotes.push(parsed.value);
      return ok(parsed.value);
    });
  }

  // -- documents / bookings / policies --------------------------------------

  listDocuments(tripId: Id | null) {
    return this.read((s) => ok(byTrip(s.documents, tripId)));
  }

  getDocument(documentId: Id) {
    return this.read((s) => StoreRepository.find(s.documents, documentId, 'Document'));
  }

  putDocument(document: z.infer<typeof EvidenceDocumentSchema>) {
    return this.write((d) => StoreRepository.putDocumentIn(d, document));
  }

  private static putDocumentIn(d: WorkspaceSnapshot, document: unknown) {
    const parsed = StoreRepository.parseScoped(d, EvidenceDocumentSchema, document);
    if (!parsed.ok) return parsed;
    const doc = parsed.value;
    const t = StoreRepository.requireTrip(d, doc.tripId);
    if (!t.ok) return t;
    const sameContent = d.documents.find((x) => x.kind === doc.kind && x.contentHash === doc.contentHash);
    if (sameContent) return ok({ document: sameContent, created: false });
    if (d.documents.some((x) => x.id === doc.id)) return err('conflict', `Document ID ${doc.id} already used for different content`);
    d.documents.push(doc);
    return ok({ document: doc, created: true });
  }

  listBookings(tripId: Id) {
    return this.read((s) => ok(byTrip(s.bookings, tripId)));
  }

  getBooking(bookingId: Id) {
    return this.read((s) => StoreRepository.find(s.bookings, bookingId, 'Booking'));
  }

  saveBooking(booking: Booking, rev: Revision) {
    return this.write((d, now) => {
      const t = StoreRepository.requireTrip(d, booking.tripId);
      if (!t.ok) return t;
      return StoreRepository.saveVersioned(d, 'bookings', BookingSchema, booking, rev, now);
    });
  }

  listPolicies(tripId: Id) {
    return this.read((s) => ok(byTrip(s.policies, tripId)));
  }

  getPolicy(policyId: Id) {
    return this.read((s) => StoreRepository.find(s.policies, policyId, 'Policy'));
  }

  savePolicy(policy: z.infer<typeof PolicyEvidenceSchema>, rev: Revision) {
    return this.write((d, now) => {
      if (!d.bookings.some((b) => b.id === policy.bookingId)) return err('not_found', `Booking ${policy.bookingId} not found`);
      return StoreRepository.saveVersioned(d, 'policies', PolicyEvidenceSchema, policy, rev, now);
    });
  }

  saveReviewedBooking(input: SaveReviewedBookingInput) {
    return this.write((d, now): Result<SaveReviewedBookingResult> => {
      const replay = d.idempotencyKeys.find((k) => k.key === input.idempotencyKey);
      if (replay) {
        if (replay.operation !== 'saveReviewedBooking') return err('conflict', 'Idempotency key reused for a different operation');
        return StoreRepository.reviewedResult(d, replay.resultId, true);
      }
      const docPut = StoreRepository.putDocumentIn(d, input.document);
      if (!docPut.ok) return docPut;
      const document = docPut.value.document;
      // Duplicate import of the same document: return the booking it already produced.
      const existingBooking = d.bookings.find((b) => b.evidenceDocumentIds.includes(document.id));
      if (existingBooking) return StoreRepository.reviewedResult(d, existingBooking.id, true);

      const booking = StoreRepository.parseScoped(d, BookingSchema, input.booking);
      if (!booking.ok) return booking;
      const b = booking.value;
      const t = StoreRepository.requireTrip(d, b.tripId);
      if (!t.ok) return t;
      if (d.bookings.some((x) => x.id === b.id)) return err('conflict', `Booking ${b.id} already exists`);
      if (b.revision !== 1) return err('validation_failed', 'New bookings must have revision 1');
      // The stored document may have a different ID than the submitted one (dedupe by content).
      b.evidenceDocumentIds = [...new Set([...b.evidenceDocumentIds.filter((id) => id !== input.document.id), document.id])];
      if (b.provenance.documentId === input.document.id) b.provenance.documentId = document.id;

      let policy = null;
      if (input.policy) {
        const p = StoreRepository.parseScoped(d, PolicyEvidenceSchema, input.policy);
        if (!p.ok) return p;
        if (p.value.bookingId !== b.id) return err('validation_failed', 'policy.bookingId must equal booking.id');
        if (b.policyId !== p.value.id) return err('validation_failed', 'booking.policyId must equal policy.id');
        if (d.policies.some((x) => x.id === p.value.id)) return err('conflict', `Policy ${p.value.id} already exists`);
        if (p.value.sourceDocumentId === input.document.id) p.value.sourceDocumentId = document.id;
        policy = { ...p.value, createdAt: now, updatedAt: now };
        d.policies.push(policy);
      } else if (b.policyId !== null) {
        return err('validation_failed', 'booking.policyId set but no policy supplied');
      }
      const storedBooking = { ...b, createdAt: now, updatedAt: now };
      d.bookings.push(storedBooking);
      d.idempotencyKeys.push({ key: input.idempotencyKey, operation: 'saveReviewedBooking', resultId: storedBooking.id, createdAt: now });
      return ok({ document, booking: storedBooking, policy, replayed: false });
    });
  }

  private static reviewedResult(d: WorkspaceSnapshot, bookingId: Id, replayed: boolean): Result<SaveReviewedBookingResult> {
    const booking = d.bookings.find((b) => b.id === bookingId);
    if (!booking) return err('internal', `Replay target ${bookingId} missing`);
    const document = d.documents.find((doc) => booking.evidenceDocumentIds.includes(doc.id));
    if (!document) return err('internal', `Evidence for ${bookingId} missing`);
    const policy = booking.policyId ? (d.policies.find((p) => p.id === booking.policyId) ?? null) : null;
    return ok({ document, booking, policy, replayed });
  }

  // -- disruptions / recovery options / actions ------------------------------

  listDisruptions(tripId: Id) {
    return this.read((s) => ok(byTrip(s.disruptions, tripId)));
  }

  recordDisruption(disruption: z.infer<typeof DisruptionSchema>) {
    return this.write((d) => {
      const parsed = StoreRepository.parseScoped(d, DisruptionSchema, disruption);
      if (!parsed.ok) return parsed;
      const dis = parsed.value;
      const existing = d.disruptions.find((x) => x.id === dis.id);
      if (existing) {
        return existing.bookingId === dis.bookingId && existing.type === dis.type
          ? ok({ disruption: existing, created: false })
          : err('conflict', `Disruption ${dis.id} already recorded with different facts`);
      }
      if (!d.bookings.some((b) => b.id === dis.bookingId && b.tripId === dis.tripId)) {
        return err('not_found', `Booking ${dis.bookingId} not found for trip ${dis.tripId}`);
      }
      if (dis.sourceDocumentId && !d.documents.some((x) => x.id === dis.sourceDocumentId)) {
        return err('not_found', `Source document ${dis.sourceDocumentId} not found; putDocument first`);
      }
      d.disruptions.push(dis);
      return ok({ disruption: dis, created: true });
    });
  }

  listRecoveryOptions(tripId: Id) {
    return this.read((s) => ok(byTrip(s.recoveryOptions, tripId)));
  }

  replaceRecoveryOptions(input: { tripId: Id; disruptionId: Id | null; options: z.infer<typeof RecoveryOptionSchema>[] }) {
    return this.write((d) => {
      const t = StoreRepository.requireTrip(d, input.tripId);
      if (!t.ok) return t;
      const parsed = [];
      for (const o of input.options) {
        const p = StoreRepository.parseScoped(d, RecoveryOptionSchema, o);
        if (!p.ok) return p;
        if (p.value.tripId !== input.tripId || p.value.disruptionId !== input.disruptionId) {
          return err('validation_failed', `Option ${p.value.id} does not belong to this trip/disruption`);
        }
        parsed.push(p.value);
      }
      d.recoveryOptions = d.recoveryOptions.filter((o) => !(o.tripId === input.tripId && o.disruptionId === input.disruptionId));
      d.recoveryOptions.push(...parsed);
      return ok(parsed);
    });
  }

  listActions(tripId: Id) {
    return this.read((s) => ok(byTrip(s.actions, tripId)));
  }

  recordBookingAction(input: RecordBookingActionInput) {
    return this.write((d, now): Result<RecordBookingActionResult> => {
      const parsed = StoreRepository.parseScoped(d, ActionRecordSchema, input.action);
      if (!parsed.ok) return parsed;
      const action = parsed.value;
      const replay = d.actions.find((a) => a.idempotencyKey === action.idempotencyKey);
      if (replay) {
        if (replay.bookingId !== action.bookingId || replay.action !== action.action) {
          return err('conflict', 'Idempotency key already used for a different booking action');
        }
        const booking = d.bookings.find((b) => b.id === replay.bookingId);
        if (!booking) return err('internal', 'Replay booking missing');
        return ok({ action: replay, booking, replayed: true });
      }
      if (d.actions.some((a) => a.id === action.id)) return err('conflict', `Action ${action.id} already exists`);
      const booking = d.bookings.find((b) => b.id === action.bookingId && b.tripId === action.tripId);
      if (!booking) return err('not_found', `Booking ${action.bookingId} not found for trip ${action.tripId}`);
      if (booking.revision !== input.expectedBookingRevision) {
        return err('conflict', `Booking is at revision ${booking.revision}; reload and retry`, { details: { currentRevision: booking.revision } });
      }
      if (booking.state === 'cancelled' || booking.state === 'replaced') {
        return err('precondition_failed', `Booking ${booking.id} is already ${booking.state}`);
      }
      if (action.disruptionId && !d.disruptions.some((x) => x.id === action.disruptionId)) {
        return err('not_found', `Disruption ${action.disruptionId} not found`);
      }
      if (action.replacementQuoteId && !d.quotes.some((q) => q.id === action.replacementQuoteId)) {
        return err('not_found', `Quote ${action.replacementQuoteId} not found`);
      }
      const componentIds = action.expectedRecovery.map((c) => c.id);
      if (new Set(componentIds).size !== componentIds.length) return err('validation_failed', 'Recovery component IDs must be unique');

      Object.assign(booking, { state: action.resultingBookingState, revision: booking.revision + 1, updatedAt: now });
      const stored = { ...action, createdAt: now };
      d.actions.push(stored);
      return ok({ action: stored, booking, replayed: false });
    });
  }

  // -- claims / receipts / assets --------------------------------------------

  listClaims(tripId: Id) {
    return this.read((s) => ok(byTrip(s.claims, tripId)));
  }

  ensureClaims(claims: RefundClaim[]) {
    return this.write((d, now): Result<EnsureClaimsResult> => {
      const out: RefundClaim[] = [];
      let created = 0;
      let existing = 0;
      for (const input of claims) {
        const parsed = StoreRepository.parseScoped(d, RefundClaimSchema, input);
        if (!parsed.ok) return parsed;
        const claim = parsed.value;
        const action = d.actions.find((a) => a.id === claim.actionRecordId);
        if (!action) return err('not_found', `Action ${claim.actionRecordId} not found`);
        if (!action.expectedRecovery.some((c) => c.id === claim.recoveryComponentId)) {
          return err('validation_failed', `Action ${action.id} has no recovery component ${claim.recoveryComponentId}`);
        }
        const match = d.claims.find((c) => c.actionRecordId === claim.actionRecordId && c.recoveryComponentId === claim.recoveryComponentId);
        if (match) {
          existing++;
          out.push(match);
          continue;
        }
        if (d.claims.some((c) => c.id === claim.id)) return err('conflict', `Claim ${claim.id} already exists for another action component`);
        if (claim.revision !== 1) return err('validation_failed', 'New claims must have revision 1');
        const stored = { ...claim, createdAt: now, updatedAt: now };
        d.claims.push(stored);
        out.push(stored);
        created++;
      }
      return ok({ claims: out, created, existing });
    });
  }

  saveClaim(claim: RefundClaim, rev: Revision) {
    return this.write((d, now) => {
      if (rev.expectedRevision === null) return err('unsupported', 'Create claims with ensureClaims');
      const current = d.claims.find((c) => c.id === claim.id);
      if (current && (current.actionRecordId !== claim.actionRecordId || current.recoveryComponentId !== claim.recoveryComponentId)) {
        return err('validation_failed', 'A claim cannot be moved to a different action component');
      }
      for (const a of claim.allocations) {
        if (!d.receipts.some((r) => r.id === a.receiptId)) return err('not_found', `Receipt ${a.receiptId} not found`);
      }
      return StoreRepository.saveVersioned(d, 'claims', RefundClaimSchema, claim, rev, now);
    });
  }

  listReceipts(tripId: Id | null) {
    return this.read((s) => ok(byTrip(s.receipts, tripId)));
  }

  putReceipt(receipt: z.infer<typeof ReceiptSchema>) {
    return this.write((d, now) => {
      const parsed = StoreRepository.parseScoped(d, ReceiptSchema, receipt);
      if (!parsed.ok) return parsed;
      const r = parsed.value;
      const t = StoreRepository.requireTrip(d, r.tripId);
      if (!t.ok) return t;
      const ref = normalizeReference(r.reference);
      const same = d.receipts.find((x) => normalizeReference(x.reference) === ref);
      if (same) {
        const identical = same.amount.amountMinor === r.amount.amountMinor && same.amount.currency === r.amount.currency;
        return identical
          ? ok({ receipt: same, created: false })
          : err('duplicate', `Receipt reference ${r.reference} already recorded with a different amount`, { details: { existingReceiptId: same.id } });
      }
      if (d.receipts.some((x) => x.id === r.id)) return err('conflict', `Receipt ${r.id} already exists`);
      if (r.sourceDocumentId && !d.documents.some((x) => x.id === r.sourceDocumentId)) {
        return err('not_found', `Source document ${r.sourceDocumentId} not found; putDocument first`);
      }
      if (r.revision !== 1) return err('validation_failed', 'New receipts must have revision 1');
      const stored = { ...r, createdAt: now, updatedAt: now };
      d.receipts.push(stored);
      return ok({ receipt: stored, created: true });
    });
  }

  saveReceipt(receipt: z.infer<typeof ReceiptSchema>, rev: Revision) {
    return this.write((d, now) => {
      if (rev.expectedRevision === null) return err('unsupported', 'Create receipts with putReceipt');
      return StoreRepository.saveVersioned(d, 'receipts', ReceiptSchema, receipt, rev, now);
    });
  }

  listAssets() {
    return this.read((s) => ok(s.assets));
  }

  saveAsset(asset: z.infer<typeof WalletAssetSchema>, rev: Revision) {
    return this.write((d, now) => StoreRepository.saveVersioned(d, 'assets', WalletAssetSchema, asset, rev, now));
  }
}
