import {
  BookingExtractionSchema, BookingSchema, ExtractBookingRequestSchema, PolicyEvidenceSchema,
  appError, err, fromZodError, isUnknown, isValidTimeZone, minorDigits, normalizeDocumentText, ok, parseMajorUnits, reviewedBookingInput, sha256Hex, unknownValue, zonedWallTimeToInstant,
  type BookingExtraction, type BookingKind, type BookingReviewEdits, type ExtractionService,
  type ExtractedField, type FeatureContext, type Money, type Result, type SaveReviewedBookingResult,
} from '../../core/index.ts';

export type ReviewDraft = {
  kind: BookingKind | ''; provider: string; reference: string; title: string;
  startsAt: string; endsAt: string; localTimezone: string; amount: string; currency: string;
  confirmed: boolean; policyUncertain: boolean;
};
const value = <T>(f: ExtractedField<T>, empty: T): T => f.status === 'found' ? f.value : empty;

/** Preserve original minor units exactly; a review field must not round or convert a price. */
function reviewAmount({ amountMinor, currency }: Money): string {
  const precision = minorDigits(currency);
  const digits = Math.abs(amountMinor).toString().padStart(precision + 1, '0');
  const sign = amountMinor < 0 ? '-' : '';
  return precision === 0 ? `${sign}${digits}` : `${sign}${digits.slice(0, -precision)}.${digits.slice(-precision)}`;
}

export function reviewDraft(x: BookingExtraction): ReviewDraft {
  const paid = x.booking.paid;
  return {
    kind: value<BookingKind | ''>(x.booking.kind, ''), provider: value(x.booking.provider, ''),
    reference: value(x.booking.reference, ''), title: value(x.booking.title, ''),
    startsAt: value(x.booking.startsAt, ''), endsAt: value(x.booking.endsAt, ''),
    localTimezone: value(x.booking.localTimezone, ''),
    amount: paid.status === 'found' ? reviewAmount(paid.value) : '',
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
        const contentHash = await sha256Hex(normalizeDocumentText(text));
        if (ticket !== generation) return null;
        if (result.value.document.contentHash !== contentHash) {
          return err('provider_error', 'Extraction does not match the submitted document; nothing was saved');
        }
      }
      return ticket === generation ? result : null;
    },
  };
}

/** UTC instant -> the "YYYY-MM-DDTHH:mm" wall time a datetime-local input shows in `timeZone`. */
export function instantToLocalInput(instant: string, timeZone: string): string {
  if (!validInstant(instant) || !isValidTimeZone(timeZone)) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** A datetime-local wall time in `timeZone` -> UTC instant; '' when blank or unparseable. */
export function localInputToInstant(wall: string, timeZone: string): string {
  return wall ? zonedWallTimeToInstant(wall, timeZone) ?? '' : '';
}

function validInstant(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 19) === s.slice(0, 19);
}

export function validateReview(d: ReviewDraft): Result<BookingReviewEdits> {
  const issues: { path: string; message: string }[] = [];
  for (const key of ['kind', 'provider', 'reference', 'localTimezone'] as const) {
    if (!d[key].trim()) issues.push({ path: key, message: 'Required. Enter it to save.' });
  }
  if (!validInstant(d.startsAt)) issues.push({ path: 'startsAt', message: 'Enter the start date and time.' });
  if (d.endsAt && (!validInstant(d.endsAt) || Date.parse(d.endsAt) <= Date.parse(d.startsAt))) issues.push({ path: 'endsAt', message: 'The end must be after the start.' });
  if (d.localTimezone && !isValidTimeZone(d.localTimezone)) issues.push({ path: 'localTimezone', message: 'Choose a time zone.' });
  if (!d.confirmed) issues.push({ path: 'confirmed', message: 'Confirm the booking details before saving.' });
  let paid: BookingReviewEdits['paid'] = unknownValue('Paid amount not supplied or confirmed by the reviewer');
  if (d.currency && d.currency !== 'USD') issues.push({ path: 'currency', message: 'This trip uses US dollars (USD). Currency conversion isn’t available.' });
  if (d.amount.trim()) {
    const amount = /^\d+(?:\.\d{1,2})?$/.test(d.amount.trim()) ? parseMajorUnits(d.amount.trim(), 'USD') : null;
    if (!amount || d.currency !== 'USD') issues.push({ path: 'paid', message: 'Enter an amount like 450.00, or leave it blank if you don’t know it.' });
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
