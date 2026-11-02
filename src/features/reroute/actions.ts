import {
  appError, createClock, err, isBefore, isUnknown, ok, sha256Hex, type ActionRecord,
  type AppError, type FeatureContext, type RecoveryOption, type Result, type WorkspaceSnapshot,
} from '../../core/index.ts';
import { computeComparison, type Comparison } from './model.ts';

export type ApprovalPreview = { comparison: Comparison; option: RecoveryOption; fingerprints: Record<string, string> };
export type ActionOutcome = { bookingId: string; status: 'recorded' | 'already_recorded' | 'failed' | 'stale'; action?: ActionRecord; error?: AppError; notificationPending?: boolean };
export type ApprovalResult = { outcomes: ActionOutcome[]; stale: boolean };
const successful = (a: ActionRecord) => a.result.status === 'simulated' || a.result.status === 'provider_confirmed';
function savedAction(s: WorkspaceSnapshot, option: RecoveryOption, bookingId: string) {
  const action = option.bookingActions.find(a => a.bookingId === bookingId)?.action;
  return s.actions.find(a => a.tripId === option.tripId && a.bookingId === bookingId && a.disruptionId === option.disruptionId && a.action === action && successful(a));
}
function fingerprint(s: WorkspaceSnapshot, option: RecoveryOption, bookingId: string) {
  const b = s.bookings.find(b => b.id === bookingId);
  const a = option.bookingActions.find(a => a.bookingId === bookingId);
  const p = s.policies.find(p => p.id === b?.policyId);
  return JSON.stringify({ booking: b, policy: p, action: a,
    quote: s.quotes.find(q => q.id === a?.replacementQuoteId),
    disruption: s.disruptions.find(d => d.id === option.disruptionId),
    evidence: s.documents.filter(d => option.evidenceDocumentIds.includes(d.id)) });
}
/** Read the current persisted sample clock too: another tab can advance it. */
async function fresh(tripId: string, ctx: FeatureContext): Promise<Result<Comparison>> {
  const snapshot = await ctx.repo.snapshot();
  if (!snapshot.ok) return snapshot;
  const clock = snapshot.value.clock.mode === 'sample' ? createClock(snapshot.value.clock) : ctx.clock;
  return computeComparison(snapshot.value, tripId, clock.now());
}
export async function prepareApproval(tripId: string, kind: RecoveryOption['kind'], ctx: FeatureContext): Promise<Result<ApprovalPreview>> {
  const comparison = await fresh(tripId, ctx);
  if (!comparison.ok) return comparison;
  const option = comparison.value.options.find(o => o.kind === kind);
  if (!option) return err('not_found', 'Recovery choice is unavailable.');
  const saved = await ctx.repo.replaceRecoveryOptions({ tripId, disruptionId: option.disruptionId, options: comparison.value.options });
  if (!saved.ok) return saved;
  return ok({ comparison: comparison.value, option, fingerprints: Object.fromEntries(option.bookingActions.map(a => [a.bookingId, fingerprint(comparison.value.snapshot, option, a.bookingId)])) });
}

/** Stable operation identity, independent of preview regeneration, retry, and reload.
 * Failed transport/write attempts are not saved as failed ActionRecords: the shared
 * repository makes every recorded action terminal for its idempotency key.
 */
