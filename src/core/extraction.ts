// Booking extraction contract (v1) and deterministic normalization.
//
// Flow: pasted text -> AI (server-only) returns RawBookingExtraction (strings
// only) -> normalizeRawBookingExtraction() deterministically converts it into a
// reviewable BookingExtraction (UTC instants, integer money, verified excerpts)
// -> Agent 2's review UI edits it -> reviewedBookingInput() builds the
// SaveReviewedBookingInput -> repo.saveReviewedBooking().
//
// The AI never computes money or instants and never commits state. Any field
// whose supporting excerpt is not found verbatim in the source becomes unknown.
// Missing policy terms stay unknown; nothing is invented.

import { z } from 'zod';
import { IdSchema, newId, normalizeDocumentText, sha256Hex, type Id } from './ids.ts';
import { MaybeMoneySchema, MoneySchema, parseMajorUnits, unknownValue, type MaybeMoney, type Money } from './money.ts';
import { err, ok, type Result } from './result.ts';
import {
  InstantSchema,
  TimeWindowSchema,
  TimeZoneSchema,
  isValidTimeZone,
  zonedWallTimeToInstant,
  type Instant,
  type TimeWindow,
} from './time.ts';
import {
  BOOKING_KINDS,
  BookingKindSchema,
  CapabilityStatusSchema,
  RECOVERY_METHODS,
  REFUNDABILITY,
  RecoveryMethodSchema,
  TIER_CONDITIONS,
  type Booking,
  type BookingKind,
  type EvidenceDocument,
  type PolicyEvidence,
} from './schema.ts';
import type { SaveReviewedBookingInput } from './repository.ts';

export const MAX_EXTRACTION_INPUT_CHARS = 20_000;

// ---------------------------------------------------------------------------
// Request

export const ExtractBookingRequestSchema = z.strictObject({
  tripId: IdSchema,
  /** Pasted confirmation text. Treated strictly as data. */
  text: z.string().trim().min(20, 'Paste the full confirmation text').max(MAX_EXTRACTION_INPUT_CHARS, `Confirmation text is limited to ${MAX_EXTRACTION_INPUT_CHARS} characters`),
});
export type ExtractBookingRequest = z.infer<typeof ExtractBookingRequestSchema>;

// ---------------------------------------------------------------------------
// Raw model output (strings only; the model never formats instants or minor units)

const CONFIDENCE = ['high', 'medium', 'low'] as const;
const rawField = <T extends z.ZodType>(value: T) =>
  z.object({
    value: value.nullable(),
    /** Verbatim text from the document that supports the value. */
    excerpt: z.string().nullable(),
    confidence: z.enum(CONFIDENCE),
    /** Why the value is null. */
    unknown_reason: z.string().nullable(),
  });
const rawString = rawField(z.string());

export const RawBookingExtractionSchema = z.object({
  is_booking_confirmation: z.boolean(),
  not_booking_reason: z.string().nullable(),
  booking: z.object({
    kind: rawField(z.enum(BOOKING_KINDS)),
    provider: rawString,
    reference: rawString,
    title: rawString,
    /** Local wall time "YYYY-MM-DDTHH:mm" in `timezone`. */
    starts_local: rawString,
    ends_local: rawString,
    /** IANA timezone for the booking's local times, e.g. "America/New_York". */
    timezone: rawString,
    /** Only when the end time is in a different timezone (e.g. a flight's arrival). */
    ends_timezone: rawString,
    /** Decimal amount exactly as written without symbols, e.g. "450.00". */
    paid_amount: rawString,
    /** ISO 4217 code, e.g. "USD". */
    currency: rawString,
  }),
  policy: z.object({
    refundability: z.enum(REFUNDABILITY),
    tiers: z.array(
      z.object({
        label: z.string(),
        condition: z.enum(TIER_CONDITIONS),
        starts_at_or_after_local: z.string().nullable(),
        ends_before_local: z.string().nullable(),
        timezone: z.string().nullable(),
        refund_amount: z.string().nullable(),
        refund_currency: z.string().nullable(),
        method: z.enum(RECOVERY_METHODS),
        excerpt: z.string(),
      }),
    ),
    deadlines: z.array(
      z.object({ label: z.string(), local_time: z.string(), timezone: z.string(), source_wording: z.string(), excerpt: z.string() }),
    ),
    unknown_fields: z.array(z.object({ field: z.string(), reason: z.string() })),
  }),
});
export type RawBookingExtraction = z.infer<typeof RawBookingExtractionSchema>;

