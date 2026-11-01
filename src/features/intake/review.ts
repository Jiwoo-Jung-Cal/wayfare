import {
  BookingExtractionSchema, BookingSchema, ExtractBookingRequestSchema, PolicyEvidenceSchema,
  appError, err, fromZodError, isUnknown, isValidTimeZone, normalizeDocumentText, ok, parseMajorUnits, reviewedBookingInput, sha256Hex, unknownValue,
  type BookingExtraction, type BookingKind, type BookingReviewEdits, type ExtractionService,
  type ExtractedField, type FeatureContext, type Result, type SaveReviewedBookingResult,
} from '../../core/index.ts';

export type ReviewDraft = {
  kind: BookingKind | ''; provider: string; reference: string; title: string;
  startsAt: string; endsAt: string; localTimezone: string; amount: string; currency: string;
  confirmed: boolean; policyUncertain: boolean;
};
const value = <T>(f: ExtractedField<T>, empty: T): T => f.status === 'found' ? f.value : empty;

export function reviewDraft(x: BookingExtraction): ReviewDraft {
  const paid = x.booking.paid;
  return {
    kind: value<BookingKind | ''>(x.booking.kind, ''), provider: value(x.booking.provider, ''),
    reference: value(x.booking.reference, ''), title: value(x.booking.title, ''),
    startsAt: value(x.booking.startsAt, ''), endsAt: value(x.booking.endsAt, ''),
    localTimezone: value(x.booking.localTimezone, ''),
    amount: paid.status === 'found' ? (paid.value.amountMinor / 100).toFixed(2) : '',
    currency: paid.status === 'found' ? paid.value.currency : '',
    confirmed: false, policyUncertain: false,
  };
}

// A provider response is usable only for the exact submitted text; changing input
// invalidates in-flight extraction without discarding the new text.
export function createIntakeExtractor(service: ExtractionService) {
  let generation = 0;
  return {
    invalidate() { generation++; },
    async extract(tripId: string, text: string): Promise<Result<BookingExtraction> | null> {
      const ticket = ++generation;
      const parsed = ExtractBookingRequestSchema.safeParse({ tripId, text });
      if (!parsed.success) return { ok: false, error: fromZodError(parsed.error) };
      let result: Result<BookingExtraction>;
      try { result = await service.extractBooking({ tripId, text }); }
      catch { result = { ok: false, error: appError('provider_error', 'Extraction failed. Your pasted text is preserved.') }; }
      if (ticket !== generation) return null;
      if (result.ok) {
        const check = BookingExtractionSchema.safeParse(result.value);
        if (!check.success) return err('provider_error', 'Extraction returned invalid booking facts; nothing was saved');
        if (result.value.document.contentHash !== await sha256Hex(normalizeDocumentText(text))) {
          return err('provider_error', 'Extraction does not match the submitted document; nothing was saved');
        }
      }
      return ticket === generation ? result : null;
    },
  };
}

function validInstant(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 19) === s.slice(0, 19);
}

export function validateReview(d: ReviewDraft): Result<BookingReviewEdits> {
  const issues: { path: string; message: string }[] = [];
  for (const key of ['kind', 'provider', 'reference', 'localTimezone'] as const) {
    if (!d[key].trim()) issues.push({ path: key, message: 'Enter this required booking fact' });
  }
  if (!validInstant(d.startsAt)) issues.push({ path: 'startsAt', message: 'Enter a valid UTC instant, e.g. 2026-11-20T20:00:00Z' });
  if (d.endsAt && (!validInstant(d.endsAt) || Date.parse(d.endsAt) <= Date.parse(d.startsAt))) issues.push({ path: 'endsAt', message: 'End must be a valid UTC instant after the start' });
  if (d.localTimezone && !isValidTimeZone(d.localTimezone)) issues.push({ path: 'localTimezone', message: 'Enter an IANA timezone, e.g. America/New_York' });
  if (!d.confirmed) issues.push({ path: 'confirmed', message: 'Confirm that the document records a confirmed booking before saving' });
  let paid: BookingReviewEdits['paid'] = unknownValue('Paid amount not supplied or confirmed by the reviewer');
  if (d.currency && d.currency !== 'USD') issues.push({ path: 'currency', message: 'This trip supports USD only; no currency conversion is available' });
  if (d.amount.trim()) {
    const amount = /^\d+(?:\.\d{1,2})?$/.test(d.amount.trim()) ? parseMajorUnits(d.amount.trim(), 'USD') : null;
    if (!amount || d.currency !== 'USD') issues.push({ path: 'paid', message: 'Enter a nonnegative USD amount with at most two decimal places, or leave the amount blank for unknown' });
    else paid = amount;
  }
  if (issues.length) return err('validation_failed', 'Check the booking facts listed below', { issues });
  return ok({ kind: d.kind as BookingKind, provider: d.provider.trim(), reference: d.reference.trim(),
    title: d.title.trim() || `${d.provider.trim()} ${d.reference.trim()}`, startsAt: d.startsAt,
    endsAt: d.endsAt || null, localTimezone: d.localTimezone, paid });
}

export async function saveReviewedIntake(input: { extraction: BookingExtraction; sourceText: string; draft: ReviewDraft; tripId: string }, ctx: Pick<FeatureContext, 'repo' | 'clock'>): Promise<Result<SaveReviewedBookingResult>> {
  const edits = validateReview(input.draft);
  if (!edits.ok) return edits;
  const trip = await ctx.repo.getTrip(input.tripId);
  if (!trip.ok) return trip;
  const extraction: BookingExtraction = input.draft.policyUncertain ? {
    ...input.extraction,
    policy: { refundability: 'unknown', refundTiers: [], deadlines: [],
      unknownFields: [{ field: 'policy', reason: 'Reviewer disputed the extracted policy; original document retained for review.' }] },
  } : input.extraction;
  const built = await reviewedBookingInput({ extraction, sourceText: input.sourceText,
    workspaceId: trip.value.workspaceId, tripId: input.tripId, now: ctx.clock.now(), edits: edits.value });
  if (!built.ok) return built;
  // Validate the builder output at the feature boundary as well as in persistence.
  const booking = BookingSchema.safeParse(built.value.booking);
  if (!booking.success) return { ok: false, error: fromZodError(booking.error) };
  if (built.value.policy) {
    const policy = PolicyEvidenceSchema.safeParse(built.value.policy);
    if (!policy.success) return { ok: false, error: fromZodError(policy.error) };
    if (policy.data.refundTiers.some((t) => !isUnknown(t.refund) && t.refund.currency !== 'USD')) {
      return err('validation_failed', 'Policy currency differs from this USD trip. Mark policy terms uncertain or correct the source.');
    }
  }
  return ctx.repo.saveReviewedBooking(built.value);
}
