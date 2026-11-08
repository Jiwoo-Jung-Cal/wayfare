import {
  addDuration, addMaybe, deadlineStatus, DEMO_IDS, demoDisruption, demoDocument,
  err, formatMaybeMoney, isBefore, isInWindow, isUnknown, newId, ok, subtractMaybe,
  sumMaybe, unknownValue, zero, type Booking, type Disruption, type FeatureContext,
  type Instant, type MaybeMoney, type PolicyEvidence, type RecoveryOption,
  type RefundTier, type Result, type WorkspaceSnapshot,
} from '../../core/index.ts';

export type Eligibility = { amount: MaybeMoney; cash: MaybeMoney; tier: RefundTier | null; reason: string };
export function eligibility(booking: Booking, policy: PolicyEvidence | undefined, now: Instant,
  condition: 'provider_cancels' | 'traveler_cancels'): Eligibility {
  const unknown = (reason: string): Eligibility => ({ amount: unknownValue(reason), cash: unknownValue(reason), tier: null, reason });
  if (!policy || policy.id !== booking.policyId || policy.bookingId !== booking.id || policy.tripId !== booking.tripId || policy.workspaceId !== booking.workspaceId)
    return unknown('No matching cancellation policy. Review policy in intake.');
  if (policy.reviewState !== 'reviewed' || policy.refundability === 'unknown' || policy.unknownFields.length)
    return unknown('Cancellation policy is incomplete or needs review.');
  const tiers = policy.refundTiers.filter(t => (t.condition === 'any' || t.condition === condition) && isInWindow(now, t.window));
  if (tiers.length !== 1) return unknown('No unique reviewed refund tier applies to this cancellation condition and time.');
  const tier = tiers[0]!;
  const excerpt = policy.excerpts.find(e => e.id === tier.excerptId);
  if (!policy.sourceDocumentId || !excerpt) return unknown('Refund tier needs source evidence.');
  if (isUnknown(tier.refund)) return unknown(tier.refund.reason);
  if (isUnknown(booking.paid)) return unknown('Original paid amount is unknown; review before calculating recovery.');
  if (tier.refund.currency !== booking.paid.currency) return unknown('Refund and original payment currencies do not match.');
  if (tier.refund.amountMinor < 0 || tier.refund.amountMinor > booking.paid.amountMinor) return unknown('Refund amount is outside the reviewed payment amount.');
  if (tier.method === 'points') return unknown('Points recovery needs a quantity in points, not a money amount.');
  if (tier.method === 'unknown' || (tier.method === 'none' && tier.refund.amountMinor !== 0)) return unknown('Recovery method needs review.');
  return { amount: tier.refund, cash: tier.method === 'original_payment' ? tier.refund : zero(tier.refund.currency), tier, reason: excerpt.text };
}

export type Impact = { booking: Booking; affected: boolean; reason: string };
/** A dependency flag explains risk only; analysis never mutates a booking. */
export function analyzeImpacts(bookings: Booking[], disruption: Disruption): Impact[] {
  const root = bookings.find(b => b.id === disruption.bookingId);
  const affected = new Set([disruption.bookingId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of bookings) {
      if (affected.has(b.id) || b.state === 'cancelled' || b.state === 'replaced') continue;
      if (root && !isBefore(root.startsAt, b.endsAt ?? b.startsAt)) continue;
      if (b.dependsOn.some(id => affected.has(id))) { affected.add(b.id); changed = true; }
    }
  }
  return bookings.map(booking => ({ booking, affected: affected.has(booking.id), reason:
    booking.id === disruption.bookingId ? disruption.description : affected.has(booking.id)
      ? `Depends on ${booking.dependsOn.filter(id => affected.has(id)).join(', ')}; scheduled ${booking.startsAt}. Check arrival before keeping this booking.`
      : 'No affected future dependency found. Preserved unless you explicitly choose to cancel the whole trip.' }));
}