// ---------------------------------------------------------------------------
// Normalized, reviewable result

export const ConfidenceSchema = z.enum(CONFIDENCE);

export function extractedFieldSchema<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('found'), value, excerpt: z.string(), confidence: ConfidenceSchema }),
    z.strictObject({ status: z.literal('unknown'), reason: z.string().min(1) }),
  ]);
}
export type ExtractedField<T> = { status: 'found'; value: T; excerpt: string; confidence: 'high' | 'medium' | 'low' } | { status: 'unknown'; reason: string };

export const ExtractedTierSchema = z.strictObject({
  label: z.string().min(1),
  condition: z.enum(TIER_CONDITIONS),
  window: TimeWindowSchema,
  refund: MaybeMoneySchema,
  method: RecoveryMethodSchema,
  excerpt: z.string().min(1),
});
export type ExtractedTier = z.infer<typeof ExtractedTierSchema>;

export const ExtractedDeadlineSchema = z.strictObject({
  label: z.string().min(1),
  at: InstantSchema,
  displayTimezone: TimeZoneSchema,
  sourceWording: z.string().min(1),
  excerpt: z.string().min(1),
});
export type ExtractedDeadline = z.infer<typeof ExtractedDeadlineSchema>;

export const BookingExtractionSchema = z.strictObject({
  /** Server request/trace ID (or "sample-..." in browser sample mode). */
  requestId: z.string().min(1),
  /** "live" = a real model call; "simulated" = deterministic sample-document extraction. */
  capability: CapabilityStatusSchema,
  model: z.string().nullable(),
  extractedAt: InstantSchema,
  document: z.strictObject({ contentHash: z.string().regex(/^[0-9a-f]{64}$/) }),
  /** Canonical fixture IDs when the text is a WayFare sample document, so the demo scenario keeps stable IDs. */
  fixture: z.strictObject({ bookingId: IdSchema, policyId: IdSchema, dependsOn: z.array(IdSchema) }).nullable(),
  booking: z.strictObject({
    kind: extractedFieldSchema(BookingKindSchema),
    provider: extractedFieldSchema(z.string().min(1)),
    reference: extractedFieldSchema(z.string().min(1)),
    title: extractedFieldSchema(z.string().min(1)),
    startsAt: extractedFieldSchema(InstantSchema),
    endsAt: extractedFieldSchema(InstantSchema),
    localTimezone: extractedFieldSchema(TimeZoneSchema),
    paid: extractedFieldSchema(MoneySchema),
  }),
  policy: z.strictObject({
    refundability: z.enum(REFUNDABILITY),
    refundTiers: z.array(ExtractedTierSchema),
    deadlines: z.array(ExtractedDeadlineSchema),
    unknownFields: z.array(z.strictObject({ field: z.string().min(1), reason: z.string().min(1) })),
  }),
  /** Human-readable notes about dropped or downgraded values. */
  warnings: z.array(z.string()),
});
export type BookingExtraction = z.infer<typeof BookingExtractionSchema>;

// ---------------------------------------------------------------------------
// Normalization

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** True when the excerpt appears verbatim (whitespace-insensitive) in the source. */
export function excerptInSource(excerpt: string, source: string): boolean {
  const e = squash(excerpt);
  return e.length >= 3 && squash(source).includes(e);
}

export type NormalizeMeta = {
  requestId: string;
  capability: 'live' | 'simulated';
  model: string | null;
  extractedAt: Instant;
  contentHash: string;
  fixture: BookingExtraction['fixture'];
};

