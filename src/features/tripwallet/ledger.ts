import {
  err, ok, newId, isUnknown, unknownValue, sum, subtract, equals, formatMaybeMoney,
  normalizeReference, compareInstants, MoneySchema, InstantSchema,
  type FeatureContext, type ClaimSyncResult, type Result, type RefundClaim,
  type Receipt, type Money, type Booking, type WalletAsset, type Id,
} from '../../core/index.ts';

export async function syncClaimsFromActions({ tripId }: { tripId: Id }, ctx: FeatureContext): Promise<Result<ClaimSyncResult>> {
  const actions = await ctx.repo.listActions(tripId);
  if (!actions.ok) return actions;
  const claims: RefundClaim[] = [];
  for (const a of actions.value) {
    if (a.result.status !== 'simulated' && a.result.status !== 'provider_confirmed') continue;
    for (const c of a.expectedRecovery) {
      // Noncash recovery is not a cash claim, even when denominated in dollars.
      if (c.kind !== 'cash_refund') continue;
      if (c.value.unit !== 'money' || c.method !== 'original_payment' || (!isUnknown(c.value.amount) && c.value.amount.amountMinor < 0)) {
        return err('validation_failed', `Action ${a.id}, component ${c.id} needs producer review: inconsistent cash recovery`);
      }
      const now = ctx.clock.now();
      claims.push({
        id: newId('claim'), workspaceId: a.workspaceId, tripId, bookingId: a.bookingId,
        actionRecordId: a.id, recoveryComponentId: c.id, expected: c.value.amount,
        method: c.method, providerConfirmed: unknownValue('No provider confirmation'),
        confirmationDocumentId: null, allocations: [], outstanding: c.value.amount, status: 'expected',
        due: c.dueAt && c.dueAtSource ? { at: c.dueAt, provenance: {
          kind: a.capability === 'simulated' ? 'sample' : 'imported_fact',
          source: c.dueAtSource, recordedAt: now, documentId: null, excerpt: c.dueAtSource,
        } } : null,
        revision: 1, createdAt: now, updatedAt: now,
      });
    }
  }
  const saved = await ctx.repo.ensureClaims(claims);
  return saved.ok ? ok({ created: saved.value.created, existing: saved.value.existing }) : saved;
}

export function received(claim: RefundClaim): Money | null {
  const base = isUnknown(claim.providerConfirmed) ? claim.expected : claim.providerConfirmed;
  const currency = claim.allocations[0]?.amount.currency ?? (!isUnknown(base) ? base.currency : null);
  return currency ? sum(claim.allocations.map(a => a.amount), currency) : null;
}

/** Overdue is derived from the active clock, never persisted as a stale status. */
export function claimState(claim: RefundClaim, now: string) {
  const base = isUnknown(claim.providerConfirmed) ? claim.expected : claim.providerConfirmed;
  const cash = received(claim);
  const outstanding = isUnknown(base) || !cash ? base : subtract(base, cash);
  const discrepancy = !isUnknown(claim.expected) && !isUnknown(claim.providerConfirmed) && !equals(claim.expected, claim.providerConfirmed);
  const needsReview = discrepancy || (!isUnknown(outstanding) && outstanding.amountMinor < 0);
  const status: RefundClaim['status'] = needsReview ? 'needs_review'
    : !isUnknown(outstanding) && outstanding.amountMinor === 0 ? 'received'
    : cash && cash.amountMinor > 0 ? 'partially_received'
    : !isUnknown(claim.providerConfirmed) ? 'provider_confirmed' : 'expected';
  return { outstanding, received: cash, status, discrepancy,
    overdue: !!claim.due && compareInstants(now, claim.due.at) >= 0 && (isUnknown(outstanding) || outstanding.amountMinor > 0) };
}