export async function approveRecovery(preview: ApprovalPreview, ctx: FeatureContext): Promise<Result<ApprovalResult>> {
  const initial = await fresh(preview.option.tripId, ctx);
  if (!initial.ok) return initial;
  const chosen = preview.option.bookingActions.filter(a => a.action !== 'keep');
  const outcomes: ActionOutcome[] = [];
  let stale = false;
  const current = initial.value.options.find(o => o.kind === preview.option.kind)!;
  const pending = chosen.filter(a => !savedAction(initial.value.snapshot, current, a.bookingId));
  if (pending.length && (current.constraints.length || (preview.option.validUntil && !isBefore(initial.value.options[0]!.computedAt, preview.option.validUntil))
    || pending.some(a => fingerprint(initial.value.snapshot, current, a.bookingId) !== preview.fingerprints[a.bookingId]))) {
    return ok({ stale: true, outcomes: chosen.map(a => {
      const saved = savedAction(initial.value.snapshot, current, a.bookingId);
      return saved ? { bookingId: a.bookingId, status: 'already_recorded', action: saved } : { bookingId: a.bookingId, status: 'stale', error: appError('conflict', 'The preview changed or expired. Review updated consequences and confirm again.') };
    }) });
  }
  for (const requested of chosen) {
    // Re-read between actions; a late deadline or concurrent edit must not allow
    // later bookings to use an earlier amount after a partial success.
    const latest = await fresh(preview.option.tripId, ctx);
    if (!latest.ok) { outcomes.push({ bookingId: requested.bookingId, status: 'failed', error: latest.error }); continue; }
    const option = latest.value.options.find(o => o.kind === preview.option.kind)!;
    const snapshot = latest.value.snapshot;
    const existing = savedAction(snapshot, option, requested.bookingId);
    const booking = snapshot.bookings.find(b => b.id === requested.bookingId)!;
    if (existing) {
      let notificationPending = false;
      try { await ctx.notifyActionRecorded({ tripId: existing.tripId, actionRecordId: existing.id }); } catch { notificationPending = true; }
      outcomes.push({ bookingId: booking.id, status: 'already_recorded', action: existing, notificationPending });
      continue;
    }
    if (stale || fingerprint(snapshot, option, booking.id) !== preview.fingerprints[booking.id]
      || (preview.option.validUntil && !isBefore(option.computedAt, preview.option.validUntil))) {
      stale = true;
      outcomes.push({ bookingId: booking.id, status: 'stale', error: appError('conflict', 'State or deadline changed during approval. Review the remaining actions again.') }); continue;
    }
    const a = option.bookingActions.find(a => a.bookingId === booking.id)!;
    if (isUnknown(a.expectedRecovery) || a.method === 'unknown') {
      outcomes.push({ bookingId: booking.id, status: 'failed', error: appError('precondition_failed', 'Recovery requires policy review.') }); continue;
    }
    const identity = await sha256Hex(JSON.stringify([booking.workspaceId, booking.tripId, option.disruptionId, booking.id, a.action]));
    const action: ActionRecord = {
      id: `act-${identity}`, workspaceId: booking.workspaceId, tripId: booking.tripId, bookingId: booking.id,
      recoveryOptionId: option.id, disruptionId: option.disruptionId, action: a.action, replacementQuoteId: a.replacementQuoteId,
      idempotencyKey: `reroute:${identity}`, expectedRecovery: a.method === 'none' ? [] : [{
        id: `rc-${identity}`, kind: a.method === 'original_payment' ? 'cash_refund' : a.method === 'points' ? 'points' : a.method,
        value: { unit: 'money', amount: a.expectedRecovery }, method: a.method, refundTierId: a.refundTierId, dueAt: null, dueAtSource: null,
      }], resultingBookingState: a.action === 'replace' ? 'replaced' : 'cancelled',
      result: { status: 'simulated', detail: 'Simulated action recorded. No provider was contacted and no refund was received.' },
      capability: 'simulated', approvedAt: option.computedAt, createdAt: option.computedAt,
    };
    let saved;
    try { saved = await ctx.repo.recordBookingAction({ action, expectedBookingRevision: booking.revision }); }
    catch (e) { outcomes.push({ bookingId: booking.id, status: 'failed', error: appError('unavailable', String(e)) }); continue; }
    if (!saved.ok) { outcomes.push({ bookingId: booking.id, status: 'failed', error: saved.error }); continue; }
    let notificationPending = false;
    try { await ctx.notifyActionRecorded({ tripId: booking.tripId, actionRecordId: saved.value.action.id }); } catch { notificationPending = true; }
    outcomes.push({ bookingId: booking.id, status: saved.value.replayed ? 'already_recorded' : 'recorded', action: saved.value.action, notificationPending });
  }
  return ok({ outcomes, stale });
}