export function normalizeRawBookingExtraction(rawInput: unknown, sourceText: string, meta: NormalizeMeta): Result<BookingExtraction> {
  const parsed = RawBookingExtractionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err('provider_error', 'The extraction result did not match the expected structure', { requestId: meta.requestId, retryable: true });
  }
  const raw = parsed.data;
  if (!raw.is_booking_confirmation) {
    return err('validation_failed', `This text does not look like a booking confirmation${raw.not_booking_reason ? `: ${raw.not_booking_reason}` : '.'}`, {
      requestId: meta.requestId,
      retryable: false,
      details: { reason: 'not_a_booking' },
    });
  }

  const warnings: string[] = [];
  const unknownFields: { field: string; reason: string }[] = [...raw.policy.unknown_fields];

  function field<T>(name: string, f: { value: string | null; excerpt: string | null; confidence: 'high' | 'medium' | 'low'; unknown_reason: string | null }, convert: (v: string) => T | null, invalidReason: string): ExtractedField<T> {
    if (f.value === null || f.value.trim() === '') return { status: 'unknown', reason: f.unknown_reason || 'Not stated in the document' };
    if (!f.excerpt || !excerptInSource(f.excerpt, sourceText)) {
      warnings.push(`${name}: supporting excerpt not found in the document; left unknown for review`);
      return { status: 'unknown', reason: 'Supporting excerpt not found in the document' };
    }
    const v = convert(f.value.trim());
    if (v === null) {
      warnings.push(`${name}: "${f.value}" ${invalidReason}`);
      return { status: 'unknown', reason: `"${f.value}" ${invalidReason}` };
    }
    return { status: 'found', value: v, excerpt: squash(f.excerpt), confidence: f.confidence };
  }

  const b = raw.booking;
  const localTimezone = field('localTimezone', b.timezone, (v) => (isValidTimeZone(v) ? v : null), 'is not a recognized IANA timezone');
  const tz = localTimezone.status === 'found' ? localTimezone.value : null;
  const toInstant = (v: string) => (tz ? zonedWallTimeToInstant(v, tz) : null);
  const timeReason = tz ? 'is not a valid local date/time' : 'cannot be converted because the timezone is unknown';
  const currency = b.currency.value && /^[A-Z]{3}$/.test(b.currency.value.trim()) ? b.currency.value.trim() : null;

  const booking: BookingExtraction['booking'] = {
    kind: field('kind', b.kind, (v) => (BookingKindSchema.safeParse(v).success ? (v as BookingKind) : null), 'is not a supported booking kind'),
    provider: field('provider', b.provider, (v) => v, ''),
    reference: field('reference', b.reference, (v) => v, ''),
    title: field('title', b.title, (v) => v, ''),
    startsAt: field('startsAt', b.starts_local, toInstant, timeReason),
    endsAt: (() => {
      const endTz = b.ends_timezone.value?.trim();
      if (!endTz) return field('endsAt', b.ends_local, toInstant, timeReason);
      if (!isValidTimeZone(endTz) || !b.ends_timezone.excerpt || !excerptInSource(b.ends_timezone.excerpt, sourceText)) {
        warnings.push('endsAt: end timezone could not be verified; left unknown for review');
        return { status: 'unknown' as const, reason: 'End timezone could not be verified' };
      }
      return field('endsAt', b.ends_local, (v) => zonedWallTimeToInstant(v, endTz), 'is not a valid local date/time');
    })(),
    localTimezone,
    paid: currency
      ? field('paid', b.paid_amount, (v) => parseMajorUnits(v, currency), `is not an exact ${currency} amount`)
      : { status: 'unknown', reason: b.currency.unknown_reason || 'Currency not stated in the document' },
  };

  const refundTiers: ExtractedTier[] = [];
  raw.policy.tiers.forEach((t, i) => {
    const drop = (reason: string) => {
      warnings.push(`refundTiers[${i}] "${t.label}": ${reason}`);
      unknownFields.push({ field: `refundTiers[${i}]`, reason });
    };
    if (!excerptInSource(t.excerpt, sourceText)) return drop('supporting excerpt not found in the document');
    const tierTz = t.timezone ?? tz;
    const bound = (v: string | null): Instant | null | undefined => {
      if (v === null) return null;
      if (!tierTz || !isValidTimeZone(tierTz)) return undefined;
      return zonedWallTimeToInstant(v, tierTz) ?? undefined;
    };
    const window: TimeWindow = { startsAtOrAfter: bound(t.starts_at_or_after_local) as Instant | null, endsBefore: bound(t.ends_before_local) as Instant | null };
    if (window.startsAtOrAfter === undefined || window.endsBefore === undefined) return drop('time window could not be converted to UTC');
    let refund: MaybeMoney;
    if (t.refund_amount === null) refund = unknownValue('Refund amount not stated');
    else {
      const cur = t.refund_currency ?? currency;
      const m: Money | null = cur && /^[A-Z]{3}$/.test(cur) ? parseMajorUnits(t.refund_amount, cur) : null;
      refund = m ?? unknownValue(`Refund amount "${t.refund_amount}" could not be read exactly`);
    }
    refundTiers.push({ label: t.label, condition: t.condition, window, refund, method: t.method, excerpt: squash(t.excerpt) });
  });

  const deadlines: ExtractedDeadline[] = [];
  raw.policy.deadlines.forEach((d, i) => {
    const at = isValidTimeZone(d.timezone) ? zonedWallTimeToInstant(d.local_time, d.timezone) : null;
    if (!excerptInSource(d.excerpt, sourceText) || at === null) {
      const reason = at === null ? 'time could not be converted to UTC' : 'supporting excerpt not found in the document';
      warnings.push(`deadlines[${i}] "${d.label}": ${reason}`);
      unknownFields.push({ field: `deadlines[${i}]`, reason });
      return;
    }
    deadlines.push({ label: d.label, at, displayTimezone: d.timezone, sourceWording: d.source_wording, excerpt: squash(d.excerpt) });
  });

  let refundability = raw.policy.refundability;
  if (refundability !== 'unknown' && refundTiers.length === 0) {
    warnings.push('Refundability was stated but no verifiable refund rule remained; marked unknown');
    refundability = 'unknown';
  }
  if (refundability === 'unknown' && !unknownFields.some((u) => u.field === 'refundability')) {
    unknownFields.push({ field: 'refundability', reason: 'The document does not state cancellation or refund terms' });
  }

  const result: BookingExtraction = {
    requestId: meta.requestId,
    capability: meta.capability,
    model: meta.model,
    extractedAt: meta.extractedAt,
    document: { contentHash: meta.contentHash },
    fixture: meta.fixture,
    booking,
    policy: { refundability, refundTiers, deadlines, unknownFields },
    warnings,
  };
  const check = BookingExtractionSchema.safeParse(result);
  return check.success ? ok(check.data) : err('internal', 'Normalized extraction failed validation', { requestId: meta.requestId });
}