export async function confirmClaim(input: { tripId: Id; claimId: Id; documentId: Id; amount: Money; dueAt: string | null }, ctx: FeatureContext) {
  if (!MoneySchema.safeParse(input.amount).success || input.amount.amountMinor < 0 ||
      (input.dueAt !== null && !InstantSchema.safeParse(input.dueAt).success)) return err('validation_failed', 'Review the amount and UTC due date');
  const claims = await ctx.repo.listClaims(input.tripId);
  if (!claims.ok) return claims;
  const claim = claims.value.find(c => c.id === input.claimId);
  if (!claim) return err('not_found', 'Claim not found');
  const doc = await ctx.repo.getDocument(input.documentId);
  if (!doc.ok) return doc;
  if (doc.value.tripId !== input.tripId || doc.value.kind !== 'refund_confirmation') return err('validation_failed', 'Select refund confirmation evidence for this trip');
  if (!isUnknown(claim.expected) && claim.expected.currency !== input.amount.currency) return err('validation_failed', 'Currency mismatch; evidence retained for review');
  if (claim.allocations.some(a => a.amount.currency !== input.amount.currency)) return err('validation_failed', 'Currency mismatch with existing receipts');
  const next = { ...claim, providerConfirmed: input.amount, confirmationDocumentId: input.documentId,
    due: input.dueAt ? { at: input.dueAt, provenance: { kind: 'provider_confirmation' as const,
      source: doc.value.title, documentId: input.documentId, recordedAt: ctx.clock.now(), excerpt: doc.value.text } } : null };
  const state = claimState(next, ctx.clock.now());
  return ctx.repo.saveClaim({ ...next, outstanding: state.outstanding, status: state.status }, { expectedRevision: claim.revision });
}

/** Suggestions only. Exact booking reference AND compatible currency/timing/merchant; never amount alone. */
export function matchCandidates(receipt: Receipt, claims: RefundClaim[], bookings: Booking[], now: string) {
  return claims.filter(c => {
    const booking = bookings.find(b => b.id === c.bookingId);
    const state = claimState(c, now);
    const provider = booking?.provider.toLowerCase().replace(/[^a-z0-9]/g, '');
    const merchant = receipt.merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
    return booking && provider && merchant.includes(provider) && receipt.bookingReferenceHint &&
      normalizeReference(receipt.bookingReferenceHint) === normalizeReference(booking.reference) &&
      compareInstants(receipt.receivedAt, c.createdAt) >= 0 && !isUnknown(state.outstanding) &&
      receipt.amount.currency === state.outstanding.currency && receipt.amount.amountMinor > 0 &&
      receipt.amount.amountMinor <= state.outstanding.amountMinor;
  });
}

/** A single receipt is allocated in full to one claim in this bounded MVP. */
export async function allocateReceipt(input: { tripId: Id; receiptId: Id; claimId: Id }, ctx: FeatureContext) {
  const snapshot = await ctx.repo.snapshot();
  if (!snapshot.ok) return snapshot;
  const { claims, receipts } = snapshot.value;
  const claim = claims.find(c => c.id === input.claimId && c.tripId === input.tripId);
  const receipt = receipts.find(r => r.id === input.receiptId && r.tripId === input.tripId);
  if (!claim || !receipt) return err('not_found', 'Claim or receipt not found in this trip');
  const existing = claims.find(c => c.allocations.some(a => a.receiptId === receipt.id));
  if (existing) return existing.id === claim.id ? ok(existing) : err('duplicate', 'Receipt already allocated to another claim');
  const state = claimState(claim, ctx.clock.now());
  if (isUnknown(state.outstanding)) return err('precondition_failed', 'Outstanding amount is unknown; review first');
  if (state.outstanding.currency !== receipt.amount.currency) return err('validation_failed', 'Currency mismatch');
  if (receipt.amount.amountMinor <= 0 || receipt.amount.amountMinor > state.outstanding.amountMinor) return err('precondition_failed', 'Receipt would over-allocate this claim; evidence retained for review');
  const next = { ...claim, allocations: [...claim.allocations, {
    id: newId('allocation'), receiptId: receipt.id, amount: receipt.amount, allocatedAt: ctx.clock.now(),
  }] };
  const updated = claimState(next, ctx.clock.now());
  // Claim allocation is the source of truth. No second receipt write that could fail halfway.
  // Cross-claim concurrent allocation still needs a shared atomic repository operation (#3).
  return ctx.repo.saveClaim({ ...next, outstanding: updated.outstanding, status: updated.status }, { expectedRevision: claim.revision });
}