export type DeadlineRow = { booking: Booking; at: Instant | null; label: string; timezone: string;
  status: 'Open' | 'Closing soon' | 'Passed' | 'Unknown' | 'No deadline'; source: string;
  before: MaybeMoney; after: MaybeMoney };
export type Comparison = { snapshot: WorkspaceSnapshot; tripId: string; disruption: Disruption;
  impacts: Impact[]; deadlines: DeadlineRow[]; options: RecoveryOption[] };

export function cancellationCondition(b: Booking, d: Disruption, s: WorkspaceSnapshot): 'provider_cancels' | 'traveler_cancels' {
  // v1 supports the canonical, source-backed carrier cancellation only. A generic
  // delay, traveler cancellation, or arbitrary disruption must not gain this entitlement.
  const source = s.documents.find(doc => doc.id === d.sourceDocumentId);
  return b.id === d.bookingId && d.id === DEMO_IDS.disruption && d.type === 'cancellation'
    && d.sourceDocumentId === DEMO_IDS.documents.disruptionNotice && source?.kind === 'disruption_notice' && source.isSample
    ? 'provider_cancels' : 'traveler_cancels';
}

export function computeComparison(s: WorkspaceSnapshot, tripId: string, now: Instant): Result<Comparison> {
  const trip = s.trips.find(t => t.id === tripId);
  if (!trip) return err('not_found', 'Trip not found.');
  const disruptions = s.disruptions.filter(d => d.tripId === tripId && d.status === 'active');
  if (disruptions.length !== 1 || disruptions[0]!.type !== 'cancellation') return err('precondition_failed', 'Trigger the supported flight cancellation to compare recovery choices.');
  const disruption = disruptions[0]!;
  const bookings = s.bookings.filter(b => b.tripId === tripId);
  if (!bookings.some(b => b.id === disruption.bookingId)) return err('not_found', 'Disrupted booking not found.');
  const currencies = new Set(bookings.flatMap(b => isUnknown(b.paid) ? [] : [b.paid.currency]));
  const currency = currencies.size === 1 ? [...currencies][0]! : 'USD';
  const total = (values: MaybeMoney[]): MaybeMoney => values.some(v => !isUnknown(v) && v.currency !== currency) || currencies.size !== 1
    ? unknownValue('A single known currency is required; no currency conversion is available.') : sumMaybe(values, currency);
  const policyFor = (b: Booking) => s.policies.find(p => p.id === b.policyId && s.documents.some(doc => doc.id === p.sourceDocumentId));
  const recorded = (b: Booking) => s.actions.find(a => a.tripId === tripId && a.bookingId === b.id && a.disruptionId === disruption.id && (a.result.status === 'simulated' || a.result.status === 'provider_confirmed') && (a.action === 'cancel' || a.action === 'replace'));
  const evaluate = (b: Booking, time: Instant) => eligibility(b, policyFor(b), time, cancellationCondition(b, disruption, s));
  const outcome = (b: Booking): Eligibility => {
    const saved = recorded(b);
    if (!saved) return evaluate(b, now);
    const cash = saved.expectedRecovery.filter(c => c.kind === 'cash_refund' && c.method === 'original_payment').map(c => c.value.unit === 'money' ? c.value.amount : unknownValue('Cash component has invalid units.'));
    const amount = total(cash);
    return { amount, cash: amount, tier: policyFor(b)?.refundTiers.find(t => t.id === saved.expectedRecovery[0]?.refundTierId) ?? null, reason: 'Previously recorded simulated recovery; not recalculated at later deadlines.' };
  };
  const impacts = analyzeImpacts(bookings, disruption);
  const deadlines: DeadlineRow[] = bookings.flatMap<DeadlineRow>(b => {
    const p = policyFor(b);
    const current = evaluate(b, now);
    if (isUnknown(current.amount)) return [{ booking: b, at: null, label: 'Review cancellation policy', timezone: b.localTimezone,
      status: 'Unknown' as const, source: current.reason, before: current.cash, after: current.cash }];
    if (!p?.deadlines.length) return [{ booking: b, at: null, label: 'No stated cancellation deadline', timezone: b.localTimezone,
      status: 'No deadline' as const, source: current.reason, before: current.cash, after: current.cash }];
    return p.deadlines.map(d => ({ booking: b, at: d.at, label: d.label, timezone: d.displayTimezone,
      status: deadlineStatus(now, d.at) === 'deadline_passed' ? 'Passed' as const
        : Date.parse(d.at) - Date.parse(now) < 36 * 3600_000 ? 'Closing soon' as const : 'Open' as const,
      source: d.sourceWording, before: evaluate(b, addDuration(d.at, { seconds: -1 })).cash, after: evaluate(b, d.at).cash }));
  }).sort((a, b) => (a.at ? Date.parse(a.at) : Infinity) - (b.at ? Date.parse(b.at) : Infinity));
  const baseline = total(bookings.map(b => b.paid));
  const root = bookings.find(b => b.id === disruption.bookingId)!;
  const quote = s.quotes.filter(q => q.tripId === tripId && q.forBookingId === root.id && q.kind === root.kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
  const quoteProblem = !quote ? 'Replacement quote is missing.'
    : !quote.validUntil ? 'The replacement price has no stated expiry; get a fresh quote before keeping the trip.'
    : !isBefore(now, quote.validUntil) ? 'The replacement price has expired; get a fresh quote before keeping the trip.'
    : !quote.startsAt || !quote.endsAt || !isBefore(now, quote.startsAt) || !isBefore(quote.startsAt, quote.endsAt) ? 'Replacement travel times need review.'
    : quote.price.currency !== currency ? 'Replacement quote currency does not match the trip.'
    : impacts.some(i => i.affected && i.booking.id !== root.id && isBefore(i.booking.kind === 'hotel' ? i.booking.endsAt ?? i.booking.startsAt : i.booking.startsAt, quote.endsAt!))
      ? 'Replacement arrives too late for an affected booking.' : null;
  const options = (['continue', 'cancel_trip'] as const).map(kind => {
    const constraints: string[] = [];
    if (kind === 'continue' && quoteProblem) constraints.push(quoteProblem);
    const bookingActions = bookings.map(b => {
      const action = kind === 'cancel_trip' ? 'cancel' as const : b.id === root.id ? 'replace' as const : 'keep' as const;
      const e = outcome(b);
      if (action !== 'keep' && isUnknown(e.amount)) constraints.push(`${b.title}: ${e.reason}`);
      if ((b.state === 'cancelled' || b.state === 'replaced') && recorded(b)?.action !== action) constraints.push(`${b.title}: already ${b.state}; this choice is incompatible with its recorded action.`);
      return { bookingId: b.id, action, replacementQuoteId: action === 'replace' ? quote?.id ?? null : null,
        refundTierId: action === 'keep' ? null : e.tier?.id ?? null, expectedRecovery: action === 'keep' ? zero(currency) : e.amount,
        method: action === 'keep' ? 'none' as const : e.tier?.method ?? 'unknown' as const };
    });
    const extraCashNeeded = kind === 'cancel_trip' ? zero(currency) : quoteProblem ? unknownValue(quoteProblem) : quote!.price;
    const expectedCashRecovery = total(bookingActions.map(a => a.action === 'keep' ? zero(currency) : outcome(bookings.find(b => b.id === a.bookingId)!).cash));
    const cashPaidBeforeRefunds = addMaybe(baseline, extraCashNeeded);
    const forecastCost = subtractMaybe(cashPaidBeforeRefunds, expectedCashRecovery);
    for (const value of [extraCashNeeded, expectedCashRecovery, cashPaidBeforeRefunds, forecastCost]) if (isUnknown(value)) constraints.push(value.reason);
    const times = bookings.filter(b => kind === 'cancel_trip' || b.id === root.id).flatMap(b => {
      const p = policyFor(b);
      return [...(p?.deadlines.map(d => d.at) ?? []), ...(p?.refundTiers.flatMap(t => [t.window.startsAtOrAfter, t.window.endsBefore]) ?? [])];
    }).filter((t): t is string => t !== null && isBefore(now, t));
    if (kind === 'continue' && quote?.validUntil) times.push(quote.validUntil);
    const existing = s.recoveryOptions.find(o => o.tripId === tripId && o.disruptionId === disruption.id && o.kind === kind);
    const id = existing?.id ?? (tripId === DEMO_IDS.trip ? kind === 'continue' ? DEMO_IDS.recoveryOptions.continue : DEMO_IDS.recoveryOptions.cancelTrip : newId('recoveryOption'));
    return { id, workspaceId: trip.workspaceId, tripId, disruptionId: disruption.id, kind,
      label: kind === 'continue' ? 'Continue the trip' : 'Cancel the trip', bookingActions, extraCashNeeded, expectedCashRecovery,
      cashPaidBeforeRefunds, forecastCost, noncashEffects: s.assets.filter(a => a.tripId === tripId).map(a => ({ assetId: a.id,
        description: `${a.issuer}: ${a.value.unit === 'money' ? formatMaybeMoney(a.value.amount) : isUnknown(a.value.quantity) ? 'Unknown points' : `${a.value.quantity.toLocaleString('en-US')} points`} unchanged; not counted as cash.` })),
      constraints: [...new Set(constraints)], assumptions: ['Expected refunds are forecasts, not provider promises or money received.',
        'Provider actions are simulations. No provider is contacted.', ...impacts.map(i => `${i.booking.title}: ${i.reason}`), ...(kind === 'continue' ? ['Keep dependent bookings; hotel late arrival must be confirmed with the hotel.'] : ['Explicit approval applies to all listed trip bookings, including any not flagged as affected.'])],
      evidenceDocumentIds: [...new Set([disruption.sourceDocumentId, ...bookings.flatMap(b => b.evidenceDocumentIds),
        ...bookings.map(b => policyFor(b)?.sourceDocumentId ?? null), kind === 'continue' ? quote?.provenance.documentId ?? null : null].filter((id): id is string => id !== null))],
      computedAt: now, validUntil: times.sort()[0] ?? null, createdAt: existing?.createdAt ?? now } satisfies RecoveryOption;
  });
  return ok({ snapshot: s, tripId, disruption, impacts, deadlines, options });
}

export async function loadComparison(tripId: string, ctx: FeatureContext): Promise<Result<Comparison>> {
  const snapshot = await ctx.repo.snapshot();
  if (!snapshot.ok) return snapshot;
  const computed = computeComparison(snapshot.value, tripId, ctx.clock.now());
  if (!computed.ok) return computed;
  const saved = await ctx.repo.replaceRecoveryOptions({ tripId, disruptionId: computed.value.disruption.id, options: computed.value.options });
  return saved.ok ? ok({ ...computed.value, options: saved.value }) : saved;
}

export async function triggerDemoDisruption({ tripId }: { tripId: string }, ctx: FeatureContext): Promise<Result<{ disruptionId: string }>> {
  if (tripId !== DEMO_IDS.trip) return err('unsupported', 'This simulated disruption supports the canonical NYC trip only.');
  const trip = await ctx.repo.getTrip(tripId);
  if (!trip.ok) return trip;
  const booking = await ctx.repo.getBooking(DEMO_IDS.bookings.flight);
  if (!booking.ok) return booking;
  const demo = { workspaceId: trip.value.workspaceId, now: ctx.clock.now() };
  const document = await ctx.repo.putDocument(await demoDocument(demo, DEMO_IDS.documents.disruptionNotice));
  if (!document.ok) return document;
  const result = await ctx.repo.recordDisruption({ ...demoDisruption(demo), sourceDocumentId: document.value.document.id });
  return result.ok ? ok({ disruptionId: result.value.disruption.id }) : result;
}