// ---------------------------------------------------------------------------
// Review -> save input

/** Values the reviewer confirmed or corrected. Omitted keys keep the extracted value. */
export type BookingReviewEdits = Partial<{
  kind: BookingKind;
  provider: string;
  reference: string;
  title: string;
  startsAt: Instant;
  endsAt: Instant | null;
  localTimezone: string;
  paid: MaybeMoney;
}>;

export type BookingReviewInput = {
  extraction: BookingExtraction;
  /** The exact text that was extracted (kept verbatim as evidence). */
  sourceText: string;
  workspaceId: Id;
  tripId: Id;
  /** Active clock instant. */
  now: Instant;
  edits?: BookingReviewEdits;
  dependsOn?: Id[];
  documentTitle?: string;
};

const pick = <T>(edit: T | undefined, f: ExtractedField<T>): T | undefined => (edit !== undefined ? edit : f.status === 'found' ? f.value : undefined);

/**
 * Build the reviewed-save input from an extraction plus reviewer edits.
 * Required booking facts that are still unknown produce validation_failed with
 * one issue per field so the review UI can highlight them.
 */
export async function reviewedBookingInput(input: BookingReviewInput): Promise<Result<SaveReviewedBookingInput>> {
  const { extraction: x, edits = {} } = input;
  const kind = pick(edits.kind, x.booking.kind);
  const provider = pick(edits.provider, x.booking.provider);
  const reference = pick(edits.reference, x.booking.reference);
  const title = pick(edits.title, x.booking.title) ?? (provider && reference ? `${provider} ${reference}` : undefined);
  const startsAt = pick(edits.startsAt, x.booking.startsAt);
  const localTimezone = pick(edits.localTimezone, x.booking.localTimezone);
  const issues = Object.entries({ kind, provider, reference, startsAt, localTimezone })
    .filter(([, v]) => v === undefined)
    .map(([path]) => ({ path, message: 'Required; not found in the document. Enter it to save.' }));
  if (issues.length) return err('validation_failed', 'Some required booking details are missing', { issues, retryable: false });

  const endsAt = edits.endsAt !== undefined ? edits.endsAt : x.booking.endsAt.status === 'found' ? x.booking.endsAt.value : null;
  const paid: MaybeMoney = edits.paid ?? (x.booking.paid.status === 'found' ? x.booking.paid.value : unknownValue(x.booking.paid.reason));

  const text = input.sourceText;
  const contentHash = await sha256Hex(normalizeDocumentText(text));
  if (contentHash !== x.document.contentHash) return err('validation_failed', 'sourceText does not match the extracted document', { retryable: false });

  const documentId = newId('document');
  const bookingId = x.fixture?.bookingId ?? newId('booking');
  const policyId = x.fixture?.policyId ?? newId('policy');
  const source = `${provider} ${reference}`;
  const provenance = { kind: 'imported_fact' as const, source, recordedAt: input.now, documentId, excerpt: null };

  const document: EvidenceDocument = {
    id: documentId,
    workspaceId: input.workspaceId,
    tripId: input.tripId,
    kind: 'booking_confirmation',
    title: input.documentTitle ?? `${source} confirmation`,
    text,
    contentHash,
    receivedAt: input.now,
    isSample: x.fixture !== null,
    provenance: { ...provenance, source: `Pasted confirmation: ${source}` },
    createdAt: input.now,
  };

  const excerpts = [
    ...x.policy.refundTiers.map((t, i) => ({ id: newId('excerpt'), field: `refundTiers[${i}]`, text: t.excerpt })),
    ...x.policy.deadlines.map((d, i) => ({ id: newId('excerpt'), field: `deadlines[${i}]`, text: d.excerpt })),
  ];
  const policy: PolicyEvidence = {
    id: policyId,
    workspaceId: input.workspaceId,
    tripId: input.tripId,
    bookingId,
    sourceDocumentId: documentId,
    refundability: x.policy.refundability,
    refundTiers: x.policy.refundTiers.map((t, i) => ({
      id: newId('refundTier'),
      label: t.label,
      condition: t.condition,
      window: t.window,
      refund: t.refund,
      method: t.method,
      excerptId: excerpts[i]!.id,
    })),
    deadlines: x.policy.deadlines.map((d) => ({ id: newId('deadline'), label: d.label, at: d.at, displayTimezone: d.displayTimezone, sourceWording: d.sourceWording })),
    excerpts,
    unknownFields: x.policy.unknownFields,
    reviewState: x.policy.refundability === 'unknown' ? 'needs_review' : 'reviewed',
    provenance: { ...provenance, source: `${source} policy (${x.capability === 'live' ? 'AI-extracted' : 'sample extraction'}, reviewed)` },
    revision: 1,
    createdAt: input.now,
    updatedAt: input.now,
  };

  const booking: Booking = {
    id: bookingId,
    workspaceId: input.workspaceId,
    tripId: input.tripId,
    kind: kind!,
    provider: provider!,
    reference: reference!,
    title: title!,
    startsAt: startsAt!,
    endsAt,
    localTimezone: localTimezone!,
    paid,
    state: 'confirmed',
    policyId,
    dependsOn: input.dependsOn ?? x.fixture?.dependsOn ?? [],
    evidenceDocumentIds: [documentId],
    replacesBookingId: null,
    provenance,
    revision: 1,
    createdAt: input.now,
    updatedAt: input.now,
  };

  return ok({ idempotencyKey: `intake:${contentHash}`, document, booking, policy });
}

// ---------------------------------------------------------------------------
// Service interface used by the intake UI

export interface ExtractionService {
  readonly capability: 'live' | 'simulated' | 'unavailable';
  readonly description: string;
  extractBooking(request: ExtractBookingRequest): Promise<Result<BookingExtraction>>;
}