export function followUpDraft(claim: RefundClaim, booking: Booking, now: string) {
  const s = claimState(claim, now);
  return `Subject: Refund follow-up — ${booking.reference}\n\nHello ${booking.provider},\n\nPlease review refund for booking ${booking.reference} (action ${claim.actionRecordId}).\nExpected cash recovery: ${formatMaybeMoney(claim.expected)}.\nProvider-confirmed: ${formatMaybeMoney(claim.providerConfirmed)}.\nReceived: ${s.received ? formatMaybeMoney(s.received) : 'Unknown currency'}.\nOutstanding: ${formatMaybeMoney(s.outstanding)}.\n${claim.due ? `Due: ${claim.due.at}, source: ${claim.due.provenance.source}.` : 'Due date unknown; please confirm the processing date.'}\nConfirmation evidence: ${claim.confirmationDocumentId ?? 'Missing — provider confirmation needed'}.\nReceipt references: ${claim.allocations.map(a => a.receiptId).join(', ') || 'None allocated'}.\n\nPlease confirm the remaining amount and expected payment date.\nThank you.`;
}

export function assetEligibility(asset: WalletAsset, input: { issuer: string; currency?: string }, now: string) {
  if (asset.status !== 'available') return { eligible: false, reason: `Asset is ${asset.status}` };
  if (asset.expiresAt && compareInstants(now, asset.expiresAt) >= 0) return { eligible: false, reason: 'Expired' };
  if (normalizeReference(asset.issuer) !== normalizeReference(input.issuer)) return { eligible: false, reason: 'Issuer mismatch' };
  if (asset.value.unit === 'money' && (isUnknown(asset.value.amount) || asset.value.amount.currency !== input.currency)) return { eligible: false, reason: 'Unknown balance or currency mismatch' };
  // Free-text restrictions are not executable eligibility rules. Do not auto-spend.
  return { eligible: false, reason: 'Review issuer restrictions, expiry and terms before reserving; redemption not implemented' };
}

/** Same recovery at overlapping stages; callers must never add the columns together. */
export function walletSummary(claims: RefundClaim[], assets: WalletAsset[], now: string) {
  const currencies = new Set(claims.flatMap(c => [c.expected, c.providerConfirmed, ...c.allocations.map(a => a.amount)]).flatMap(v => isUnknown(v) ? [] : [v.currency]));
  return { cash: [...currencies].map(currency => {
    const rows = claims.filter(c => (!isUnknown(c.expected) && c.expected.currency === currency) || (!isUnknown(c.providerConfirmed) && c.providerConfirmed.currency === currency));
    return { currency, expected: rows.some(c => isUnknown(c.expected)) ? unknownValue('Some expectations unknown') : sum(rows.map(c => c.expected as Money), currency),
      providerConfirmed: rows.some(c => isUnknown(c.providerConfirmed)) ? unknownValue('Some confirmations missing') : sum(rows.map(c => c.providerConfirmed as Money), currency),
      received: sum(rows.flatMap(c => c.allocations.map(a => a.amount)), currency),
      outstanding: rows.some(c => isUnknown(claimState(c, now).outstanding)) ? unknownValue('Some balances unknown') : sum(rows.map(c => claimState(c, now).outstanding as Money), currency) };
  }), unknownCurrencyClaimIds: claims.filter(c => isUnknown(c.expected) && isUnknown(c.providerConfirmed)).map(c => c.id),
  attention: claims.filter(c => { const s = claimState(c, now); return s.overdue || s.status === 'needs_review'; }).map(c => c.id),
  noncash: assets.map(a => ({ id: a.id, issuer: a.issuer, value: a.value, status: a.status, expiresAt: a.expiresAt, restrictions: a.restrictions })) };
}
