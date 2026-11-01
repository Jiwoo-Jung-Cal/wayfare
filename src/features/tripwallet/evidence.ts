import { z } from 'zod';
import {
  MoneySchema, InstantSchema, parseWith, err, newId, normalizeDocumentText, sha256Hex,
  type FeatureContext, type Id, type Receipt, type EvidenceDocument, type Result,
} from '../../core/index.ts';

/** Reviewed form fields. Extracted values, including AI results, are proposals, never writes. */
export const EvidenceReviewSchema = z.object({
  kind: z.enum(['receipt', 'refund_confirmation']),
  text: z.string().min(1).max(50000), amount: MoneySchema.refine(m => m.amountMinor > 0, 'Enter a positive amount'),
  reference: z.string().trim().min(1), merchant: z.string().trim().min(1),
  bookingReference: z.string().trim().min(1), at: InstantSchema.nullable(),
});
export type EvidenceReview = z.infer<typeof EvidenceReviewSchema>;

export async function importReviewedEvidence(input: EvidenceReview, tripId: Id, ctx: FeatureContext): Promise<Result<{ document: EvidenceDocument; receipt: Receipt | null }>> {
  const parsed = parseWith(EvidenceReviewSchema, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  if (v.kind === 'receipt' && !v.at) return err('validation_failed', 'Receipt posting date is required');
  const trip = await ctx.repo.getTrip(tripId);
  if (!trip.ok) return trip;
  const now = ctx.clock.now();
  const document: EvidenceDocument = {
    id: newId('document'), workspaceId: trip.value.workspaceId, tripId, kind: v.kind,
    title: `${v.merchant} ${v.kind} ${v.reference}`, text: v.text,
    contentHash: await sha256Hex(normalizeDocumentText(v.text)), receivedAt: now, createdAt: now,
    isSample: v.text.startsWith('SAMPLE DOCUMENT'),
    provenance: { kind: 'user_entered', source: 'User-reviewed wallet evidence', recordedAt: now, documentId: null, excerpt: null },
  };
  const stored = await ctx.repo.putDocument(document);
  if (!stored.ok) return stored;
  if (v.kind === 'refund_confirmation') return { ok: true as const, value: { document: stored.value.document, receipt: null } };
  const receipt: Receipt = {
    id: newId('receipt'), workspaceId: trip.value.workspaceId, tripId, reference: v.reference,
    amount: v.amount, receivedAt: v.at!, merchant: v.merchant, bookingReferenceHint: v.bookingReference,
    sourceDocumentId: stored.value.document.id, matchState: 'unmatched', reviewState: 'reviewed',
    provenance: { kind: 'received_transaction', source: document.title, recordedAt: now, documentId: stored.value.document.id, excerpt: v.text },
    revision: 1, createdAt: now, updatedAt: now,
  };
  const saved = await ctx.repo.putReceipt(receipt);
  return saved.ok ? { ok: true as const, value: { document: stored.value.document, receipt: saved.value.receipt } } : saved;
}
